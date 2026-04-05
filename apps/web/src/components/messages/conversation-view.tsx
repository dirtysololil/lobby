"use client";

import Link from "next/link";
import { ArrowLeft, Clock3, ShieldAlert, UserRound } from "lucide-react";
import {
  directConversationDetailSchema,
  directConversationSummaryResponseSchema,
  directMessageResponseSchema,
  type DirectConversationDetail,
  type DirectMessage,
} from "@lobby/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { DmCallPanel } from "@/components/calls/dm-call-panel";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { sortDirectMessages } from "@/lib/direct-message-state";
import { dmRetentionLabels } from "@/lib/ui-labels";
import { ConversationSettings } from "./conversation-settings";
import { MessageComposer } from "./message-composer";
import { MessageThread, type ThreadMessageItem } from "./message-thread";

interface ConversationViewProps {
  conversationId: string;
  viewerId: string;
}

type ConversationState = Omit<DirectConversationDetail["conversation"], "messages">;
type PendingReadState = {
  lastReadMessageId: string | null;
  lastReadAt: string | null;
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
  content: string;
  clientNonce: string;
}): ThreadMessageItem {
  const createdAt = new Date().toISOString();
  const deleteExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return {
    id: `temp:${args.clientNonce}`,
    conversationId: args.conversationId,
    author: args.author,
    content: args.content,
    isDeleted: false,
    canDelete: true,
    deleteExpiresAt,
    clientNonce: args.clientNonce,
    createdAt,
    updatedAt: createdAt,
    localState: "sending",
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

function markMessageAsFailed(
  items: ThreadMessageItem[],
  messageId: string,
): ThreadMessageItem[] {
  return items.map((item) =>
    item.id === messageId ? { ...item, localState: "failed" } : item,
  );
}

function removeThreadMessage(
  items: ThreadMessageItem[],
  messageId: string,
): ThreadMessageItem[] {
  return items.filter((item) => item.id !== messageId);
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
}: ConversationViewProps) {
  const { latestDmSignal } = useRealtime();
  const [conversation, setConversation] = useState<ConversationState | null>(null);
  const [messages, setMessages] = useState<ThreadMessageItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const readInFlightRef = useRef(false);
  const pendingReadRef = useRef<PendingReadState>({
    lastReadMessageId: null,
    lastReadAt: null,
  });
  const hasPendingReadRef = useRef(false);

  const loadConversation = useCallback(async () => {
    try {
      const payload = await apiClientFetch(`/v1/direct-messages/${conversationId}`);
      const parsed = directConversationDetailSchema.parse(payload);
      setConversation(stripConversationMessages(parsed.conversation));
      setMessages(parsed.conversation.messages);
      setErrorMessage(null);

      const latestMessage = parsed.conversation.messages.at(-1) ?? null;
      setConversation((current) =>
        applyLocalRead(
          current ?? stripConversationMessages(parsed.conversation),
          viewerId,
          latestMessage?.id ?? null,
          latestMessage?.createdAt ?? null,
        ),
      );

      if (latestMessage) {
        await markConversationAsRead(latestMessage.id, latestMessage.createdAt);
      } else {
        await markConversationAsRead(null, null);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить диалог.",
      );
    }
  // markConversationAsRead is intentionally called from the initial load flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, viewerId]);

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
    if (!latestDmSignal || latestDmSignal.conversationId !== conversationId) {
      return;
    }

    if (latestDmSignal.event === "MESSAGE_CREATED" && latestDmSignal.message) {
      setMessages((current) =>
        mergeThreadMessage(current, latestDmSignal.message as DirectMessage),
      );

      if (latestDmSignal.actorUserId !== viewerId) {
        void markConversationAsRead(
          latestDmSignal.message.id,
          latestDmSignal.message.createdAt,
        );
      }

      return;
    }

    if (latestDmSignal.event === "MESSAGE_DELETED" && latestDmSignal.messageId) {
      setMessages((current) =>
        removeThreadMessage(current, latestDmSignal.messageId!),
      );
      return;
    }

    if (latestDmSignal.event === "CONVERSATION_READ") {
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

    if (latestDmSignal.event === "CONVERSATION_UPDATED") {
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
  const isBlocked =
    conversation?.isBlockedByViewer || conversation?.hasBlockedViewer || false;

  async function sendMessage(content: string) {
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
      content,
      clientNonce,
    });

    setMessages((current) => sortDirectMessages([...current, optimisticMessage]));
    setConversation((current) =>
      applyLocalRead(current, viewerId, optimisticMessage.id, optimisticMessage.createdAt),
    );

    try {
      const payload = await apiClientFetch(`/v1/direct-messages/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, clientNonce }),
      });
      const parsed = directMessageResponseSchema.parse(payload);
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

  async function retryMessage(messageId: string) {
    const failedMessage = messages.find((item) => item.id === messageId);

    if (!failedMessage?.content) {
      return;
    }

    setMessages((current) => removeThreadMessage(current, messageId));
    await sendMessage(failedMessage.content);
  }

  async function deleteMessage(messageId: string) {
    const previousMessage = messages.find((message) => message.id === messageId);

    if (!previousMessage || !previousMessage.canDelete) {
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
      const deleteWindowExpired =
        error instanceof Error &&
        error.message.toLowerCase().includes("1 hour");
      setMessages((current) =>
        sortDirectMessages([
          ...current,
          {
            ...previousMessage,
            canDelete: deleteWindowExpired ? false : previousMessage.canDelete,
          },
        ]),
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
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-[rgba(11,16,24,0.88)] px-3 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar user={counterpart} size="sm" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium tracking-tight text-white">
                  {counterpart.profile.displayName}
                </p>
                <PresenceIndicator presence={counterpart.profile.presence} compact />
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <UserRound {...iconProps} />
                  ЛС
                </span>
                {conversation.retentionMode !== "OFF" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Clock3 {...iconProps} />
                    {dmRetentionLabels[conversation.retentionMode]}
                  </span>
                ) : null}
                {isBlocked ? (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                    <ShieldAlert {...iconProps} />
                    Ограничено
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-[var(--text-muted)]">
                @{counterpart.username}
              </p>
            </div>
          </div>

          <Link href="/app/messages">
            <Button size="sm" variant="ghost">
              <ArrowLeft {...iconProps} />
              Назад
            </Button>
          </Link>
        </div>

        <div className="shrink-0 border-b border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent_48%),rgba(20,29,40,0.72)] px-3 py-2">
          <DmCallPanel
            conversationId={conversationId}
            viewerId={viewerId}
            isBlocked={isBlocked}
            counterpartName={counterpart.profile.displayName}
            counterpartUsername={counterpart.username}
          />
        </div>

        {errorMessage ? (
          <div className="shrink-0 border-b border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          <MessageThread
            viewerId={viewerId}
            messages={messages}
            isDeleting={isDeleting}
            lastReadAt={viewerParticipant.lastReadAt}
            onDelete={deleteMessage}
            onRetry={retryMessage}
          />
        </div>

        <div className="shrink-0 border-t border-white/5 bg-[rgba(11,16,24,0.92)] px-3 py-2.5 backdrop-blur-xl">
          <MessageComposer disabled={isBlocked} onSend={sendMessage} />
        </div>
      </section>

      <div className="border-t border-white/5 bg-[rgba(20,29,40,0.38)] px-3 py-2.5 2xl:hidden">
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
