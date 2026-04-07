"use client";

import type { CustomEmojiAsset, DirectConversationDetail } from "@lobby/shared";
import { AlertCircle, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { GifAssetPreview } from "./gif-asset-preview";
import { InlineCustomEmojiText } from "./inline-custom-emoji-text";
import { StickerAssetPreview } from "./sticker-asset-preview";

export type ThreadMessageItem =
  DirectConversationDetail["conversation"]["messages"][number] & {
    localState?: "sending" | "failed";
  };

interface MessageThreadProps {
  viewerId: string;
  messages: ThreadMessageItem[];
  isDeleting: string | null;
  lastReadAt: string | null;
  customEmojis: CustomEmojiAsset[];
  onDelete: (messageId: string) => Promise<void>;
  onRetry: (messageId: string) => Promise<void>;
}

type ThreadGroup = { label: string; items: ThreadMessageItem[] };
type ContextMenuState = { messageId: string; x: number; y: number };

const iconProps = { size: 18, strokeWidth: 1.5 } as const;
const contextMenuWidth = 196;
const contextMenuMargin = 12;

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

export function MessageThread({
  viewerId,
  messages,
  isDeleting,
  lastReadAt,
  customEmojis,
  onDelete,
  onRetry,
}: MessageThreadProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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

  function openContextMenu(messageId: string, x: number, y: number) {
    const position = clampContextMenuPosition(x, y);

    setContextMenu({
      messageId,
      x: position.x,
      y: position.y,
    });
  }

  async function handleDeleteFromMenu(messageId: string) {
    setContextMenu(null);
    await onDelete(messageId);
  }

  const contextMenuMarkup =
    contextMenu && typeof document !== "undefined"
      ? createPortal(
          <div
            data-dm-context-menu="true"
            className="fixed z-[90] w-[196px] rounded-[14px] border border-white/8 bg-[rgba(10,14,20,0.98)] p-1.5 shadow-[0_18px_40px_rgba(2,6,12,0.42)]"
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
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={viewportRef}
        className="h-full min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.04),transparent_18%),transparent]"
      >
        {messages.length === 0 ? (
          <div className="empty-state-minimal text-[var(--text-muted)]">
            <p className="text-sm">Сообщений пока нет.</p>
          </div>
        ) : (
          <div className="space-y-2 px-3 py-3">
            {groupedMessages.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <div className="flex items-center gap-3 py-0.5">
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                {group.items.map((message, index) => {
                  const globalIndex = messageIndexById.get(message.id) ?? -1;
                  const isOwn = message.author.id === viewerId;
                  const isSticker = message.type === "STICKER";
                  const isGif = message.type === "GIF";
                  const isVisualMessage = isSticker || isGif;
                  const previousMessage = group.items[index - 1];
                  const continuation = isContinuation(previousMessage, message);
                  const isUnreadMarker = unreadIndex >= 0 && globalIndex === unreadIndex;
                  const canManageMessage =
                    isOwn && !message.localState && message.canDelete;
                  const isContextMenuOpen = contextMenu?.messageId === message.id;
                  const bubbleClassName = cn(
                    "relative rounded-[17px] border px-3 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-[border-color,background,box-shadow] duration-150",
                    isVisualMessage && "border-transparent bg-transparent px-0 py-0 shadow-none",
                    isOwn
                      ? "ml-auto border-[rgba(106,168,248,0.15)] bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent_46%),rgba(88,132,191,0.15)] group-hover/message:border-[rgba(106,168,248,0.22)] group-hover/message:bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_46%),rgba(92,139,201,0.17)]"
                      : "border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.016),transparent_46%),rgba(255,255,255,0.04)] group-hover/message:border-white/[0.1] group-hover/message:bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_46%),rgba(255,255,255,0.052)]",
                    continuation && !isVisualMessage && "rounded-[15px] py-1.5",
                    isContextMenuOpen &&
                      !isVisualMessage &&
                      (isOwn
                        ? "border-[rgba(106,168,248,0.3)] bg-[linear-gradient(180deg,rgba(255,255,255,0.022),transparent_44%),rgba(96,145,210,0.22)] shadow-[0_10px_24px_rgba(8,16,28,0.14)]"
                        : "border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.024),transparent_44%),rgba(255,255,255,0.07)] shadow-[0_10px_24px_rgba(8,16,28,0.12)]"),
                    message.localState === "failed" &&
                      "border-amber-400/30 bg-amber-400/10",
                  );

                  return (
                    <div key={message.id}>
                      {isUnreadMarker ? (
                        <div className="mb-2 flex items-center gap-3 py-0.5">
                          <div className="h-px flex-1 bg-[color:var(--accent)]/35" />
                          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--accent)]">
                            Новое
                          </span>
                          <div className="h-px flex-1 bg-[color:var(--accent)]/35" />
                        </div>
                      ) : null}

                      <div
                        className={cn(
                          "group/message flex gap-2.5 py-0.5",
                          continuation && "mt-[-1px]",
                          isOwn && "flex-row-reverse",
                        )}
                        onContextMenu={
                          canManageMessage
                            ? (event) => {
                                event.preventDefault();
                                openContextMenu(message.id, event.clientX, event.clientY);
                              }
                            : undefined
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
                              ? "min-w-0 max-w-[min(340px,100%)] flex-1"
                              : "min-w-0 max-w-[min(76ch,100%)] flex-1",
                            isOwn && "text-right",
                          )}
                        >
                          {!continuation ? (
                            <div
                              className={cn(
                                "mb-1 flex items-center gap-2",
                                isOwn && "justify-end",
                              )}
                            >
                              <p className="text-sm font-medium tracking-tight text-white">
                                {message.author.profile.displayName}
                              </p>
                              <span className="text-[11px] text-[var(--text-muted)]">
                                {formatThreadTime(message.createdAt)}
                              </span>
                              {message.localState === "sending" ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/6 bg-white/[0.03] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                                  Отправляем
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
                                  openContextMenu(
                                    message.id,
                                    rect.right - contextMenuWidth,
                                    rect.bottom + 6,
                                  );
                                }}
                                disabled={isDeleting === message.id}
                                className={cn(
                                  "absolute -left-9 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/6 bg-[rgba(10,14,20,0.9)] text-[var(--text-muted)] opacity-0 transition-all hover:border-white/10 hover:bg-[rgba(20,28,40,0.96)] hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(106,168,248,0.22)] disabled:cursor-not-allowed disabled:opacity-50",
                                  (isContextMenuOpen || isDeleting === message.id) &&
                                    "opacity-100",
                                  "group-hover/message:opacity-100",
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
                                  className="aspect-square rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.12),transparent_55%),rgba(255,255,255,0.03)]"
                                  imageClassName="pointer-events-none"
                                />
                              ) : isSticker ? (
                                <div className="flex aspect-square items-center justify-center rounded-[24px] border border-white/8 bg-white/[0.03] px-4 text-center text-sm text-[var(--text-muted)]">
                                  Стикер недоступен
                                </div>
                              ) : isGif && message.gif ? (
                                <GifAssetPreview
                                  gif={message.gif}
                                  className="aspect-[4/3] rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.1),transparent_55%),rgba(255,255,255,0.03)]"
                                  imageClassName="pointer-events-none"
                                  showBadge
                                />
                              ) : isGif ? (
                                <div className="flex aspect-[4/3] items-center justify-center rounded-[24px] border border-white/8 bg-white/[0.03] px-4 text-center text-sm text-[var(--text-muted)]">
                                  GIF недоступен
                                </div>
                              ) : (
                                <p className="text-[13px] leading-[1.42] text-white">
                                  <InlineCustomEmojiText
                                    text={message.content ?? ""}
                                    customEmojis={customEmojis}
                                  />
                                </p>
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
