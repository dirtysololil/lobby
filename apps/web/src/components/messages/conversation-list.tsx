"use client";

import Link from "next/link";
import { Clock3, MessageSquareMore, Search, UserRoundPlus } from "lucide-react";
import {
  directConversationListResponseSchema,
  directConversationSummaryResponseSchema,
  type DirectConversationSummary,
} from "@lobby/shared";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRealtime } from "@/components/realtime/realtime-provider";
import { apiClientFetch } from "@/lib/api-client";
import { applyDmSignalToConversationSummaries } from "@/lib/direct-message-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { dmRetentionLabels } from "@/lib/ui-labels";

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

function getUnreadTotal(items: DirectConversationSummary[]) {
  return items.reduce((sum, item) => sum + item.unreadCount, 0);
}

function formatConversationTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return sameDay
    ? date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : date.toLocaleDateString("ru-RU", {
        month: "short",
        day: "numeric",
      });
}

export function ConversationList() {
  const router = useRouter();
  const { latestDmSignal } = useRealtime();
  const [conversations, setConversations] = useState<DirectConversationSummary[]>(
    [],
  );
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (!latestDmSignal) {
      return;
    }

    setConversations((current) =>
      applyDmSignalToConversationSummaries(current, latestDmSignal),
    );
  }, [latestDmSignal]);

  async function loadConversations() {
    setIsLoading(true);
    try {
      const payload = await apiClientFetch("/v1/direct-messages");
      setConversations(directConversationListResponseSchema.parse(payload).items);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить диалоги.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenConversation() {
    if (!username.trim()) {
      return;
    }

    setIsOpening(true);

    try {
      const payload = await apiClientFetch("/v1/direct-messages/open", {
        method: "POST",
        body: JSON.stringify({ username: username.trim().toLowerCase() }),
      });

      const conversation =
        directConversationSummaryResponseSchema.parse(payload).conversation;
      setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
      router.push(`/app/messages/${conversation.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось открыть диалог.",
      );
    } finally {
      setIsOpening(false);
    }
  }

  const orderedConversations = useMemo(() => {
    return [...conversations].sort((left, right) => {
      if (left.unreadCount !== right.unreadCount) {
        return right.unreadCount - left.unreadCount;
      }

      return (
        new Date(right.lastMessageAt ?? 0).getTime() -
        new Date(left.lastMessageAt ?? 0).getTime()
      );
    });
  }, [conversations]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--bg-app)]">
      <div className="flex h-11 items-center justify-between gap-3 border-b border-white/5 bg-[rgba(12,15,20,0.84)] px-3 backdrop-blur-md">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tracking-tight text-white">
              Диалоги
            </span>
            <span className="text-xs text-zinc-500">
              {conversations.length} чатов
            </span>
            <span className="text-xs text-zinc-500">
              {getUnreadTotal(conversations)} непрочитанных
            </span>
          </div>
        </div>

        <form
          className="flex w-full max-w-[360px] gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleOpenConversation();
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search
              {...iconProps}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <Input
              className="h-9 border-white/6 bg-[var(--bg-panel-muted)] pl-9 text-sm text-white placeholder:text-[var(--text-muted)]"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@username"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={isOpening} size="sm" className="shrink-0">
            <UserRoundPlus {...iconProps} />
            {isOpening ? "Открываем..." : "Новый диалог"}
          </Button>
        </form>
      </div>

      {errorMessage ? (
        <div className="border-b border-white/5 px-4 py-2 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-xs text-zinc-500">
        <span>{orderedConversations.length} веток</span>
        <Link href="/app/people?view=discover" className="inline-flex items-center gap-1 text-zinc-400 hover:text-white">
          <UserRoundPlus {...iconProps} />
          Найти людей
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="empty-state-minimal text-zinc-500">
            <MessageSquareMore {...iconProps} />
            <p className="text-sm">Загружаем диалоги...</p>
          </div>
        ) : orderedConversations.length === 0 ? (
          <div className="empty-state-minimal text-zinc-500">
            <MessageSquareMore size={20} strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-white">Диалогов пока нет</p>
              <p className="mt-1 text-xs text-zinc-500">
                Откройте диалог по имени пользователя или через раздел «Люди».
              </p>
            </div>
          </div>
        ) : (
          orderedConversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/app/messages/${conversation.id}`}
              className="flex min-h-12 items-center gap-3 border-b border-white/5 px-3 py-2 transition-colors hover:bg-white/5"
            >
              <UserAvatar user={conversation.counterpart} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium tracking-tight text-white">
                    {conversation.counterpart.profile.displayName}
                  </p>
                  {conversation.unreadCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] text-white">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                  {conversation.retentionMode !== "OFF" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <Clock3 {...iconProps} />
                      {dmRetentionLabels[conversation.retentionMode]}
                    </span>
                  ) : null}
                  <span className="ml-auto shrink-0 text-xs text-zinc-500">
                    {formatConversationTime(conversation.lastMessageAt)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  @{conversation.counterpart.username}
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate text-[13px] leading-tight",
                    conversation.unreadCount > 0 ? "text-zinc-200" : "text-zinc-400",
                  )}
                >
                  {conversation.lastMessage?.isDeleted
                    ? "Последнее сообщение удалено"
                    : (conversation.lastMessage?.content ?? "Напишите первым")}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
