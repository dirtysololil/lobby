"use client";

import Link from "next/link";
import {
  ArrowLeft,
  MoreVertical,
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
  type DirectMessageReplyPreview,
  type FriendshipState,
  type MediaPickerCatalog,
  type UserRole,
} from "@lobby/shared";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function buildSearchableMessageText(message: ThreadMessageItem) {
  return [
    message.author.profile.displayName,
    message.author.username,
    message.content,
    message.sticker?.title,
    message.gif?.title,
    message.attachment?.originalName,
    message.replyTo?.content,
    message.replyTo?.attachment?.originalName,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function buildOptimisticMessage(args: {
  author: DirectConversationDetail["conversation"]["participants"][number]["user"];
  conversationId: string;
  payload: ComposerSendPayload;
  clientNonce: string;
  replyToMessage: DirectMessageReplyPreview | null;
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
    replyTo: args.replyToMessage,
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
  replyToMessage: DirectMessageReplyPreview | null;
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
    replyTo: args.replyToMessage,
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

function applyParticipantRead(
  conversation: ConversationState | null,
  participantUserId: string,
  lastReadMessageId: string | null,
  lastReadAt: string | null,
): ConversationState | null {
  if (!conversation) {
    return conversation;
  }

  return {
    ...conversation,
    participants: conversation.participants.map((participant) =>
      participant.user.id === participantUserId
        ? {
            ...participant,
            lastReadMessageId,
            lastReadAt,
          }
        : participant,
    ),
  };
}

function buildReplyPreviewFromThreadMessage(
  message: ThreadMessageItem,
): DirectMessageReplyPreview {
  return {
    id: message.id,
    conversationId: message.conversationId,
    type: message.type,
    author: message.author,
    content: message.isDeleted ? null : message.content,
    sticker: message.isDeleted ? null : message.sticker,
    gif: message.isDeleted ? null : message.gif,
    attachment: message.isDeleted ? null : message.attachment,
    isDeleted: message.isDeleted,
    createdAt: message.createdAt,
  };
}

function getDirectMessageWriteRestriction(
  friendshipState: FriendshipState,
  isBlocked: boolean,
) {
  if (isBlocked) {
    return "В этом диалоге нельзя отправлять сообщения из-за ограничения контакта.";
  }

  switch (friendshipState) {
    case "INCOMING_REQUEST":
      return "Чтобы писать в ЛС, сначала примите заявку в друзья.";
    case "OUTGOING_REQUEST":
      return "Чтобы писать в ЛС, дождитесь принятия вашей заявки в друзья.";
    case "NONE":
    case "REMOVED":
      return "Чтобы писать в ЛС, сначала отправьте заявку в друзья и дождитесь принятия.";
    case "ACCEPTED":
      return null;
    default:
      return "В этом диалоге нельзя отправлять сообщения.";
  }
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
  const [replyToMessage, setReplyToMessage] =
    useState<DirectMessageReplyPreview | null>(null);
  const [forceThreadScrollToken, setForceThreadScrollToken] = useState(0);
  const normalizedMessageSearchQuery = messageSearchQuery.trim().toLowerCase();
  const messageSearchMatches = useMemo(() => {
    if (!normalizedMessageSearchQuery) {
      return 0;
    }

    return messages.filter((message) =>
      buildSearchableMessageText(message).includes(normalizedMessageSearchQuery),
    ).length;
  }, [messages, normalizedMessageSearchQuery]);
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

  const requestThreadScrollToBottom = useCallback(() => {
    setForceThreadScrollToken((current) => current + 1);
  }, []);

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
        applyParticipantRead(
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
        applyParticipantRead(current, viewerId, lastReadMessageId, lastReadAt),
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
    setReplyToMessage(null);
  }, [conversationId]);

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
    const localBlobUrls = localBlobUrlsRef.current;

    return () => {
      for (const url of localBlobUrls) {
        URL.revokeObjectURL(url);
      }

      localBlobUrls.clear();
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
    const readState = latestDmSignal.readState ?? null;

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
      setReplyToMessage((current) =>
        current?.id === latestDmSignal.messageId ? null : current,
      );
      return;
    }

    if (signalEvent === "CONVERSATION_READ") {
      if (readState) {
        setConversation((current) =>
          applyParticipantRead(
            current,
            readState.userId,
            readState.lastReadMessageId,
            readState.lastReadAt,
          ),
        );
        return;
      }

      setConversation((current) =>
        applyParticipantRead(
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
  const counterpartParticipant = useMemo(
    () =>
      conversation?.participants.find((participant) => participant.user.id !== viewerId) ??
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

  const writeRestrictionMessage = getDirectMessageWriteRestriction(
    conversation?.friendshipState ?? "NONE",
    isBlocked,
  );
  const isComposerDisabled = Boolean(writeRestrictionMessage) || isUploadingFiles;

  async function sendMessage(
    payload: ComposerSendPayload,
    replyTarget = replyToMessage,
  ) {
    if (!conversation || !counterpart) {
      return;
    }

    if (writeRestrictionMessage) {
      setErrorMessage(writeRestrictionMessage);
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
      replyToMessage: replyTarget,
    });

    setMessages((current) => sortDirectMessages([...current, optimisticMessage]));
    requestThreadScrollToBottom();
    setConversation((current) =>
      applyParticipantRead(
        current,
        viewerId,
        optimisticMessage.id,
        optimisticMessage.createdAt,
      ),
    );

    try {
      const response = await apiClientFetch(`/v1/direct-messages/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          type: payload.type,
          content: payload.type === "TEXT" ? payload.content : undefined,
          stickerId: payload.type === "STICKER" ? payload.stickerId : undefined,
          gifId: payload.type === "GIF" ? payload.gifId : undefined,
          replyToMessageId: replyTarget?.id ?? undefined,
          clientNonce,
        }),
      });
      const parsed = directMessageResponseSchema.parse(response);
      setMessages((current) => mergeThreadMessage(current, parsed.message));
      setConversation((current) =>
        applyParticipantRead(
          current,
          viewerId,
          parsed.message.id,
          parsed.message.createdAt,
        ),
      );
      setReplyToMessage((current) =>
        current?.id === replyTarget?.id ? null : current,
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

  async function uploadSingleFile(
    file: File,
    mode?: ComposerFileUploadMode,
    replyTarget = replyToMessage,
  ) {
    if (!conversation || !counterpart) {
      return;
    }

    if (writeRestrictionMessage) {
      setErrorMessage(writeRestrictionMessage);
      return;
    }

    void mode;

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
      replyToMessage: replyTarget,
    });

    setMessages((current) => sortDirectMessages([...current, optimisticMessage]));
    requestThreadScrollToBottom();
    setConversation((current) =>
      applyParticipantRead(
        current,
        viewerId,
        optimisticMessage.id,
        optimisticMessage.createdAt,
      ),
    );

    try {
      const response = await uploadDirectMessageAttachment({
        conversationId,
        file,
        clientNonce,
        replyToMessageId: replyTarget?.id ?? null,
        onProgress: (progress) => {
          setMessages((current) =>
            updateMessageUploadProgress(current, optimisticMessage.id, progress),
          );
        },
      });
      const parsed = directMessageAttachmentUploadResponseSchema.parse(response);
      setMessages((current) => mergeThreadMessage(current, parsed.message));
      setConversation((current) =>
        applyParticipantRead(
          current,
          viewerId,
          parsed.message.id,
          parsed.message.createdAt,
        ),
      );
      setReplyToMessage((current) =>
        current?.id === replyTarget?.id ? null : current,
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
    if (writeRestrictionMessage) {
      setErrorMessage(writeRestrictionMessage);
      return;
    }

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
      }, failedMessage.replyTo);
      return;
    }

    if (failedMessage.type === "GIF" && failedMessage.gif) {
      await sendMessage({
        type: "GIF",
        gifId: failedMessage.gif.id,
        gif: failedMessage.gif,
      }, failedMessage.replyTo);
      return;
    }

    if (failedMessage.retryUploadFile) {
      await uploadSingleFile(
        failedMessage.retryUploadFile,
        failedMessage.attachment?.kind === "DOCUMENT" ? "document" : "media",
        failedMessage.replyTo,
      );
      return;
    }

    if (failedMessage.content) {
      await sendMessage({
        type: "TEXT",
        content: failedMessage.content,
      }, failedMessage.replyTo);
    }
  }

  function handleDragEnter() {
    if (writeRestrictionMessage || isUploadingFiles) {
      return;
    }

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

    if (writeRestrictionMessage) {
      setErrorMessage(writeRestrictionMessage);
      return;
    }

    if (!files || files.length === 0) {
      return;
    }

    void uploadFiles(Array.from(files));
  }

  function replyToThreadMessage(messageId: string) {
    const targetMessage = messages.find(
      (message) => message.id === messageId && !message.localState,
    );

    if (!targetMessage || targetMessage.isDeleted) {
      return;
    }

    setReplyToMessage(buildReplyPreviewFromThreadMessage(targetMessage));
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
    <div className="dm-shell flex h-full min-h-0 flex-col overflow-hidden">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="dm-header relative shrink-0">
          <div className="flex min-h-[68px] items-center gap-3 px-4 py-2.5">
            <Link
              href="/app/messages"
              aria-label="Назад к диалогам"
              title="Назад к диалогам"
              className="dm-action-button rounded-full"
            >
              <ArrowLeft {...iconProps} />
            </Link>

            <Link
              href={buildUserProfileHref(counterpart.username)}
              aria-label={`Открыть профиль ${counterpart.profile.displayName}`}
              title="Открыть профиль"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] border border-transparent px-1 py-0.5 transition-colors hover:bg-white/[0.025]"
            >
              <div className="relative shrink-0">
                <UserAvatar
                  user={counterpart}
                  size="sm"
                  className="h-10 w-10"
                  showPresenceIndicator={false}
                />
                <span
                  className={cn(
                    "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[2px] border-[#101824] bg-[#6c7484]",
                    liveCounterpart?.isOnline && "bg-[#2ecf7c]",
                  )}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="truncate text-[15px] font-semibold tracking-[-0.03em] text-white">
                    {counterpart.profile.displayName}
                  </span>
                  {isBlocked ? (
                    <span className="hidden rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-200 lg:inline-flex">
                      Ограничено
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-[#8d98aa]">
                  {liveCounterpart?.isOnline ? (
                    <span className="h-2 w-2 rounded-full bg-[#2ecf7c]" />
                  ) : null}
                  <span>
                    {liveCounterpart?.isOnline
                      ? "в сети"
                      : compactStatusLabel}
                  </span>
                </p>
              </div>
            </Link>

            <div className="ml-auto flex shrink-0 items-center gap-2">
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
                <MoreVertical {...iconProps} />
              </ConversationHeaderIconButton>
            </div>
          </div>

          {isSearchOpen ? (
            <div className="dm-search-row px-4 pb-3 pt-0">
              <div className="dm-search-shell">
                <Search
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 text-[var(--text-soft)]"
                />
                <input
                  ref={searchInputRef}
                  value={messageSearchQuery}
                  onChange={(event) => setMessageSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setIsSearchOpen(false);
                    }
                  }}
                  placeholder="Поиск по сообщениям"
                  className="dm-search-input text-sm"
                />
                <div className="dm-search-actions">
                  {normalizedMessageSearchQuery ? (
                    <span className="dm-search-count">{messageSearchMatches}</span>
                  ) : null}
                  <button
                    type="button"
                    className="dm-search-clear"
                    onClick={() => {
                      if (messageSearchQuery) {
                        setMessageSearchQuery("");
                        searchInputRef.current?.focus();
                        return;
                      }

                      setIsSearchOpen(false);
                    }}
                    aria-label="Закрыть поиск"
                  >
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
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

        {!errorMessage && writeRestrictionMessage ? (
          <div className="shrink-0 border-b border-white/5 bg-[rgba(20,29,40,0.74)] px-3 py-2 text-sm text-[var(--text-soft)]">
            {writeRestrictionMessage}
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
            counterpartLastReadAt={counterpartParticipant?.lastReadAt ?? null}
            customEmojis={pickerCatalog?.customEmojis ?? []}
            forceScrollToBottomToken={forceThreadScrollToken}
            searchQuery={messageSearchQuery}
            onReply={replyToThreadMessage}
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
            isOpen={isInfoPanelOpen}
            notificationSetting={viewerParticipant.notificationSetting}
            retentionMode={conversation.retentionMode}
            retentionSeconds={conversation.retentionSeconds}
            onClose={() => setIsInfoPanelOpen(false)}
            onSave={saveSettings}
          />
        </div>

        <div className="shrink-0 bg-[linear-gradient(180deg,rgba(8,12,18,0.24),rgba(8,12,18,0.96))] px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl md:px-4 md:py-3">
          <MessageComposer
            disabled={isComposerDisabled}
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
            replyToMessage={replyToMessage}
            onCancelReply={() => setReplyToMessage(null)}
          />
        </div>
      </section>

      {isInfoPanelOpen ? (
        <div className="border-t border-white/5 bg-[rgba(20,29,40,0.38)] px-3 py-2.5 md:hidden 2xl:hidden">
          <ConversationSettings
            notificationSetting={viewerParticipant.notificationSetting}
            retentionMode={conversation.retentionMode}
            retentionSeconds={conversation.retentionSeconds}
            disabled={false}
            onSave={saveSettings}
          />
        </div>
      ) : null}
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
        "dm-action-button rounded-full",
        active && "dm-action-button-active",
        className,
      )}
    >
      {children}
    </button>
  );
}
