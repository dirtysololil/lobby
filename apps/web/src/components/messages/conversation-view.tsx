"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Info,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import {
  directConversationDetailSchema,
  directConversationSummaryResponseSchema,
  directMessageAttachmentUploadResponseSchema,
  directMessageResponseSchema,
  mediaPickerCatalogResponseSchema,
  type DirectConversationDetail,
  type DirectMessage,
  type MediaPickerCatalog,
  type UserRole,
} from "@lobby/shared";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { uploadDirectMessageAttachment } from "@/lib/direct-message-attachments";
import { DmCallPanel } from "@/components/calls/dm-call-panel";
import { buildUserProfileHref } from "@/lib/profile-routes";
import {
  useOptionalRealtimePresence,
  useRealtime,
} from "@/components/realtime/realtime-provider";
import { sortDirectMessages } from "@/lib/direct-message-state";
import { getAvailabilityLabel } from "@/lib/last-seen";
import { dispatchNotificationPreferencesEvent } from "@/lib/notification-preferences";
import { buildPendingLinkEmbed } from "@/lib/link-embeds";
import { dmRetentionLabels } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";
import { ConversationSettings } from "./conversation-settings";
import { MovableConversationInfoPanel } from "./movable-conversation-info-panel";
import {
  MessageComposer,
  type ComposerFileUploadMode,
  type ComposerSendPayload,
} from "./message-composer";
import { MessageThread, type ThreadMessageItem } from "./message-thread";

interface ConversationViewProps {
  conversationId: string;
  viewerId: string;
  viewerRole: UserRole;
}

type ConversationState = Omit<DirectConversationDetail["conversation"], "messages">;
type PendingReadState = {
  lastReadMessageId: string | null;
  lastReadAt: string | null;
};

type LoadConversationOptions = {
  markAsRead?: boolean;
  silent?: boolean;
};

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

function stripConversationMessages(
  conversation: DirectConversationDetail["conversation"],
): ConversationState {
  const { messages: hiddenMessages, ...meta } = conversation;
  void hiddenMessages;
  return meta;
}

function buildOptimisticMessage(args: {
  author: DirectConversationDetail["conversation"]["participants"][number]["user"];
  conversationId: string;
  payload: ComposerSendPayload;
  clientNonce: string;
}): ThreadMessageItem {
  const createdAt = new Date().toISOString();

  return {
    id: `temp:${args.clientNonce}`,
    conversationId: args.conversationId,
    type: args.payload.type,
    author: args.author,
    content: args.payload.type === "TEXT" ? args.payload.content : null,
    sticker: args.payload.type === "STICKER" ? args.payload.sticker : null,
    gif: args.payload.type === "GIF" ? args.payload.gif : null,
    attachment: null,
    linkEmbed:
      args.payload.type === "TEXT"
        ? buildPendingLinkEmbed(args.payload.content)
        : null,
    isDeleted: false,
    canDelete: true,
    deleteExpiresAt: null,
    clientNonce: args.clientNonce,
    createdAt,
    updatedAt: createdAt,
    localState: "sending",
  };
}

function buildOptimisticAttachmentMessage(args: {
  author: DirectConversationDetail["conversation"]["participants"][number]["user"];
  conversationId: string;
  file: File;
  clientNonce: string;
  localPreviewUrl: string | null;
  localAssetUrl: string | null;
}): ThreadMessageItem {
  const createdAt = new Date().toISOString();
  const inferredKind = inferAttachmentKind(args.file);

  return {
    id: `temp:${args.clientNonce}`,
    conversationId: args.conversationId,
    type: inferredKind === "DOCUMENT" ? "FILE" : "MEDIA",
    author: args.author,
    content: null,
    sticker: null,
    gif: null,
    attachment: {
      id: `temp-attachment:${args.clientNonce}`,
      kind: inferredKind,
      originalName: args.file.name || "attachment",
      mimeType: args.file.type || "application/octet-stream",
      fileSize: args.file.size,
      width: null,
      height: null,
      durationMs: null,
      hasPreview: inferredKind !== "DOCUMENT",
      createdAt,
      updatedAt: createdAt,
    },
    linkEmbed: null,
    isDeleted: false,
    canDelete: true,
    deleteExpiresAt: null,
    clientNonce: args.clientNonce,
    createdAt,
    updatedAt: createdAt,
    localState: "uploading",
    uploadProgress: 0,
    localAttachmentPreviewUrl: args.localPreviewUrl,
    localAttachmentAssetUrl: args.localAssetUrl,
    retryUploadFile: args.file,
  };
}

