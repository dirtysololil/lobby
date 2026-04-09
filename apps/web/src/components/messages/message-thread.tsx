"use client";

import type { CustomEmojiAsset, DirectConversationDetail } from "@lobby/shared";
import { AlertCircle, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getDirectMessageAttachmentAssetUrl, getDirectMessageAttachmentPreviewUrl } from "@/lib/direct-message-attachments";
import { isEmojiCluster, splitGraphemes } from "@/lib/emoji/unicode";
import {
  hasRenderableLinkEmbedMedia,
  isStandaloneEmbeddableMessage,
  stripEmbeddableLinkText,
} from "@/lib/link-embeds";
import { customEmojiTokenPattern } from "@/lib/stickers";
import { cn } from "@/lib/utils";
import { EmbeddedMediaBubble } from "./embedded-media-bubble";
import { GifAssetPreview } from "./gif-asset-preview";
import { InlineCustomEmojiText } from "./inline-custom-emoji-text";
import { LinkEmbedCard } from "./link-embed-card";
import { StickerAssetPreview } from "./sticker-asset-preview";

export type ThreadMessageItem =
  DirectConversationDetail["conversation"]["messages"][number] & {
    localState?: "sending" | "uploading" | "failed";
    uploadProgress?: number | null;
    localAttachmentPreviewUrl?: string | null;
    localAttachmentAssetUrl?: string | null;
    retryUploadFile?: File | null;
  };

interface MessageThreadProps {
  viewerId: string;
  messages: ThreadMessageItem[];
  isDeleting: string | null;
  lastReadAt: string | null;
  customEmojis: CustomEmojiAsset[];
  searchQuery?: string;
  onDelete: (messageId: string) => Promise<void>;
  onRetry: (messageId: string) => Promise<void>;
}

type ThreadGroup = { label: string; items: ThreadMessageItem[] };
type ContextMenuState =
  | { mode: "floating"; messageId: string; x: number; y: number }
  | { mode: "sheet"; messageId: string };

const iconProps = { size: 18, strokeWidth: 1.5 } as const;
const contextMenuWidth = 196;
const contextMenuMargin = 12;
const pendingEmbedStaleAfterMs = 60_000;
const mobileViewportQuery = "(max-width: 767px)";
const mobileActionPressDelayMs = 420;
const mobileActionMoveThresholdPx = 14;

function isContinuation(
  previousMessage: ThreadMessageItem | undefined,
  currentMessage: ThreadMessageItem,
) {
  if (!previousMessage) {
    return false;
  }

  if (previousMessage.author.id !== currentMessage.author.id) {
    return false;
  }

  const previousTime = new Date(previousMessage.createdAt).getTime();
  const currentTime = new Date(currentMessage.createdAt).getTime();

  return currentTime - previousTime < 5 * 60 * 1000;
}

function formatThreadDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    month: "long",
    day: "numeric",
  });
}

