"use client";

import Link from "next/link";
import { ArrowLeft, Clock3, ShieldAlert, UserRound } from "lucide-react";
import {
  directConversationDetailSchema,
  directConversationSummaryResponseSchema,
  directMessageResponseSchema,
  type DirectConversationDetail,
} from "@lobby/shared";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { DmCallPanel } from "@/components/calls/dm-call-panel";
import { ConversationSettings } from "./conversation-settings";
import { MessageComposer } from "./message-composer";
import { MessageThread } from "./message-thread";

interface ConversationViewProps {
  conversationId: string;
  viewerId: string;
}

export function ConversationView({
  conversationId,
  viewerId,
}: ConversationViewProps) {
  const [conversation, setConversation] = useState<
    DirectConversationDetail["conversation"] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const loadConversation = useCallback(async () => {
    try {
      const payload = await apiClientFetch(`/v1/direct-messages/${conversationId}`);
      const parsed = directConversationDetailSchema.parse(payload);
      setConversation(parsed.conversation);
      setErrorMessage(null);
      await apiClientFetch(`/v1/direct-messages/${conversationId}/read`, {
        method: "POST",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить диалог",
      );
    }
  }, [conversationId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  async function sendMessage(content: string) {
    await apiClientFetch(`/v1/direct-messages/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    await loadConversation();
  }

  async function deleteMessage(messageId: string) {
    setIsDeleting(messageId);
    try {
      const payload = await apiClientFetch(
        `/v1/direct-messages/${conversationId}/messages/${messageId}`,
        { method: "DELETE" },
      );
      directMessageResponseSchema.parse(payload);
      await loadConversation();
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

  if (errorMessage) {
    return (
      <div className="rounded-[18px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="premium-tile rounded-[16px] p-4 text-sm text-[var(--text-muted)]">
        Загружаем чат...
      </div>
    );
  }

  const counterpart = conversation.participants.find(
    (participant) => participant.user.id !== viewerId,
  )?.user;
  const isBlocked =
    conversation.isBlockedByViewer || conversation.hasBlockedViewer;
  const viewerSettings =
    conversation.participants.find((participant) => participant.user.id === viewerId)
      ?.notificationSetting ?? "ALL";

  return (
    <div className="grid min-h-0 gap-3">
      <section className="premium-panel flex min-h-[calc(100vh-9.5rem)] flex-col overflow-hidden rounded-[20px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            {counterpart ? <UserAvatar user={counterpart} size="md" /> : null}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">
                  {counterpart?.profile.displayName ?? "Диалог"}
                </p>
                <span className="status-pill">
                  <UserRound className="h-3.5 w-3.5 text-[var(--accent)]" />
                  DM
                </span>
                {conversation.retentionMode !== "OFF" ? (
                  <span className="status-pill">
                    <Clock3 className="h-3.5 w-3.5 text-[var(--accent)]" />
                    {conversation.retentionMode}
                  </span>
                ) : null}
                {isBlocked ? (
                  <span className="status-pill">
                    <ShieldAlert className="h-3.5 w-3.5 text-[var(--danger)]" />
                    Ограничение
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--text-dim)]">
                {counterpart ? `@${counterpart.username}` : "Личный диалог"}
              </p>
            </div>
          </div>

          <Link href="/app/messages">
            <Button size="sm" variant="secondary">
              <ArrowLeft className="h-4 w-4" />
              Все диалоги
            </Button>
          </Link>
        </div>

        {isBlocked ? (
          <div className="border-b border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-50">
            Новые сообщения и звонки ограничены.
          </div>
        ) : null}

        <div className="border-b border-white/8 px-3 py-2.5">
          <DmCallPanel
            conversationId={conversationId}
            viewerId={viewerId}
            isBlocked={isBlocked}
          />
        </div>

        <div className="min-h-0 flex-1 px-3 py-3">
          <MessageThread
            viewerId={viewerId}
            conversation={conversation}
            isDeleting={isDeleting}
            onDelete={deleteMessage}
          />
        </div>

        <div className="border-t border-white/8 px-3 py-2.5">
          <MessageComposer disabled={isBlocked} onSend={sendMessage} />
        </div>
      </section>

      <div className="premium-panel rounded-[20px] p-3 2xl:hidden">
        <ConversationSettings
          notificationSetting={viewerSettings}
          retentionMode={conversation.retentionMode}
          retentionSeconds={conversation.retentionSeconds}
          disabled={false}
          onSave={saveSettings}
        />
      </div>
    </div>
  );
}