function mergeThreadMessage(
  items: ThreadMessageItem[],
  message: DirectMessage,
): ThreadMessageItem[] {
  const byIdIndex = items.findIndex((item) => item.id === message.id);

  if (byIdIndex >= 0) {
    const nextItems = [...items];
    nextItems[byIdIndex] = {
      ...nextItems[byIdIndex],
      ...message,
      localState: undefined,
    };

    return sortDirectMessages(nextItems);
  }

  if (message.clientNonce) {
    const byNonceIndex = items.findIndex(
      (item) => item.clientNonce && item.clientNonce === message.clientNonce,
    );

    if (byNonceIndex >= 0) {
      const nextItems = [...items];
      nextItems[byNonceIndex] = {
        ...nextItems[byNonceIndex],
        ...message,
        localState: undefined,
      };

      return sortDirectMessages(nextItems);
    }
  }

  return sortDirectMessages([
    ...items,
    {
      ...message,
      localState: undefined,
    },
  ]);
}

function mergeFetchedMessages(
  currentItems: ThreadMessageItem[],
  serverMessages: DirectMessage[],
): ThreadMessageItem[] {
  const nextItems: ThreadMessageItem[] = serverMessages.map((message) => {
    const byId = currentItems.find((item) => item.id === message.id);

    if (byId) {
      return {
        ...byId,
        ...message,
        localState: undefined,
        uploadProgress: undefined,
      };
    }

    if (message.clientNonce) {
      const byNonce = currentItems.find(
        (item) =>
          item.clientNonce !== null &&
          item.clientNonce !== undefined &&
          item.clientNonce === message.clientNonce,
      );

      if (byNonce) {
        return {
          ...byNonce,
          ...message,
          localState: undefined,
          uploadProgress: undefined,
        };
      }
    }

    return {
      ...message,
      localState: undefined,
    };
  });
  const serverMessageIds = new Set(serverMessages.map((message) => message.id));
  const serverClientNonces = new Set(
    serverMessages
      .map((message) => message.clientNonce)
      .filter((value): value is string => Boolean(value)),
  );

  for (const item of currentItems) {
    if (!item.localState) {
      continue;
    }

    if (serverMessageIds.has(item.id)) {
      continue;
    }

    if (item.clientNonce && serverClientNonces.has(item.clientNonce)) {
      continue;
    }

    nextItems.push(item);
  }

  return sortDirectMessages(nextItems);
}

function markMessageAsFailed(
  items: ThreadMessageItem[],
  messageId: string,
): ThreadMessageItem[] {
  return items.map((item) =>
    item.id === messageId
      ? { ...item, localState: "failed", uploadProgress: null }
      : item,
  );
}

function removeThreadMessage(
  items: ThreadMessageItem[],
  messageId: string,
): ThreadMessageItem[] {
  return items.filter((item) => item.id !== messageId);
}

function updateMessageUploadProgress(
  items: ThreadMessageItem[],
  messageId: string,
  progress: number,
): ThreadMessageItem[] {
  return items.map((item) =>
    item.id === messageId ? { ...item, uploadProgress: progress } : item,
  );
}

function inferAttachmentKind(file: File): "IMAGE" | "VIDEO" | "DOCUMENT" {
  if (file.type.startsWith("image/")) {
    return "IMAGE";
  }

  if (file.type.startsWith("video/")) {
    return "VIDEO";
  }

  const lowerName = file.name.toLowerCase();

  if (lowerName.match(/\.(png|jpe?g|webp|gif)$/i)) {
    return "IMAGE";
  }

  if (lowerName.match(/\.(mp4|webm)$/i)) {
    return "VIDEO";
  }

  return "DOCUMENT";
}

function applyLocalRead(
  conversation: ConversationState | null,
  viewerId: string,
  lastReadMessageId: string | null,
  lastReadAt: string | null,
): ConversationState | null {
  if (!conversation) {
    return conversation;
  }

  return {
    ...conversation,
    participants: conversation.participants.map((participant) =>
      participant.user.id === viewerId
        ? {
            ...participant,
            lastReadMessageId,
            lastReadAt,
          }
        : participant,
    ),
  };
}

