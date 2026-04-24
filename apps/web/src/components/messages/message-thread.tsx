"use client";

import type {
  CallSummary,
  CustomEmojiAsset,
  DirectConversationDetail,
  DirectMessageReplyPreview,
} from "@lobby/shared";
import {
  AlertCircle,
  Check,
  CheckCheck,
  MoreHorizontal,
  PhoneCall,
  Reply,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { isDirectMessageVideoNote } from "@/lib/direct-message-video-notes";
import {
  getDirectMessageAttachmentAssetUrl,
  getDirectMessageAttachmentDownloadUrl,
  getDirectMessageAttachmentPreviewUrl,
  getDirectMessageAttachmentStreamUrl,
} from "@/lib/direct-message-attachments";
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
  callEvents?: CallSummary[];
  isDeleting: string | null;
  lastReadAt: string | null;
  counterpartLastReadAt: string | null;
  customEmojis: CustomEmojiAsset[];
  forceScrollToBottomToken?: number;
  searchQuery?: string;
  onReply: (messageId: string) => void;
  onDelete: (messageId: string) => Promise<void>;
  onRetry: (messageId: string) => Promise<void>;
}

type ThreadTimelineItem =
  | { kind: "message"; message: ThreadMessageItem; createdAt: string }
  | { kind: "call"; call: CallSummary; createdAt: string };
type ThreadGroup = { label: string; items: ThreadTimelineItem[] };
type ContextMenuState =
  | { mode: "floating"; messageId: string; x: number; y: number }
  | { mode: "sheet"; messageId: string };

const contextMenuWidth = 184;
const contextMenuMargin = 12;
const contextMenuGap = 10;
const pendingEmbedStaleAfterMs = 60_000;
const mobileViewportQuery = "(max-width: 767px)";
const mobileActionPressDelayMs = 420;
const mobileActionMoveThresholdPx = 14;
const messageReactionOptions = [
  "😀",
  "😎",
  "🙂",
  "😉",
  "🤝",
  "🔥",
  "✨",
  "❤️",
  "👀",
];

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

