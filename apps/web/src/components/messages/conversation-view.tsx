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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="surface-highlight rounded-[28px] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="section-kicker">Личный канал</p>
                <CardTitle>
                  {counterpart?.profile.displayName ?? "Личный диалог"}
                </CardTitle>
                <CardDescription>
                  {counterpart
                    ? `@${counterpart.username}`
                    : "Собеседник не найден"}
                </CardDescription>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="status-pill">
                    <UserRound className="h-3.5 w-3.5 text-[var(--accent)]" />
                    Прямое общение
                  </span>
                  {conversation.retentionMode !== "OFF" ? (
                    <span className="status-pill">
                      <Clock3 className="h-3.5 w-3.5 text-[var(--accent)]" />
                      Автоудаление активно
                    </span>
                  ) : null}
                  {isBlocked ? (
                    <span className="status-pill">
                      <ShieldAlert className="h-3.5 w-3.5 text-[var(--danger)]" />
                      Есть ограничения
                    </span>
                  ) : null}
                </div>
              </div>
              <Link href="/app/messages">
                <Button variant="secondary">
                  <ArrowLeft className="h-4 w-4" />
                  Все диалоги
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="metric-tile rounded-[22px] px-4 py-4">
              <p className="section-kicker">Сообщений</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {conversation.messages.length}
              </p>
            </div>
            <div className="metric-tile rounded-[22px] px-4 py-4">
              <p className="section-kicker">Участников</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {conversation.participants.length}
              </p>
            </div>
            <div className="metric-tile rounded-[22px] px-4 py-4">
              <p className="section-kicker">Режим</p>
              <p className="mt-2 text-base font-semibold text-white">
                {conversation.retentionMode === "OFF"
                  ? "Постоянный"
                  : "С автоудалением"}
              </p>
            </div>
          </div>
          {isBlocked ? (
            <div className="rounded-[22px] border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
              Обмен сообщениями ограничен: один из участников заблокирован.
              История остаётся видимой, но новые сообщения и звонки могут быть
              недоступны.
            </div>
          ) : null}
          <DmCallPanel
            conversationId={conversationId}
            viewerId={viewerId}
            isBlocked={isBlocked}
          />
          <MessageThread
            viewerId={viewerId}
            conversation={conversation}
            isDeleting={isDeleting}
            onDelete={deleteMessage}
          />
          <MessageComposer disabled={isBlocked} onSend={sendMessage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="section-kicker">Правая панель</p>
          <CardTitle>Контекст диалога</CardTitle>
          <CardDescription>
            Точечные настройки уведомлений, режим хранения и статус приватного
            канала.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="surface-subtle mb-4 rounded-[24px] p-4 text-sm leading-7 text-[var(--text-dim)]">
            <span className="inline-flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
              Интеллект диалога
            </span>
            <p className="mt-2">
              Правая панель фиксирует meta-слой: условия взаимодействия, срок
              жизни истории и ограничения контента для конкретной пары
              участников.
            </p>
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
        </CardContent>
      </Card>
    </div>
  );
}