function formatThreadTime(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildSearchableMessageText(message: ThreadMessageItem) {
  const parts = [
    message.author.profile.displayName,
    message.author.username,
    message.content,
    message.sticker?.title,
    message.gif?.title,
    message.attachment?.originalName,
  ];

  return parts.filter((value): value is string => Boolean(value)).join(" ").toLowerCase();
}

function isExpressiveEmojiMessage(content: string | null) {
  if (!content) {
    return false;
  }

  const normalized = content.trim();

  if (!normalized) {
    return false;
  }

  customEmojiTokenPattern.lastIndex = 0;
  const placeholderText = normalized.replace(customEmojiTokenPattern, "§");
  customEmojiTokenPattern.lastIndex = 0;
  const graphemes = splitGraphemes(placeholderText).filter(
    (item) => item.trim().length > 0,
  );

  if (graphemes.length === 0 || graphemes.length > 3) {
    return false;
  }

  return graphemes.every((item) => item === "§" || isEmojiCluster(item));
}

function clampContextMenuPosition(x: number, y: number) {
  if (typeof window === "undefined") {
    return { x, y };
  }

  return {
    x: Math.max(
      contextMenuMargin,
      Math.min(x, window.innerWidth - contextMenuWidth - contextMenuMargin),
    ),
    y: Math.max(contextMenuMargin, Math.min(y, window.innerHeight - 60)),
  };
}

function buildMessageActionPreview(message: ThreadMessageItem) {
  const content = message.content?.trim();

  if (content) {
    return content;
  }

  if (message.type === "STICKER") {
    return message.sticker?.title ? `Стикер: ${message.sticker.title}` : "Стикер";
  }

  if (message.type === "GIF") {
    return message.gif?.title ? `GIF: ${message.gif.title}` : "GIF";
  }

  if (message.type === "MEDIA" && message.attachment) {
    return message.attachment.kind === "VIDEO" ? "Видео" : "Фото";
  }

  if (message.type === "FILE" && message.attachment) {
    return message.attachment.originalName || "Файл";
  }

  return "Сообщение";
}

export function MessageThread({
  viewerId,
  messages,
  isDeleting,
  lastReadAt,
  customEmojis,
  searchQuery = "",
  onDelete,
  onRetry,
}: MessageThreadProps) {
  const [mounted, setMounted] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [pendingEmbedTick, setPendingEmbedTick] = useState(0);
  const messageElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const longPressTimerRef = useRef<number | null>(null);
  const longPressPointerRef = useRef<{
    messageId: string;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressNextClickMessageIdRef = useRef<string | null>(null);
  const groupedMessages = useMemo(
    () =>
      messages.reduce<ThreadGroup[]>(
        (accumulator: ThreadGroup[], message: ThreadMessageItem) => {
          const label = formatThreadDate(message.createdAt);
          const group = accumulator[accumulator.length - 1];

          if (group && group.label === label) {
            group.items.push(message);
            return accumulator;
          }

          accumulator.push({ label, items: [message] });
          return accumulator;
        },
        [],
      ),
    [messages],
  );
  const messageIndexById = useMemo(
    () => new Map(messages.map((message, index) => [message.id, index])),
    [messages],
  );
  const unreadIndex = useMemo(
    () =>
      lastReadAt == null
        ? -1
        : messages.findIndex(
            (message) =>
              message.author.id !== viewerId &&
              new Date(message.createdAt).getTime() > new Date(lastReadAt).getTime(),
          ),
    [lastReadAt, messages, viewerId],
  );
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const didInitScrollRef = useRef(false);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const contextMenuMessage = contextMenu
    ? messages.find((message) => message.id === contextMenu.messageId) ?? null
    : null;
  const matchingMessageIds = useMemo(() => {
    if (!normalizedSearchQuery) {
      return new Set<string>();
    }

    return new Set(
      messages
        .filter((message) =>
          buildSearchableMessageText(message).includes(normalizedSearchQuery),
        )
        .map((message) => message.id),
    );
  }, [messages, normalizedSearchQuery]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(mobileViewportQuery);
    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(
    () => () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    if (!didInitScrollRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
      didInitScrollRef.current = true;
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    if (distanceFromBottom < 160) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    if (!messages.some((message) => message.id === contextMenu.messageId)) {
      setContextMenu(null);
    }
  }, [contextMenu, messages]);

  useEffect(() => {
    const pendingMessage = messages
      .filter((message) => message.linkEmbed?.status === "PENDING")
      .sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      )[0];

    if (!pendingMessage) {
      return;
    }

    const timeoutMs = Math.max(
      0,
      new Date(pendingMessage.createdAt).getTime() +
        pendingEmbedStaleAfterMs -
        Date.now(),
    );

    if (timeoutMs === 0) {
      setPendingEmbedTick((current) => current + 1);
      return;
    }

    const timer = window.setTimeout(() => {
      setPendingEmbedTick((current) => current + 1);
    }, timeoutMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [messages]);

  useEffect(() => {
    if (!normalizedSearchQuery) {
      return;
    }

    const firstMatchingId = messages.find((message) =>
      matchingMessageIds.has(message.id),
    )?.id;

    if (!firstMatchingId) {
      return;
    }

    const element = messageElementRefs.current.get(firstMatchingId);
    if (!element) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      element.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [matchingMessageIds, messages, normalizedSearchQuery]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const viewport = viewportRef.current;

    function closeMenu() {
      setContextMenu(null);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;

      if (
        target?.closest("[data-dm-context-menu]") ||
        target?.closest("[data-dm-menu-trigger]")
      ) {
        return;
      }

      closeMenu();
    }

    function handleContextMenu(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (
        target?.closest("[data-dm-context-menu]") ||
        target?.closest("[data-dm-menu-trigger]")
      ) {
        return;
      }

      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    viewport?.addEventListener("scroll", closeMenu, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      viewport?.removeEventListener("scroll", closeMenu);
    };
  }, [contextMenu]);

  function clearPendingMobileAction() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    longPressPointerRef.current = null;
  }

  function openDesktopContextMenu(messageId: string, x: number, y: number) {
    const position = clampContextMenuPosition(x, y);

    setContextMenu({
      mode: "floating",
      messageId,
      x: position.x,
      y: position.y,
    });
  }

  function openMobileActionSheet(messageId: string) {
    setContextMenu({
      mode: "sheet",
      messageId,
    });
  }

  function handleMessageContextMenu(
    event: ReactMouseEvent<HTMLDivElement>,
    messageId: string,
    canManageMessage: boolean,
  ) {
    if (!canManageMessage) {
      return;
    }

    event.preventDefault();

    if (isMobileViewport) {
      return;
    }

    openDesktopContextMenu(messageId, event.clientX, event.clientY);
  }

  function handleMessagePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    messageId: string,
    canManageMessage: boolean,
  ) {
    if (
      !isMobileViewport ||
      !canManageMessage ||
      event.pointerType === "mouse" ||
      event.button !== 0
    ) {
      return;
    }

    clearPendingMobileAction();

    longPressPointerRef.current = {
      messageId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    longPressTimerRef.current = window.setTimeout(() => {
      suppressNextClickMessageIdRef.current = messageId;
      openMobileActionSheet(messageId);
      clearPendingMobileAction();
    }, mobileActionPressDelayMs);
  }

  function handleMessagePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const activePointer = longPressPointerRef.current;

    if (!activePointer || activePointer.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - activePointer.startX,
      event.clientY - activePointer.startY,
    );

    if (distance > mobileActionMoveThresholdPx) {
      clearPendingMobileAction();
    }
  }

  function handleMessagePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const activePointer = longPressPointerRef.current;

    if (!activePointer || activePointer.pointerId !== event.pointerId) {
      return;
    }

    clearPendingMobileAction();
  }

  function handleMessageClickCapture(
    event: ReactMouseEvent<HTMLDivElement>,
    messageId: string,
  ) {
    if (suppressNextClickMessageIdRef.current !== messageId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressNextClickMessageIdRef.current = null;
  }

  async function handleDeleteFromMenu(messageId: string) {
    setContextMenu(null);
    await onDelete(messageId);
  }

  const contextMenuMarkup =
    mounted && contextMenu && contextMenuMessage
      ? createPortal(
          contextMenu.mode === "sheet" ? (
            <div className="fixed inset-0 z-[92] md:hidden">
              <button
                type="button"
                aria-label="Закрыть действия с сообщением"
                onClick={() => setContextMenu(null)}
                className="absolute inset-0 bg-[rgba(3,6,12,0.72)] backdrop-blur-[3px]"
              />
              <div
                data-dm-context-menu="true"
                className="absolute inset-x-3 bottom-[calc(var(--app-mobile-dock-clearance)+0.5rem)] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_22%),rgba(11,17,24,0.98)] px-3 pb-3 pt-2.5 shadow-[0_22px_48px_rgba(2,6,12,0.52)]"
              >
                <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/10" />

                <div className="rounded-[18px] border border-white/8 bg-white/[0.04] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium tracking-tight text-white">
                      Действия с сообщением
                    </p>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {formatThreadTime(contextMenuMessage.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {formatThreadDate(contextMenuMessage.createdAt)}
                  </p>
                  <p className="mt-2 max-h-[4.5rem] overflow-hidden text-sm leading-6 text-[var(--text-soft)]">
                    {buildMessageActionPreview(contextMenuMessage)}
                  </p>
                </div>

                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDeleteFromMenu(contextMenu.messageId)}
                    disabled={isDeleting === contextMenu.messageId}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-rose-400/18 bg-[linear-gradient(180deg,rgba(255,92,122,0.22),rgba(255,92,122,0.14))] px-4 text-sm font-medium text-rose-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-rose-300/24 hover:bg-[linear-gradient(180deg,rgba(255,92,122,0.28),rgba(255,92,122,0.18))] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={18} strokeWidth={1.7} />
                    {isDeleting === contextMenu.messageId
                      ? "Удаляем..."
                      : "Удалить сообщение"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setContextMenu(null)}
                    className="flex min-h-11 w-full items-center justify-center rounded-[16px] border border-white/8 bg-white/[0.04] px-4 text-sm text-[var(--text-soft)] transition-colors hover:bg-white/[0.06]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              data-dm-context-menu="true"
              className="fixed z-[90] hidden w-[196px] rounded-[14px] border border-white/8 bg-[rgba(10,14,20,0.98)] p-1.5 shadow-[0_18px_40px_rgba(2,6,12,0.42)] md:block"
              style={{
                left: contextMenu.x,
                top: contextMenu.y,
              }}
            >
              <button
                type="button"
                onClick={() => void handleDeleteFromMenu(contextMenu.messageId)}
                disabled={isDeleting === contextMenu.messageId}
                className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-sm text-rose-100 transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={16} strokeWidth={1.5} />
                {isDeleting === contextMenu.messageId
                  ? "Удаляем..."
                  : "Удалить сообщение"}
              </button>
            </div>
          ),
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={viewportRef}
        className="dm-thread-surface h-full min-h-0 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <div className="empty-state-minimal text-[var(--text-muted)]">
            <p className="text-sm">Сообщений пока нет.</p>
          </div>
        ) : (
          <div className="space-y-2.5 px-3 py-3">
            {groupedMessages.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <div className="flex items-center gap-3 py-0.5">
                  <div className="dm-rule h-px flex-1" />
                  <span className="dm-date-separator text-[10px] font-medium uppercase tracking-[0.16em]">
                    {group.label}
                  </span>
                  <div className="dm-rule h-px flex-1" />
                </div>

                {group.items.map((message, index) => {
                  const globalIndex = messageIndexById.get(message.id) ?? -1;
                  const isOwn = message.author.id === viewerId;
                  const isSticker = message.type === "STICKER";
                  const isGif = message.type === "GIF";
                  const isMediaAttachment =
                    message.type === "MEDIA" && message.attachment !== null;
                  const isFileAttachment =
                    message.type === "FILE" && message.attachment !== null;
                  const isVisualMessage = isSticker || isGif || isMediaAttachment;
                  const hasInlineEmbed =
                    !isVisualMessage &&
                    message.linkEmbed !== null &&
                    message.linkEmbed.status !== "FAILED" &&
                    hasRenderableLinkEmbedMedia(message.linkEmbed);
                  const isPendingEmbedStale =
                    message.linkEmbed?.status === "PENDING" &&
                    Date.now() - new Date(message.createdAt).getTime() >
                      pendingEmbedStaleAfterMs;
                  const shouldRenderInlineEmbed =
                    hasInlineEmbed && !isPendingEmbedStale;
                  const isStandaloneEmbed =
                    shouldRenderInlineEmbed &&
                    isStandaloneEmbeddableMessage(message.content, message.linkEmbed);
                  const visibleText =
                    shouldRenderInlineEmbed && message.linkEmbed
                      ? stripEmbeddableLinkText(message.content, message.linkEmbed.sourceUrl)
                      : message.content;
                  const showText = !isStandaloneEmbed && Boolean(visibleText);
                  const isExpressiveEmoji =
                    !isVisualMessage &&
                    !message.linkEmbed &&
                    isExpressiveEmojiMessage(visibleText);
                  const previousMessage = group.items[index - 1];
                  const continuation = isContinuation(previousMessage, message);
                  const isUnreadMarker = unreadIndex >= 0 && globalIndex === unreadIndex;
                  const canManageMessage =
                    isOwn && !message.localState && message.canDelete;
                  const isContextMenuOpen = contextMenu?.messageId === message.id;
                  const bubbleClassName = cn(
                    "dm-bubble",
                    isVisualMessage && "border-transparent bg-transparent p-0 shadow-none",
                    !isVisualMessage && (isOwn ? "dm-bubble-out ml-auto" : "dm-bubble-in"),
                    continuation && !isVisualMessage && "rounded-[18px] py-1.5",
                    isContextMenuOpen && !isVisualMessage && "dm-bubble-highlight",
                    message.localState === "failed" && "border-amber-400/22 bg-amber-400/10",
                    normalizedSearchQuery &&
                      matchingMessageIds.has(message.id) &&
                      !isVisualMessage &&
                      "dm-bubble-highlight",
                  );

                  return (
                    <div
                      key={message.id}
                      data-message-id={message.id}
                      ref={(node) => {
                        if (node) {
                          messageElementRefs.current.set(message.id, node);
                          return;
                        }

                        messageElementRefs.current.delete(message.id);
                      }}
                    >
                      {isUnreadMarker ? (
                        <div className="mb-2 flex items-center gap-3 py-0.5">
                          <div className="dm-unread-rule h-px flex-1" />
                          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--accent)]">
                            Новое
                          </span>
                          <div className="dm-unread-rule h-px flex-1" />
                        </div>
                      ) : null}

                      <div
                        className={cn(
                          "group/message flex gap-2.5 py-0.5",
                          continuation && "mt-[-1px]",
                          isOwn && "flex-row-reverse",
                        )}
                        onContextMenu={(event) =>
                          handleMessageContextMenu(event, message.id, canManageMessage)
                        }
                        onPointerDown={(event) =>
                          handleMessagePointerDown(event, message.id, canManageMessage)
                        }
                        onPointerMove={handleMessagePointerMove}
                        onPointerUp={handleMessagePointerEnd}
                        onPointerCancel={handleMessagePointerEnd}
                        onPointerLeave={handleMessagePointerEnd}
                        onClickCapture={(event) =>
                          handleMessageClickCapture(event, message.id)
                        }
                      >
                        <div className="w-8 shrink-0">
                          {continuation ? null : (
                            <UserAvatar
                              user={message.author}
                              size="sm"
                              className={cn(isOwn && "ml-auto")}
                            />
                          )}
                        </div>

                        <div
                          className={cn(
                            isVisualMessage
                              ? "min-w-0 max-w-[min(360px,100%)] flex-1"
                              : "min-w-0 max-w-[min(72ch,100%)] flex-1",
                            isOwn && "text-right",
                          )}
                        >
                          {!continuation ? (
                            <div
                              className={cn(
                                "mb-1 flex items-center gap-2.5",
                                isOwn && "justify-end",
                              )}
                            >
                              <p
                                className={cn(
                                  "dm-message-author",
                                  isOwn && "dm-message-author-own",
                                )}
                              >
                                {message.author.profile.displayName}
                              </p>
                              <span className="text-[11px] text-[var(--text-muted)]">
                                {formatThreadTime(message.createdAt)}
                              </span>
                              {message.localState === "sending" ? (
                                <span className="dm-message-meta-chip">
                                  Отправляем
                                </span>
                              ) : null}
                              {message.localState === "uploading" ? (
                                <span className="dm-message-meta-chip">
                                  Загрузка
                                  {typeof message.uploadProgress === "number"
                                    ? ` ${Math.round(message.uploadProgress * 100)}%`
                                    : ""}
                                </span>
                              ) : null}
                              {message.localState === "failed" ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-300">
                                  <AlertCircle size={14} strokeWidth={1.5} />
                                  Ошибка
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="relative">
                            {canManageMessage ? (
                              <button
                                type="button"
                                data-dm-menu-trigger="true"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  const rect = event.currentTarget.getBoundingClientRect();
                                  openDesktopContextMenu(
                                    message.id,
                                    rect.right - contextMenuWidth,
                                    rect.bottom + 6,
                                  );
                                }}
                                disabled={isDeleting === message.id}
                                className={cn(
                                  "dm-action-button absolute -left-9 top-1/2 hidden h-7 w-7 -translate-y-1/2 opacity-0 focus-visible:opacity-100 md:inline-flex disabled:cursor-not-allowed disabled:opacity-50",
                                  (isContextMenuOpen || isDeleting === message.id) &&
                                    "opacity-100",
                                  "md:group-hover/message:opacity-100",
                                )}
                                aria-label="Действия с сообщением"
                              >
                                <MoreHorizontal size={15} strokeWidth={1.5} />
                              </button>
                            ) : null}

                            <div className={bubbleClassName}>
                              {isSticker && message.sticker ? (
                                <StickerAssetPreview
                                  sticker={message.sticker}
                                  className="aspect-square"
                                  imageClassName="pointer-events-none"
                                />
                              ) : isSticker ? (
                                <div className="flex aspect-square items-center justify-center px-4 text-center text-sm text-[var(--text-muted)]">
                                  Стикер недоступен
                                </div>
                              ) : isGif && message.gif ? (
                                <GifAssetPreview
                                  gif={message.gif}
                                  className="aspect-[4/3] rounded-[12px]"
                                  imageClassName="pointer-events-none"
                                  showBadge={false}
                                />
                              ) : isGif ? (
                                <div className="flex aspect-[4/3] items-center justify-center px-4 text-center text-sm text-[var(--text-muted)]">
                                  GIF недоступен
                                </div>
                              ) : isMediaAttachment && message.attachment ? (
                                <EmbeddedMediaBubble
                                  kind={
                                    message.attachment.kind === "VIDEO"
                                      ? "VIDEO"
                                      : "IMAGE"
                                  }
                                  previewUrl={
                                    message.localAttachmentPreviewUrl ??
                                    (message.attachment.hasPreview
                                      ? getDirectMessageAttachmentPreviewUrl(message.attachment)
                                      : getDirectMessageAttachmentAssetUrl(message.attachment))
                                  }
                                  playableUrl={
                                    message.attachment.kind === "VIDEO"
                                      ? message.localAttachmentAssetUrl ??
                                        getDirectMessageAttachmentAssetUrl(message.attachment)
                                      : null
                                  }
                                  posterUrl={
                                    message.attachment.hasPreview
                                      ? getDirectMessageAttachmentPreviewUrl(message.attachment)
                                      : message.localAttachmentPreviewUrl ?? null
                                  }
                                  href={
                                    message.localAttachmentAssetUrl ??
                                    getDirectMessageAttachmentAssetUrl(message.attachment)
                                  }
                                  label={
                                    message.attachment.kind === "VIDEO" ? "Видео" : "Фото"
                                  }
                                  className="w-[min(248px,72vw)]"
                                />
                              ) : isFileAttachment && message.attachment ? (
                                <a
                                  href={
                                    message.localAttachmentAssetUrl ??
                                    getDirectMessageAttachmentAssetUrl(message.attachment)
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className={cn(
                                    "dm-file-card block rounded-[18px] px-3 py-3 text-left transition-colors hover:bg-white/[0.05]",
                                    isOwn && "ml-auto",
                                  )}
                                >
                                  <p className="truncate text-sm font-medium text-white">
                                    {message.attachment.originalName}
                                  </p>
                                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                                    Документ • {formatFileSize(message.attachment.fileSize)}
                                  </p>
                                </a>
                              ) : (
                                <div className={cn("grid gap-2", !showText && !shouldRenderInlineEmbed && "gap-0")}>
                                  {showText ? (
                                    <p
                                      className={cn(
                                        "dm-message-text",
                                        isExpressiveEmoji && "dm-message-text-expressive",
                                      )}
                                    >
                                      <InlineCustomEmojiText
                                        text={visibleText ?? ""}
                                        customEmojis={customEmojis}
                                      />
                                    </p>
                                  ) : null}
                                  {shouldRenderInlineEmbed && message.linkEmbed ? (
                                    <LinkEmbedCard
                                      embed={message.linkEmbed}
                                      messageCreatedAt={message.createdAt}
                                      className={cn(
                                        "w-[min(248px,72vw)]",
                                        isOwn && "ml-auto",
                                      )}
                                    />
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>

                          {message.localState === "failed" ? (
                            <div
                              className={cn(
                                "mt-1 flex items-center gap-2 text-[11px]",
                                isOwn ? "justify-end" : "justify-start",
                              )}
                            >
                              <span className="text-[var(--text-muted)]">
                                Не доставлено
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void onRetry(message.id)}
                                className="h-7 gap-1 rounded-full px-2 text-[var(--text-soft)]"
                              >
                                <RotateCcw size={14} strokeWidth={1.5} />
                                Повторить
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {contextMenuMarkup}
    </>
  );
}