function formatAttachmentDuration(durationMs: number | null | undefined) {
  if (!durationMs || durationMs < 0) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatCallDuration(call: CallSummary) {
  if (!call.acceptedAt || !call.endedAt) {
    return null;
  }

  const startedAt = new Date(call.acceptedAt).getTime();
  const endedAt = new Date(call.endedAt).getTime();

  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;

    return `${hours}:${String(restMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getCallTimelineTimestamp(call: CallSummary) {
  return call.endedAt ?? call.acceptedAt ?? call.createdAt;
}

function getCallTimelineCopy(call: CallSummary, viewerId: string) {
  const isIncoming = call.initiatedBy.id !== viewerId;
  const modeLabel = call.mode === "VIDEO" ? "видеозвонок" : "звонок";
  const duration = formatCallDuration(call);

  if (call.status === "MISSED") {
    return {
      title: isIncoming ? "Пропущенный звонок" : "Исходящий звонок без ответа",
      meta: modeLabel,
    };
  }

  if (call.status === "DECLINED") {
    return {
      title: isIncoming ? "Входящий звонок отклонён" : "Звонок отклонён",
      meta: modeLabel,
    };
  }

  if (call.status === "ENDED") {
    return {
      title: "Звонок завершён",
      meta: duration ? `${modeLabel} · ${duration}` : modeLabel,
    };
  }

  if (call.status === "ACCEPTED") {
    return {
      title: "Идёт звонок",
      meta: modeLabel,
    };
  }

  return {
    title: isIncoming ? "Входящий звонок" : "Исходящий звонок",
    meta: modeLabel,
  };
}

function buildSearchableMessageText(message: ThreadMessageItem) {
  const parts = [
    message.author.profile.displayName,
    message.author.username,
    message.content,
    message.sticker?.title,
    message.gif?.title,
    message.attachment?.originalName,
    message.replyTo?.content,
    message.replyTo?.attachment?.originalName,
  ];

  return parts
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
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

function getTriggerContextMenuPosition(
  triggerRect: DOMRect,
  isOwnMessage: boolean,
) {
  if (typeof window === "undefined") {
    return {
      x: triggerRect.right + contextMenuGap,
      y: triggerRect.top,
    };
  }

  const openLeft = triggerRect.left - contextMenuWidth - contextMenuGap;
  const openRight = triggerRect.right + contextMenuGap;
  const hasRoomLeft = openLeft >= contextMenuMargin;
  const hasRoomRight =
    openRight + contextMenuWidth <= window.innerWidth - contextMenuMargin;
  const x =
    isOwnMessage && hasRoomLeft
      ? openLeft
      : !isOwnMessage && hasRoomRight
        ? openRight
        : hasRoomRight
          ? openRight
          : openLeft;

  return clampContextMenuPosition(
    x,
    triggerRect.top + triggerRect.height / 2 - 28,
  );
}

function primeRoundVideoNotePreview(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "true");
}

function isVideoMostlyVisibleWithinViewport(
  video: HTMLVideoElement,
  viewport: HTMLDivElement,
) {
  const videoRect = video.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const intersectionWidth =
    Math.min(videoRect.right, viewportRect.right) -
    Math.max(videoRect.left, viewportRect.left);
  const intersectionHeight =
    Math.min(videoRect.bottom, viewportRect.bottom) -
    Math.max(videoRect.top, viewportRect.top);

  if (intersectionWidth <= 0 || intersectionHeight <= 0) {
    return false;
  }

  const visibleArea = intersectionWidth * intersectionHeight;
  const totalArea = Math.max(1, videoRect.width * videoRect.height);

  return visibleArea / totalArea >= 0.35;
}

function buildMessageActionPreview(message: ThreadMessageItem) {
  const content = message.content?.trim();

  if (content) {
    return content;
  }

  if (message.type === "STICKER") {
    return message.sticker?.title
      ? `Стикер: ${message.sticker.title}`
      : "Стикер";
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

function buildReplyPreviewText(message: DirectMessageReplyPreview) {
  if (message.isDeleted) {
    return "Сообщение удалено";
  }

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
  callEvents = [],
  isDeleting,
  lastReadAt,
  counterpartLastReadAt,
  customEmojis,
  forceScrollToBottomToken = 0,
  searchQuery = "",
  onReply,
  onDelete,
  onRetry,
}: MessageThreadProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [messageReactions, setMessageReactions] = useState<
    Record<string, string[]>
  >({});
  const [, setPendingEmbedTick] = useState(0);
  const messageElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const longPressTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const longPressPointerRef = useRef<{
    messageId: string;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressNextClickMessageIdRef = useRef<string | null>(null);
  const groupedMessages = useMemo(() => {
    const timelineItems = [
      ...messages.map((message) => ({
        kind: "message" as const,
        message,
        createdAt: message.createdAt,
      })),
      ...callEvents.map((call) => ({
        kind: "call" as const,
        call,
        createdAt: getCallTimelineTimestamp(call),
      })),
    ].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );

    return timelineItems.reduce<ThreadGroup[]>(
      (accumulator: ThreadGroup[], item: ThreadTimelineItem) => {
        const label = formatThreadDate(item.createdAt);
        const group = accumulator[accumulator.length - 1];

        if (group && group.label === label) {
          group.items.push(item);
          return accumulator;
        }

        accumulator.push({ label, items: [item] });
        return accumulator;
      },
      [],
    );
  }, [callEvents, messages]);
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
              new Date(message.createdAt).getTime() >
                new Date(lastReadAt).getTime(),
          ),
    [lastReadAt, messages, viewerId],
  );
  const counterpartLastReadTimestamp = useMemo(() => {
    if (!counterpartLastReadAt) {
      return null;
    }

    const timestamp = new Date(counterpartLastReadAt).getTime();

    return Number.isFinite(timestamp) ? timestamp : null;
  }, [counterpartLastReadAt]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const didInitScrollRef = useRef(false);
  const forcedScrollFrameRef = useRef<number | null>(null);
  const forcedScrollTimeoutRef = useRef<number | null>(null);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const activeContextMenu =
    contextMenu &&
    messages.some((message) => message.id === contextMenu.messageId)
      ? contextMenu
      : null;
  const contextMenuMessage = activeContextMenu
    ? (messages.find((message) => message.id === activeContextMenu.messageId) ??
      null)
    : null;
  const canUsePortal = typeof document !== "undefined";
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

  const scrollViewportToBottom = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, []);

  const scheduleScrollToBottom = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (forcedScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(forcedScrollFrameRef.current);
    }

    if (forcedScrollTimeoutRef.current !== null) {
      window.clearTimeout(forcedScrollTimeoutRef.current);
      forcedScrollTimeoutRef.current = null;
    }

    forcedScrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollViewportToBottom();

      forcedScrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollViewportToBottom();
        forcedScrollFrameRef.current = null;
      });
    });

    forcedScrollTimeoutRef.current = window.setTimeout(() => {
      scrollViewportToBottom();
      forcedScrollTimeoutRef.current = null;
    }, 120);
  }, [scrollViewportToBottom]);

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

      if (forcedScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(forcedScrollFrameRef.current);
      }

      if (forcedScrollTimeoutRef.current !== null) {
        window.clearTimeout(forcedScrollTimeoutRef.current);
      }

      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (forceScrollToBottomToken <= 0) {
      return;
    }

    scheduleScrollToBottom();

    return () => {
      if (forcedScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(forcedScrollFrameRef.current);
        forcedScrollFrameRef.current = null;
      }

      if (forcedScrollTimeoutRef.current !== null) {
        window.clearTimeout(forcedScrollTimeoutRef.current);
        forcedScrollTimeoutRef.current = null;
      }
    };
  }, [forceScrollToBottomToken, scheduleScrollToBottom]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    if (messages.length === 0 && callEvents.length === 0) {
      return;
    }

    if (!didInitScrollRef.current) {
      scheduleScrollToBottom();
      didInitScrollRef.current = true;
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    if (distanceFromBottom < 160) {
      scheduleScrollToBottom();
    }
  }, [callEvents, messages, scheduleScrollToBottom]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (
      !viewport ||
      typeof ResizeObserver === "undefined" ||
      (messages.length === 0 && callEvents.length === 0)
    ) {
      return;
    }

    const observer = new ResizeObserver(() => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

      if (!didInitScrollRef.current || distanceFromBottom < 200) {
        scheduleScrollToBottom();
      }
    });

    observer.observe(viewport);

    if (viewport.firstElementChild instanceof HTMLElement) {
      observer.observe(viewport.firstElementChild);
    }

    return () => {
      observer.disconnect();
    };
  }, [callEvents.length, messages.length, scheduleScrollToBottom]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport || typeof window === "undefined") {
      return;
    }

    let syncFrame: number | null = null;

    const syncRoundVideoNotePlayback = () => {
      syncFrame = null;

      const roundVideoPreviews = viewport.querySelectorAll<HTMLVideoElement>(
        ".dm-video-note-bubble video[data-dm-preview-video='true']",
      );

      roundVideoPreviews.forEach((video) => {
        if (!isVideoMostlyVisibleWithinViewport(video, viewport)) {
          return;
        }

        primeRoundVideoNotePreview(video);
        void video.play().catch(() => undefined);
      });
    };

    const requestSync = () => {
      if (syncFrame !== null) {
        window.cancelAnimationFrame(syncFrame);
      }

      syncFrame = window.requestAnimationFrame(syncRoundVideoNotePlayback);
    };

    const handleVisibilityChange = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      requestSync();
    };

    requestSync();
    viewport.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      viewport.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (syncFrame !== null) {
        window.cancelAnimationFrame(syncFrame);
      }
    };
  }, [messages]);

  useEffect(() => {
    const pendingMessage = messages
      .filter((message) => message.linkEmbed?.status === "PENDING")
      .sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
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

    const timer = window.setTimeout(() => {
      setPendingEmbedTick((current) => current + 1);
    }, timeoutMs || 0);

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
    if (!activeContextMenu) {
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
  }, [activeContextMenu]);

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
    canOpenMessageActions: boolean,
  ) {
    if (!canOpenMessageActions) {
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
    canOpenMessageActions: boolean,
  ) {
    if (
      !isMobileViewport ||
      !canOpenMessageActions ||
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

  function handleReplyFromMenu(messageId: string) {
    setContextMenu(null);
    onReply(messageId);
  }

  function handleReactionFromMenu(messageId: string, reaction: string) {
    setMessageReactions((current) => {
      const existing = current[messageId] ?? [];
      const next = existing.includes(reaction)
        ? existing.filter((item) => item !== reaction)
        : [...existing, reaction];

      return {
        ...current,
        [messageId]: next,
      };
    });
    setContextMenu(null);
  }

  function focusOriginalMessage(messageId: string) {
    const element = messageElementRefs.current.get(messageId);

    if (!element) {
      return;
    }

    element.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
    setHighlightedMessageId(messageId);

    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedMessageId(null);
      highlightTimerRef.current = null;
    }, 1600);
  }

  const contextMenuMarkup =
    canUsePortal && activeContextMenu && contextMenuMessage
      ? createPortal(
          activeContextMenu.mode === "sheet" ? (
            <div className="fixed inset-0 z-[92] md:hidden">
              <button
                type="button"
                aria-label="Закрыть действия с сообщением"
                onClick={() => setContextMenu(null)}
                className="absolute inset-0 bg-black/80"
              />
              <div
                data-dm-context-menu="true"
                className="absolute inset-x-3 bottom-[calc(var(--app-mobile-dock-clearance)+0.5rem)] rounded-[24px] border border-white/10 bg-black px-3 pb-3 pt-2.5 shadow-[0_22px_48px_rgba(2,6,12,0.52)]"
              >
                <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/10" />

                <div className="rounded-[18px] border border-white/8 bg-black px-3 py-3">
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
                  <div className="grid grid-cols-9 gap-1 rounded-[18px] border border-white/8 bg-black p-2">
                    {messageReactionOptions.map((reaction) => (
                      <button
                        key={reaction}
                        type="button"
                        onClick={() =>
                          handleReactionFromMenu(
                            activeContextMenu.messageId,
                            reaction,
                          )
                        }
                        className="flex h-9 items-center justify-center rounded-[12px] text-lg transition-colors hover:bg-[var(--bg-hover)]"
                        aria-label={`Реакция ${reaction}`}
                      >
                        {reaction}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleReplyFromMenu(activeContextMenu.messageId)
                    }
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-black"
                  >
                    <Reply size={18} strokeWidth={1.7} />
                    Ответить
                  </button>
                  {contextMenuMessage.canDelete ? (
                    <button
                      type="button"
                      onClick={() =>
                        void handleDeleteFromMenu(activeContextMenu.messageId)
                      }
                      disabled={isDeleting === activeContextMenu.messageId}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-rose-400/18 bg-black px-4 text-sm font-medium text-rose-50 transition-colors hover:border-rose-300/24 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 size={18} strokeWidth={1.7} />
                      {isDeleting === activeContextMenu.messageId
                        ? "Удаляем..."
                        : "Удалить"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setContextMenu(null)}
                    className="flex min-h-11 w-full items-center justify-center rounded-[16px] border border-white/8 bg-black px-4 text-sm text-[var(--text-soft)] transition-colors hover:bg-black"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              data-dm-context-menu="true"
              className="dm-context-menu fixed z-[90] hidden md:block"
              style={{
                left: activeContextMenu.x,
                top: activeContextMenu.y,
              }}
            >
              <div className="dm-context-menu-header">
                <span>Действия</span>
                <span>{formatThreadTime(contextMenuMessage.createdAt)}</span>
              </div>
              <div className="grid grid-cols-5 gap-1 border-b border-[var(--border-soft)] p-1.5">
                {messageReactionOptions.slice(0, 5).map((reaction) => (
                  <button
                    key={reaction}
                    type="button"
                    onClick={() =>
                      handleReactionFromMenu(activeContextMenu.messageId, reaction)
                    }
                    className="flex h-8 items-center justify-center rounded-[10px] text-base transition-colors hover:bg-[var(--bg-hover)]"
                    aria-label={`Реакция ${reaction}`}
                  >
                    {reaction}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  handleReplyFromMenu(activeContextMenu.messageId)
                }
                className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-sm text-[var(--text-soft)] transition-colors hover:bg-black"
              >
                <Reply size={16} strokeWidth={1.5} />
                Ответить
              </button>
              {contextMenuMessage.canDelete ? (
                <button
                  type="button"
                  onClick={() =>
                    void handleDeleteFromMenu(activeContextMenu.messageId)
                  }
                  disabled={isDeleting === activeContextMenu.messageId}
                  className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-sm text-rose-100 transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={16} strokeWidth={1.5} />
                  {isDeleting === activeContextMenu.messageId
                    ? "Удаляем..."
                    : "Удалить"}
                </button>
              ) : null}
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
        {messages.length === 0 && callEvents.length === 0 ? (
          <div className="empty-state-minimal text-[var(--text-muted)]">
            <p className="text-sm">Сообщений пока нет.</p>
          </div>
        ) : (
          <div className="dm-thread-stack relative z-[1] space-y-3 px-4 pb-8 pt-4 md:px-7 md:pb-8 md:pt-5">
            {groupedMessages.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="flex justify-center py-1">
                  <span className="dm-date-separator">{group.label}</span>
                </div>

                {group.items.map((item) => {
                  if (item.kind === "call") {
                    const copy = getCallTimelineCopy(item.call, viewerId);

                    return (
                      <div
                        key={`call:${item.call.id}:${item.call.status}`}
                        className="dm-call-event-row"
                      >
                        <div className="dm-call-event">
                          <span className="dm-call-event-icon" aria-hidden="true">
                            <PhoneCall size={14} strokeWidth={1.55} />
                          </span>
                          <span className="dm-call-event-title">{copy.title}</span>
                          <span className="dm-call-event-meta">
                            {copy.meta} · {formatThreadTime(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  const message = item.message;
                  const globalIndex = messageIndexById.get(message.id) ?? -1;
                  const isOwn = message.author.id === viewerId;
                  const isSticker = message.type === "STICKER";
                  const isGif = message.type === "GIF";
                  const isMediaAttachment =
                    message.type === "MEDIA" && message.attachment !== null;
                  const isFileAttachment =
                    message.type === "FILE" && message.attachment !== null;
                  const isRoundVideoNote =
                    isMediaAttachment &&
                    isDirectMessageVideoNote(message.attachment);
                  const isMediaLikeMessage =
                    isSticker || isGif || isMediaAttachment || isFileAttachment;
                  const hasReplyPreview = message.replyTo !== null;
                  const hasAttachmentCaption = Boolean(message.content?.trim());
                  const isBareMediaMessage =
                    (isSticker || isGif || isMediaAttachment) &&
                    !hasReplyPreview &&
                    !hasAttachmentCaption;
                  const isBareFramedMediaMessage =
                    isBareMediaMessage && isMediaAttachment && !isRoundVideoNote;
                  const isVisualMessage =
                    isSticker || isGif || isMediaAttachment;
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
                    isStandaloneEmbeddableMessage(
                      message.content,
                      message.linkEmbed,
                    );
                  const visibleText =
                    shouldRenderInlineEmbed && message.linkEmbed
                      ? stripEmbeddableLinkText(
                          message.content,
                          message.linkEmbed.sourceUrl,
                        )
                      : message.content;
                  const showText = !isStandaloneEmbed && Boolean(visibleText);
                  const isExpressiveEmoji =
                    !isMediaLikeMessage &&
                    !message.linkEmbed &&
                    isExpressiveEmojiMessage(visibleText);
                  const previousMessage =
                    globalIndex > 0 ? messages[globalIndex - 1] : undefined;
                  const continuation = isContinuation(previousMessage, message);
                  const isUnreadMarker =
                    unreadIndex >= 0 && globalIndex === unreadIndex;
                  const canOpenMessageActions =
                    !message.localState && !message.isDeleted;
                  const isContextMenuOpen =
                    activeContextMenu?.messageId === message.id;
                  const isDelivered =
                    isOwn && !message.localState && !message.isDeleted;
                  const reactions = messageReactions[message.id] ?? [];
                  const isReadByCounterpart =
                    isDelivered &&
                    counterpartLastReadTimestamp !== null &&
                    new Date(message.createdAt).getTime() <=
                      counterpartLastReadTimestamp;
                  const mediaAspectRatio =
                    isMediaAttachment &&
                    message.attachment?.width &&
                    message.attachment?.height
                      ? message.attachment.width / message.attachment.height
                      : null;
                  const embedAspectRatio =
                    message.linkEmbed?.aspectRatio ??
                    (message.linkEmbed?.width && message.linkEmbed?.height
                      ? message.linkEmbed.width / message.linkEmbed.height
                      : null);
                  const isWideMediaPreview =
                    Boolean(mediaAspectRatio && mediaAspectRatio > 1.2) ||
                    Boolean(embedAspectRatio && embedAspectRatio > 1.2);
                  const showAuthorLabel = !isOwn && !continuation;
                  const messageWidthClassName = cn(
                    "relative min-w-0",
                    isRoundVideoNote
                      ? "w-[min(244px,74vw)] max-w-full"
                      : isMediaLikeMessage
                        ? "w-fit max-w-[min(388px,74%)]"
                        : "max-w-[min(360px,72%)]",
                    isOwn && "ml-auto",
                  );
                  const bubbleClassName = cn(
                    "dm-bubble",
                    isBareMediaMessage &&
                      !isBareFramedMediaMessage &&
                      "border-transparent bg-transparent p-0 shadow-none",
                    isBareFramedMediaMessage &&
                      (isOwn ? "dm-media-frame dm-media-frame-own" : "dm-media-frame"),
                    !isBareMediaMessage &&
                      (isOwn ? "dm-bubble-out" : "dm-bubble-in"),
                    continuation &&
                      !isBareMediaMessage &&
                      "py-[0.58rem]",
                    isContextMenuOpen &&
                      !isBareMediaMessage &&
                      "dm-bubble-highlight",
                    highlightedMessageId === message.id &&
                      "dm-bubble-highlight",
                    message.localState === "failed" &&
                      "border-amber-400/22 bg-amber-400/10",
                    normalizedSearchQuery &&
                      matchingMessageIds.has(message.id) &&
                      !isBareMediaMessage &&
                      "dm-bubble-highlight",
                  );
                  const messageFooter = (
                    <div
                      className={cn(
                        "dm-message-footer mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-none text-[var(--text-muted)]",
                        isOwn ? "justify-end" : "justify-start",
                        isBareMediaMessage &&
                          !isBareFramedMediaMessage &&
                          "mt-1 px-1.5",
                        isBareFramedMediaMessage &&
                          "dm-message-footer-overlay px-1",
                      )}
                    >
                      {message.localState === "sending" ? (
                        <span className="dm-message-meta-chip">Отправляем</span>
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
                      <span className="tabular-nums text-[var(--text-dim)]">
                        {formatThreadTime(message.createdAt)}
                      </span>
                      {isOwn && isDelivered ? (
                        <OutgoingMessageDeliveryStatus
                          isRead={isReadByCounterpart}
                        />
                      ) : null}
                    </div>
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
                          "group/message flex py-[3px]",
                          continuation && "mt-[-1px]",
                          isOwn
                            ? "justify-end pr-2 md:pr-5"
                            : "justify-start pl-2 md:pl-4",
                        )}
                        onContextMenu={(event) =>
                          handleMessageContextMenu(
                            event,
                            message.id,
                            canOpenMessageActions,
                          )
                        }
                        onPointerDown={(event) =>
                          handleMessagePointerDown(
                            event,
                            message.id,
                            canOpenMessageActions,
                          )
                        }
                        onPointerMove={handleMessagePointerMove}
                        onPointerUp={handleMessagePointerEnd}
                        onPointerCancel={handleMessagePointerEnd}
                        onPointerLeave={handleMessagePointerEnd}
                        onClickCapture={(event) =>
                          handleMessageClickCapture(event, message.id)
                        }
                      >
                        <div className={messageWidthClassName}>
                          {showAuthorLabel && isBareMediaMessage ? (
                            <p className="dm-message-author mb-1 px-1">
                              {message.author.profile.displayName}
                            </p>
                          ) : null}

                          <div className="relative">
                            {canOpenMessageActions ? (
                              <button
                                type="button"
                                data-dm-menu-trigger="true"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  const rect =
                                    event.currentTarget.getBoundingClientRect();
                                  const position =
                                    getTriggerContextMenuPosition(rect, isOwn);
                                  openDesktopContextMenu(
                                    message.id,
                                    position.x,
                                    position.y,
                                  );
                                }}
                                disabled={isDeleting === message.id}
                                className={cn(
                                  "dm-action-button absolute top-1/2 hidden h-7 w-7 -translate-y-1/2 opacity-0 focus-visible:opacity-100 md:inline-flex disabled:cursor-not-allowed disabled:opacity-50",
                                  isOwn ? "-left-10" : "-right-10",
                                  (isContextMenuOpen ||
                                    isDeleting === message.id) &&
                                    "opacity-100",
                                  "md:group-hover/message:opacity-100",
                                )}
                                aria-label="Действия с сообщением"
                                style={{ height: 28, width: 28 }}
                              >
                                <MoreHorizontal size={15} strokeWidth={1.5} />
                              </button>
                            ) : null}

                            <div className={bubbleClassName}>
                              {showAuthorLabel && !isBareMediaMessage ? (
                                <p className="dm-message-author mb-1.5">
                                  {message.author.profile.displayName}
                                </p>
                              ) : null}
                              {message.replyTo ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    focusOriginalMessage(message.replyTo!.id)
                                  }
                                  className="mb-2.5 grid w-full min-w-0 gap-0.5 rounded-[14px] border border-white/5 bg-black/18 px-3 py-2 text-left transition-colors hover:bg-black/24"
                                >
                                  <span className="truncate text-[11px] font-medium text-[var(--text-soft)]">
                                    {message.replyTo.author.profile.displayName}
                                  </span>
                                  <span className="truncate text-xs text-[var(--text-dim)]">
                                    {buildReplyPreviewText(message.replyTo)}
                                  </span>
                                </button>
                              ) : null}
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
                                <div
                                  className={cn("relative", isOwn && "ml-auto")}
                                >
                                  <EmbeddedMediaBubble
                                    kind={
                                      message.attachment.kind === "VIDEO"
                                        ? "VIDEO"
                                        : "IMAGE"
                                    }
                                    previewUrl={
                                      message.localAttachmentPreviewUrl ??
                                      (message.attachment.hasPreview
                                        ? getDirectMessageAttachmentPreviewUrl(
                                            message.attachment,
                                          )
                                        : getDirectMessageAttachmentAssetUrl(
                                            message.attachment,
                                          ))
                                    }
                                    playableUrl={
                                      message.attachment.kind === "VIDEO"
                                        ? (message.localAttachmentAssetUrl ??
                                          (isRoundVideoNote
                                            ? getDirectMessageAttachmentStreamUrl(
                                                message.attachment,
                                              )
                                            : getDirectMessageAttachmentAssetUrl(
                                                message.attachment,
                                              )))
                                        : null
                                    }
                                    viewerPlayableUrl={
                                      message.attachment.kind === "VIDEO"
                                        ? (message.localAttachmentAssetUrl ??
                                          getDirectMessageAttachmentAssetUrl(
                                            message.attachment,
                                          ))
                                        : null
                                    }
                                    posterUrl={
                                      message.attachment.hasPreview
                                        ? getDirectMessageAttachmentPreviewUrl(
                                            message.attachment,
                                          )
                                        : (message.localAttachmentPreviewUrl ??
                                          null)
                                    }
                                    href={
                                      message.localAttachmentAssetUrl ??
                                      getDirectMessageAttachmentAssetUrl(
                                        message.attachment,
                                      )
                                    }
                                    downloadUrl={
                                      message.attachment.kind === "IMAGE"
                                        ? (message.localAttachmentAssetUrl ??
                                          getDirectMessageAttachmentDownloadUrl(
                                            message.attachment,
                                          ))
                                        : null
                                    }
                                    downloadName={
                                      message.attachment.kind === "IMAGE"
                                        ? message.attachment.originalName
                                        : null
                                    }
                                    label={
                                      message.attachment.kind === "VIDEO"
                                        ? "Видео"
                                        : "Фото"
                                    }
                                    aspectRatio={
                                      isRoundVideoNote ? 1 : mediaAspectRatio
                                    }
                                    mediaFit={
                                      message.attachment.kind === "IMAGE" &&
                                      !isBareFramedMediaMessage
                                        ? "contain"
                                        : "cover"
                                    }
                                    className={
                                      isRoundVideoNote
                                        ? "dm-video-note-bubble"
                                        : isWideMediaPreview
                                          ? "dm-media-preview dm-media-preview-wide"
                                          : "dm-media-preview dm-media-preview-regular"
                                    }
                                    previewPlayback={
                                      isRoundVideoNote ? "always" : "visible"
                                    }
                                    previewPreload={
                                      isRoundVideoNote ? "auto" : "metadata"
                                    }
                                  />
                                  {isRoundVideoNote &&
                                  message.attachment.durationMs ? (
                                    <span className="dm-video-note-duration">
                                      {formatAttachmentDuration(
                                        message.attachment.durationMs,
                                      )}
                                    </span>
                                  ) : null}
                                  {message.content?.trim() ? (
                                    <div className="mt-2 max-w-[min(360px,72vw)] px-1">
                                      <p className="dm-message-text">
                                        <InlineCustomEmojiText
                                          text={message.content}
                                          customEmojis={customEmojis}
                                        />
                                      </p>
                                    </div>
                                  ) : null}
                                  {isBareFramedMediaMessage ? messageFooter : null}
                                </div>
                              ) : isFileAttachment && message.attachment ? (
                                <div className="grid gap-2">
                                  <a
                                    href={
                                      message.localAttachmentAssetUrl ??
                                      getDirectMessageAttachmentAssetUrl(
                                        message.attachment,
                                      )
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className={cn(
                                      "block max-w-[min(320px,72vw)] text-left transition-opacity hover:opacity-[0.98]",
                                      isOwn && "ml-auto",
                                    )}
                                  >
                                    <p className="truncate text-sm font-medium text-white">
                                      {message.attachment.originalName}
                                    </p>
                                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                                      Документ •{" "}
                                      {formatFileSize(
                                        message.attachment.fileSize,
                                      )}
                                    </p>
                                  </a>
                                  {message.content?.trim() ? (
                                    <p className="dm-message-text">
                                      <InlineCustomEmojiText
                                        text={message.content}
                                        customEmojis={customEmojis}
                                      />
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <div
                                  className={cn(
                                    "grid gap-2",
                                    !showText &&
                                      !shouldRenderInlineEmbed &&
                                      "gap-0",
                                  )}
                                >
                                  {showText ? (
                                    <p
                                      className={cn(
                                        "dm-message-text",
                                        isExpressiveEmoji &&
                                          "dm-message-text-expressive",
                                      )}
                                    >
                                      <InlineCustomEmojiText
                                        text={visibleText ?? ""}
                                        customEmojis={customEmojis}
                                      />
                                    </p>
                                  ) : null}
                                  {shouldRenderInlineEmbed &&
                                  message.linkEmbed ? (
                                    <LinkEmbedCard
                                      embed={message.linkEmbed}
                                      messageCreatedAt={message.createdAt}
                                      className={cn(
                                        isWideMediaPreview
                                          ? "w-[min(360px,74vw)]"
                                          : "w-[min(284px,72vw)]",
                                      )}
                                    />
                                  ) : null}
                                </div>
                              )}
                              {!isBareMediaMessage ? messageFooter : null}
                            </div>
                          </div>

                          {isBareMediaMessage && !isBareFramedMediaMessage
                            ? messageFooter
                            : null}

                          {reactions.length > 0 ? (
                            <div
                              className={cn(
                                "mt-1.5 flex flex-wrap gap-1 px-1",
                                isOwn ? "justify-end" : "justify-start",
                              )}
                            >
                              {reactions.map((reaction) => (
                                <button
                                  key={reaction}
                                  type="button"
                                  onClick={() =>
                                    handleReactionFromMenu(message.id, reaction)
                                  }
                                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-white/8 bg-black px-2 text-sm transition-colors hover:border-white/16 hover:bg-[var(--bg-hover)]"
                                  aria-label={`Убрать реакцию ${reaction}`}
                                >
                                  {reaction}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {message.localState === "failed" ? (
                            <div
                              className={cn(
                                "mt-1.5 flex items-center gap-2 px-1.5 text-[11px]",
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

function OutgoingMessageDeliveryStatus({ isRead }: { isRead: boolean }) {
  return isRead ? (
    <span
      className="dm-message-status dm-message-status-read"
      aria-label="Прочитано"
      title="Прочитано"
    >
      <CheckCheck size={13} strokeWidth={1.9} />
    </span>
  ) : (
    <span
      className="dm-message-status"
      aria-label="Доставлено"
      title="Доставлено"
    >
      <Check size={13} strokeWidth={1.9} />
    </span>
  );
}