export function ConversationView({
  conversationId,
  viewerId,
  viewerRole,
}: ConversationViewProps) {
  const { latestDmSignal } = useRealtime();
  const realtimePresence = useOptionalRealtimePresence();
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [messages, setMessages] = useState<ThreadMessageItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pickerCatalog, setPickerCatalog] = useState<MediaPickerCatalog | null>(null);
  const [pickerCatalogError, setPickerCatalogError] = useState<string | null>(null);
  const [isPickerCatalogLoading, setIsPickerCatalogLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const readInFlightRef = useRef(false);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const callStageHostRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const localBlobUrlsRef = useRef<Set<string>>(new Set());
  const pendingReadRef = useRef<PendingReadState>({
    lastReadMessageId: null,
    lastReadAt: null,
  });
  const hasPendingReadRef = useRef(false);

  const loadConversation = useCallback(async (options?: LoadConversationOptions) => {
    try {
      const payload = await apiClientFetch(`/v1/direct-messages/${conversationId}`);
      const parsed = directConversationDetailSchema.parse(payload);
      setConversation(stripConversationMessages(parsed.conversation));
      setMessages((current) =>
        mergeFetchedMessages(current, parsed.conversation.messages),
      );

      if (!options?.silent) {
        setErrorMessage(null);
      }

      const latestMessage = parsed.conversation.messages.at(-1) ?? null;
      setConversation((current) =>
        applyLocalRead(
          current ?? stripConversationMessages(parsed.conversation),
          viewerId,
          latestMessage?.id ?? null,
          latestMessage?.createdAt ?? null,
        ),
      );

      if (options?.markAsRead !== false) {
        if (latestMessage) {
          await markConversationAsRead(latestMessage.id, latestMessage.createdAt);
        } else {
          await markConversationAsRead(null, null);
        }
      }
    } catch (error) {
      if (!options?.silent) {
        setErrorMessage(
          error instanceof Error ? error.message : "Не удалось загрузить диалог.",
        );
      }
    }
  // markConversationAsRead is intentionally called from the initial load flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, viewerId]);

  const refreshPickerCatalog = useCallback(async () => {
    setIsPickerCatalogLoading(true);

    try {
      const payload = await apiClientFetch("/v1/media/picker");
      const catalog = mediaPickerCatalogResponseSchema.parse(payload).catalog;
      setPickerCatalog(catalog);
      setPickerCatalogError(null);
      return catalog;
    } catch (error) {
      setPickerCatalogError(
        error instanceof Error ? error.message : "Не удалось загрузить библиотеку медиа.",
      );
      return null;
    } finally {
      setIsPickerCatalogLoading(false);
    }
  }, []);

  const markConversationAsRead = useCallback(
    async (lastReadMessageId: string | null, lastReadAt: string | null) => {
      if (readInFlightRef.current) {
        pendingReadRef.current = {
          lastReadMessageId,
          lastReadAt,
        };
        hasPendingReadRef.current = true;
        return;
      }

      readInFlightRef.current = true;
      hasPendingReadRef.current = false;
      setConversation((current) =>
        applyLocalRead(current, viewerId, lastReadMessageId, lastReadAt),
      );

      try {
        await apiClientFetch(`/v1/direct-messages/${conversationId}/read`, {
          method: "POST",
        });
      } finally {
        readInFlightRef.current = false;

        if (hasPendingReadRef.current) {
          const pendingReadMessageId = pendingReadRef.current.lastReadMessageId;
          const pendingReadAt = pendingReadRef.current.lastReadAt;
          hasPendingReadRef.current = false;
          pendingReadRef.current = {
            lastReadMessageId: null,
            lastReadAt: null,
          };
          void markConversationAsRead(pendingReadMessageId, pendingReadAt);
        }
      }
    },
    [conversationId, viewerId],
  );

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    const hasLocalDrafts = messages.some((message) => Boolean(message.localState));

    if (hasLocalDrafts) {
      return;
    }

    const hasFreshPendingEmbed = messages.some((message) => {
      if (message.linkEmbed?.status !== "PENDING") {
        return false;
      }

      return Date.now() - new Date(message.createdAt).getTime() < 90_000;
    });

    if (!hasFreshPendingEmbed) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadConversation({
        markAsRead: false,
        silent: true,
      });
    }, 3_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadConversation, messages]);

  useEffect(() => {
    void refreshPickerCatalog();
  }, [refreshPickerCatalog]);

  useEffect(() => {
    return () => {
      for (const url of localBlobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }

      localBlobUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!isSearchOpen) {
      setMessageSearchQuery("");
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (!latestDmSignal || latestDmSignal.conversationId !== conversationId) {
      return;
    }

    const signalEvent = latestDmSignal.event as string;

    if (
      (signalEvent === "MESSAGE_CREATED" || signalEvent === "MESSAGE_UPDATED") &&
      latestDmSignal.message
    ) {
      setMessages((current) =>
        mergeThreadMessage(current, latestDmSignal.message as DirectMessage),
      );

      if (
        signalEvent === "MESSAGE_CREATED" &&
        latestDmSignal.actorUserId !== viewerId
      ) {
        void markConversationAsRead(
          latestDmSignal.message.id,
          latestDmSignal.message.createdAt,
        );
      }

      return;
    }

    if (signalEvent === "MESSAGE_DELETED" && latestDmSignal.messageId) {
      setMessages((current) =>
        removeThreadMessage(current, latestDmSignal.messageId!),
      );
      return;
    }

    if (signalEvent === "CONVERSATION_READ") {
      setConversation((current) =>
        applyLocalRead(
          current,
          viewerId,
          latestDmSignal.conversation.settings.lastReadMessageId,
          latestDmSignal.conversation.settings.lastReadAt,
        ),
      );
      return;
    }

    if (signalEvent === "CONVERSATION_UPDATED") {
      setConversation((current) =>
        current
          ? {
              ...current,
              retentionMode: latestDmSignal.conversation.retentionMode,
              retentionSeconds: latestDmSignal.conversation.retentionSeconds,
            }
          : current,
      );
    }
  }, [conversationId, latestDmSignal, markConversationAsRead, viewerId]);

  const counterpart = useMemo(
    () =>
      conversation?.participants.find((participant) => participant.user.id !== viewerId)
        ?.user ?? null,
    [conversation, viewerId],
  );
  const viewerParticipant = useMemo(
    () =>
      conversation?.participants.find((participant) => participant.user.id === viewerId) ??
      null,
    [conversation, viewerId],
  );
  const liveCounterpart = useMemo(() => {
    if (!counterpart) {
      return null;
    }

    return realtimePresence !== null
      ? {
          ...counterpart,
          isOnline: Boolean(realtimePresence[counterpart.id]),
        }
      : counterpart;
  }, [counterpart, realtimePresence]);
  const counterpartAvailabilityLabel = useMemo(
    () => getAvailabilityLabel(liveCounterpart),
    [liveCounterpart],
  );
  const isBlocked =
    conversation?.isBlockedByViewer || conversation?.hasBlockedViewer || false;
  const compactStatusLabel = counterpartAvailabilityLabel ?? "Не в сети";

  async function sendMessage(payload: ComposerSendPayload) {
    if (!conversation || !counterpart) {
      return;
    }

    const author =
      conversation.participants.find((participant) => participant.user.id === viewerId)
        ?.user ?? counterpart;
    const clientNonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticMessage = buildOptimisticMessage({
      author,
      conversationId,
      payload,
      clientNonce,
    });

    setMessages((current) => sortDirectMessages([...current, optimisticMessage]));
    setConversation((current) =>
      applyLocalRead(current, viewerId, optimisticMessage.id, optimisticMessage.createdAt),
    );

    try {
      const response = await apiClientFetch(`/v1/direct-messages/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          type: payload.type,
          content: payload.type === "TEXT" ? payload.content : undefined,
          stickerId: payload.type === "STICKER" ? payload.stickerId : undefined,
          gifId: payload.type === "GIF" ? payload.gifId : undefined,
          clientNonce,
        }),
      });
      const parsed = directMessageResponseSchema.parse(response);
      setMessages((current) => mergeThreadMessage(current, parsed.message));
      setConversation((current) =>
        applyLocalRead(current, viewerId, parsed.message.id, parsed.message.createdAt),
      );
      setErrorMessage(null);
    } catch (error) {
      setMessages((current) => markMessageAsFailed(current, optimisticMessage.id));
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось отправить сообщение.",
      );
    }
  }

  function registerLocalBlobUrl(url: string | null) {
    if (!url || !url.startsWith("blob:")) {
      return;
    }

    localBlobUrlsRef.current.add(url);
  }

  async function uploadSingleFile(file: File, _mode?: ComposerFileUploadMode) {
    if (!conversation || !counterpart) {
      return;
    }

    const author =
      conversation.participants.find((participant) => participant.user.id === viewerId)
        ?.user ?? counterpart;
    const clientNonce =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const inferredKind = inferAttachmentKind(file);
    const localAssetUrl =
      inferredKind !== "DOCUMENT" ? URL.createObjectURL(file) : null;
    const localPreviewUrl =
      inferredKind === "IMAGE" || inferredKind === "VIDEO" ? localAssetUrl : null;

    registerLocalBlobUrl(localAssetUrl);
    registerLocalBlobUrl(localPreviewUrl);

    const optimisticMessage = buildOptimisticAttachmentMessage({
      author,
      conversationId,
      file,
      clientNonce,
      localPreviewUrl,
      localAssetUrl,
    });

    setMessages((current) => sortDirectMessages([...current, optimisticMessage]));
    setConversation((current) =>
      applyLocalRead(current, viewerId, optimisticMessage.id, optimisticMessage.createdAt),
    );

    try {
      const response = await uploadDirectMessageAttachment({
        conversationId,
        file,
        clientNonce,
        onProgress: (progress) => {
          setMessages((current) =>
            updateMessageUploadProgress(current, optimisticMessage.id, progress),
          );
        },
      });
      const parsed = directMessageAttachmentUploadResponseSchema.parse(response);
      setMessages((current) => mergeThreadMessage(current, parsed.message));
      setConversation((current) =>
        applyLocalRead(current, viewerId, parsed.message.id, parsed.message.createdAt),
      );
      setErrorMessage(null);
    } catch (error) {
      setMessages((current) => markMessageAsFailed(current, optimisticMessage.id));
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось отправить вложение.",
      );
    }
  }

  async function uploadFiles(files: File[], mode?: ComposerFileUploadMode) {
    const filteredFiles = files.filter((file) => file.size > 0);

    if (filteredFiles.length === 0) {
      return;
    }

    setIsUploadingFiles(true);

    try {
      for (const file of filteredFiles) {
        await uploadSingleFile(file, mode);
      }
    } finally {
      setIsUploadingFiles(false);
    }
  }

  async function retryMessage(messageId: string) {
    const failedMessage = messages.find((item) => item.id === messageId);

    if (!failedMessage) {
      return;
    }

    setMessages((current) => removeThreadMessage(current, messageId));

    if (failedMessage.type === "STICKER" && failedMessage.sticker) {
      await sendMessage({
        type: "STICKER",
        stickerId: failedMessage.sticker.id,
        sticker: failedMessage.sticker,
      });
      return;
    }

    if (failedMessage.type === "GIF" && failedMessage.gif) {
      await sendMessage({
        type: "GIF",
        gifId: failedMessage.gif.id,
        gif: failedMessage.gif,
      });
      return;
    }

    if (failedMessage.retryUploadFile) {
      await uploadFiles(
        [failedMessage.retryUploadFile],
        failedMessage.attachment?.kind === "DOCUMENT" ? "document" : "media",
      );
      return;
    }

    if (failedMessage.content) {
      await sendMessage({
        type: "TEXT",
        content: failedMessage.content,
      });
    }
  }

  function handleDragEnter() {
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }

  function handleDragLeave() {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false);
    }
  }

  function handleDropFiles(files: FileList | null) {
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);

    if (!files || files.length === 0) {
      return;
    }

    void uploadFiles(Array.from(files));
  }

  async function deleteMessage(messageId: string) {
    const previousMessage = messages.find((message) => message.id === messageId);

    if (
      !previousMessage ||
      previousMessage.author.id !== viewerId ||
      previousMessage.localState
    ) {
      return;
    }

    setIsDeleting(messageId);
    setMessages((current) => removeThreadMessage(current, messageId));

    try {
      const payload = await apiClientFetch(
        `/v1/direct-messages/${conversationId}/messages/${messageId}`,
        { method: "DELETE" },
      );
      directMessageResponseSchema.parse(payload);
      setErrorMessage(null);
    } catch (error) {
      setMessages((current) =>
        sortDirectMessages([...current, previousMessage]),
      );
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось удалить сообщение.",
      );
    } finally {
      setIsDeleting(null);
    }
  }

  async function saveSettings(payload: {
    notificationSetting: "ALL" | "MENTIONS_ONLY" | "MUTED" | "OFF";
    retentionMode: "OFF" | "H24" | "D7" | "D30" | "CUSTOM";
    customHours: number | null;
  }) {
    const response = await apiClientFetch(
      `/v1/direct-messages/${conversationId}/settings`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    directConversationSummaryResponseSchema.parse(response);
    dispatchNotificationPreferencesEvent({
      scope: "conversation",
      conversationId,
      notificationSetting: payload.notificationSetting,
    });
    await loadConversation();
  }

  if (errorMessage && !conversation) {
    return (
      <div className="empty-state-minimal bg-[var(--bg-app)] text-[var(--text-muted)]">
        <ShieldAlert {...iconProps} />
        <p className="text-sm text-rose-200">{errorMessage}</p>
      </div>
    );
  }

  if (!conversation || !counterpart || !viewerParticipant) {
    return (
      <div className="empty-state-minimal bg-[var(--bg-app)] text-[var(--text-muted)]">
        <UserRound {...iconProps} />
        <p className="text-sm">Загружаем диалог...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent_16%)]">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative shrink-0 border-b border-white/6 bg-[rgba(10,14,20,0.9)] backdrop-blur-xl">
          <div className="flex min-h-[64px] items-center gap-3 px-3">
            <Link
              href="/app/messages"
              aria-label="Назад к диалогам"
              title="Назад к диалогам"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[var(--text-soft)] transition-colors hover:border-white/12 hover:bg-white/[0.07] hover:text-white md:hidden"
            >
                <ArrowLeft {...iconProps} />
            </Link>

            <div className="min-w-0 flex flex-1 items-center gap-3">
              <UserAvatar user={counterpart} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[15px] font-medium tracking-tight text-white">
                    {counterpart.profile.displayName}
                  </p>
                  {isBlocked ? (
                    <span className="hidden rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-200 lg:inline-flex">
                      Ограничено
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  <span>@{counterpart.username}</span>
                  <span className="px-1">•</span>
                  <span
                    className={cn(
                      liveCounterpart?.isOnline
                        ? "text-emerald-200"
                        : "text-[var(--text-muted)]",
                    )}
                  >
                    {compactStatusLabel}
                  </span>
                </p>
              </div>
            </div>

            <div className="relative ml-auto flex items-center gap-1.5">
              <ConversationHeaderIconButton
                label="Поиск по диалогу"
                active={isSearchOpen}
                onClick={() => setIsSearchOpen((current) => !current)}
              >
                <Search {...iconProps} />
              </ConversationHeaderIconButton>

              <DmCallPanel
                conversationId={conversationId}
                viewerId={viewerId}
                isBlocked={isBlocked}
                counterpartName={counterpart.profile.displayName}
                counterpartUsername={counterpart.username}
                counterpartAvailabilityLabel={counterpartAvailabilityLabel}
                counterpartIsOnline={Boolean(liveCounterpart?.isOnline)}
                variant="header"
                stageHostRef={callStageHostRef}
              />

              <ConversationHeaderIconButton
                label={isInfoPanelOpen ? "Скрыть детали" : "Открыть детали"}
                active={isInfoPanelOpen}
                onClick={() => setIsInfoPanelOpen((current) => !current)}
              >
                <Info {...iconProps} />
              </ConversationHeaderIconButton>

              <Link
                href={buildUserProfileHref(counterpart.username)}
                aria-label="Открыть профиль"
                title="Открыть профиль"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[var(--text-soft)] transition-colors hover:border-white/12 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(106,168,248,0.22)]"
              >
                <UserRound {...iconProps} />
              </Link>
            </div>
          </div>

          {isSearchOpen ? (
            <div className="pointer-events-none absolute inset-x-3 top-1/2 z-20 -translate-y-1/2">
              <div className="pointer-events-auto ml-auto flex h-10 w-full max-w-[min(420px,100%)] items-center gap-2 rounded-full border border-white/10 bg-[rgba(8,12,18,0.98)] px-3 shadow-[0_18px_44px_rgba(2,6,12,0.34)]">
                <Search size={16} strokeWidth={1.5} className="shrink-0 text-[var(--text-soft)]" />
                <Input
                  ref={searchInputRef}
                  value={messageSearchQuery}
                  onChange={(event) => setMessageSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setIsSearchOpen(false);
                    }
                  }}
                  placeholder="Поиск по сообщениям"
                  className="h-full border-0 bg-transparent px-0 text-sm text-white"
                />
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
                  onClick={() => setIsSearchOpen(false)}
                  aria-label="Закрыть поиск"
                >
                  <X size={15} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ) : null}

          <div ref={callStageHostRef} className="contents" />
        </div>

        {errorMessage ? (
          <div className="shrink-0 border-b border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            {errorMessage}
          </div>
        ) : null}

        <div
          ref={messageViewportRef}
          className="relative min-h-0 flex-1"
          onDragEnter={(event) => {
            event.preventDefault();
            handleDragEnter();
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDragLeave={(event) => {
            event.preventDefault();

            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }

            handleDragLeave();
          }}
          onDrop={(event) => {
            event.preventDefault();
            handleDropFiles(event.dataTransfer.files);
          }}
        >
          <MessageThread
            viewerId={viewerId}
            messages={messages}
            isDeleting={isDeleting}
            lastReadAt={viewerParticipant.lastReadAt}
            customEmojis={pickerCatalog?.customEmojis ?? []}
            searchQuery={messageSearchQuery}
            onDelete={deleteMessage}
            onRetry={retryMessage}
          />
          {isDraggingFiles ? (
            <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-[24px] border border-[rgba(106,168,248,0.28)] bg-[rgba(8,16,26,0.74)] text-sm text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-sm">
              Перетащите фото, видео или документ, чтобы отправить
            </div>
          ) : null}
          <MovableConversationInfoPanel
            containerRef={messageViewportRef}
            conversationId={conversationId}
            counterpart={counterpart}
            isOpen={isInfoPanelOpen}
            notificationSetting={viewerParticipant.notificationSetting}
            retentionMode={conversation.retentionMode}
            retentionSeconds={conversation.retentionSeconds}
            onClose={() => setIsInfoPanelOpen(false)}
            onSave={saveSettings}
          />
        </div>

        <div className="shrink-0 border-t border-white/5 bg-[rgba(11,16,24,0.92)] px-3 py-2 backdrop-blur-xl">
          <MessageComposer
            disabled={isBlocked || isUploadingFiles}
            canManageLibrary={viewerRole === "OWNER" || viewerRole === "ADMIN"}
            pickerCatalog={pickerCatalog}
            isPickerCatalogLoading={isPickerCatalogLoading}
            pickerCatalogError={pickerCatalogError}
            isUploadingFiles={isUploadingFiles}
            onRefreshPickerCatalog={refreshPickerCatalog}
            onStickerCatalogChange={(catalog) =>
              setPickerCatalog((current) =>
                current
                  ? {
                      ...current,
                      stickers: catalog,
                    }
                  : current,
              )
            }
            onUploadFiles={(files, mode) => uploadFiles(files, mode)}
            onSend={sendMessage}
          />
        </div>
      </section>

      <div className="border-t border-white/5 bg-[rgba(20,29,40,0.38)] px-3 py-2.5 md:hidden 2xl:hidden">
        <ConversationSettings
          notificationSetting={viewerParticipant.notificationSetting}
          retentionMode={conversation.retentionMode}
          retentionSeconds={conversation.retentionSeconds}
          disabled={false}
          onSave={saveSettings}
        />
      </div>
    </div>
  );
}

function ConversationHeaderIconButton({
  active = false,
  children,
  className,
  label,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-[var(--text-soft)] transition-colors hover:border-white/12 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(106,168,248,0.22)]",
        active &&
          "border-[rgba(106,168,248,0.22)] bg-[rgba(106,168,248,0.14)] text-[var(--accent-strong)]",
        className,
      )}
    >
      {children}
    </button>
  );
}
