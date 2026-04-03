"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  directConversationDetailSchema,
  directConversationSummaryResponseSchema,
  directMessageResponseSchema,
  type DirectConversationDetail,
} from "@lobby/shared";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
      const payload = await apiClientFetch(
        `/v1/direct-messages/${conversationId}`,
      );
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

  if (errorMessage)
    return (
      <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  if (!conversation)
    return (
      <div className="premium-tile rounded-3xl p-5 text-sm text-[var(--text-muted)]">
        Загружаем чат...
      </div>
    );

  const counterpart = conversation.participants.find(
    (participant) => participant.user.id !== viewerId,
  )?.user;
  const isBlocked =
    conversation.isBlockedByViewer || conversation.hasBlockedViewer;

  return (
    <div className="grid min-h-0 gap-4">
      <section className="premium-panel flex min-h-[calc(100vh-16rem)] flex-col overflow-hidden rounded-[28px]">
        <div className="surface-highlight rounded-b-[24px] rounded-t-[28px] px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="section-kicker">Личный канал</p>
              <h2 className="mt-2 font-[var(--font-heading)] text-[1.7rem] font-semibold tracking-[-0.05em] text-white">
                {counterpart?.profile.displayName ?? "Личный диалог"}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-dim)]">
                {counterpart
                  ? `@${counterpart.username}`
                  : "Собеседник не найден"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="status-pill">
                  <UserRound className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Прямое общение
                </span>
                {conversation.retentionMode !== "OFF" ? (
                  <span className="status-pill">
                    <Clock3 className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Автоудаление
                  </span>
                ) : null}
                {isBlocked ? (
                  <span className="status-pill">
                    <ShieldAlert className="h-3.5 w-3.5 text-[var(--danger)]" />
                    Ограничение
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="glass-badge">
                <Sparkles className="h-3 w-3" />
                {conversation.messages.length} сообщений
              </span>
              <Link href="/app/messages">
                <Button variant="secondary">
                  <ArrowLeft className="h-4 w-4" />
                  Все диалоги
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {isBlocked ? (
          <div className="mx-5 mt-4 rounded-[18px] border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
            Обмен сообщениями ограничен: один из участников заблокирован.
            История остаётся доступной, но новые сообщения и звонки могут быть
            недоступны.
          </div>
        ) : null}

        <div className="min-h-0 flex-1 px-5 py-4">
          <MessageThread
            viewerId={viewerId}
            conversation={conversation}
            isDeleting={isDeleting}
            onDelete={deleteMessage}
          />
        </div>

        <div className="border-t border-[var(--border-soft)] px-5 py-4">
          <MessageComposer disabled={isBlocked} onSend={sendMessage} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-1">
        <DmCallPanel
          conversationId={conversationId}
          viewerId={viewerId}
          isBlocked={isBlocked}
        />

        <div className="premium-panel rounded-[28px] p-5 2xl:hidden">
          <div className="surface-subtle mb-4 rounded-[20px] p-4 text-sm leading-6 text-[var(--text-dim)]">
            Правая панель на desktop держит meta-слой разговора. На tablet и
            mobile настройки диалога остаются здесь, чтобы flow не терялся.
          </div>
          <ConversationSettings
            notificationSetting={
              conversation.participants.find(
                (participant) => participant.user.id === viewerId,
              )?.notificationSetting ?? "ALL"
            }
            retentionMode={conversation.retentionMode}
            retentionSeconds={conversation.retentionSeconds}
            disabled={false}
            onSave={saveSettings}
          />
        </div>
      </div>
    </div>
  );
}
