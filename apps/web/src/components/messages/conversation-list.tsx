"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Clock3,
  Search,
  Sparkles,
  UserRoundPlus,
  Waves,
} from "lucide-react";
import {
  directConversationListResponseSchema,
  directConversationSummaryResponseSchema,
  type DirectConversationSummary,
} from "@lobby/shared";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";

function getUnreadTotal(items: DirectConversationSummary[]) {
  return items.reduce((sum, item) => sum + item.unreadCount, 0);
}

function getRetentionTotal(items: DirectConversationSummary[]) {
  return items.filter((item) => item.retentionMode !== "OFF").length;
}

export function ConversationList() {
  const router = useRouter();
  const [conversations, setConversations] = useState<
    DirectConversationSummary[]
  >([]);
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    void loadConversations();
  }, []);

  async function loadConversations() {
    setIsLoading(true);
    try {
      const payload = await apiClientFetch("/v1/direct-messages");
      setConversations(
        directConversationListResponseSchema.parse(payload).items,
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить диалоги",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenConversation() {
    if (!username.trim()) return;
    setIsOpening(true);
    try {
      const payload = await apiClientFetch("/v1/direct-messages/open", {
        method: "POST",
        body: JSON.stringify({ username: username.trim().toLowerCase() }),
      });
      const conversation =
        directConversationSummaryResponseSchema.parse(payload).conversation;
      router.push(`/app/messages/${conversation.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось открыть диалог",
      );
    } finally {
      setIsOpening(false);
    }
  }

  const highlightedConversations = useMemo(() => {
    return [...conversations]
      .sort((left, right) => right.unreadCount - left.unreadCount)
      .slice(0, 6);
  }, [conversations]);

  return (
    <section className="grid gap-4">
      <div className="premium-panel rounded-[28px] p-5 lg:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <Waves className="h-3.5 w-3.5" />
                Messenger
              </span>
              <span className="status-pill">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                {conversations.length} каналов
              </span>
            </div>

            <h2 className="mt-4 font-[var(--font-heading)] text-[2rem] font-semibold tracking-[-0.05em] text-white">
              Inbox для личных линий связи
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
              Центральная сцена показывает не таблицу переписок, а рабочий
              коммуникационный пульт: быстрый вход в прямой канал, unread фокус
              и последнее приватное движение в сети.
            </p>

            <form
              className="surface-highlight mt-5 flex flex-col gap-3 rounded-[22px] p-4 lg:flex-row lg:items-center"
              onSubmit={(event) => {
                event.preventDefault();
                void handleOpenConversation();
              }}
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  className="pl-11"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Введите username для нового приватного канала"
                  autoComplete="off"
                />
              </div>
              <Button
                type="submit"
                disabled={isOpening}
                className="lg:min-w-[220px]"
              >
                <UserRoundPlus className="h-4 w-4" />
                {isOpening ? "Открываем..." : "Открыть диалог"}
              </Button>
            </form>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="metric-tile rounded-[20px] p-4">
              <p className="section-kicker">Unread</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {getUnreadTotal(conversations)}
              </p>
            </div>
            <div className="metric-tile rounded-[20px] p-4">
              <p className="section-kicker">Retention</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {getRetentionTotal(conversations)}
              </p>
            </div>
            <div className="metric-tile rounded-[20px] p-4">
              <p className="section-kicker">State</p>
              <p className="mt-2 text-sm font-semibold text-white">
                Ready for direct communication
              </p>
            </div>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-[20px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="premium-panel rounded-[28px] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="section-kicker">Priority Conversations</p>
            <span className="glass-badge">{highlightedConversations.length}</span>
          </div>

          <div className="mt-4 grid gap-3">
            {isLoading ? (
              <div className="surface-subtle rounded-[22px] p-5 text-sm text-[var(--text-muted)]">
                Загружаем приватные линии...
              </div>
            ) : highlightedConversations.length === 0 ? (
              <div className="surface-subtle rounded-[22px] p-6 text-sm leading-6 text-[var(--text-muted)]">
                Диалогов пока нет. Откройте первый канал по username и продукт
                сразу начнет ощущаться как живая приватная сеть, а не пустая
                витрина.
              </div>
            ) : (
              highlightedConversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/app/messages/${conversation.id}`}
                  className="list-row rounded-[22px] p-4"
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar user={conversation.counterpart} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {conversation.counterpart.profile.displayName}
                        </p>
                        {conversation.unreadCount > 0 ? (
                          <span className="glass-badge">
                            {conversation.unreadCount} unread
                          </span>
                        ) : null}
                        {conversation.retentionMode !== "OFF" ? (
                          <span className="glass-badge">
                            <Clock3 className="h-3 w-3" />
                            retention
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">
                        @{conversation.counterpart.username}
                      </p>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-dim)]">
                        {conversation.lastMessage?.isDeleted
                          ? "Последнее сообщение удалено"
                          : (conversation.lastMessage?.content ??
                            "Канал открыт и ждет первого сообщения.")}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="premium-panel rounded-[28px] p-5">
            <p className="section-kicker">Conversation System</p>
            <div className="mt-4 grid gap-3">
              <div className="surface-subtle rounded-[20px] p-4">
                <p className="text-sm font-semibold text-white">
                  Плотный desktop rhythm
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                  Контекстный rail держит полный список каналов, а центр
                  забирает фокус только на том, что требует ответа прямо сейчас.
                </p>
              </div>
              <div className="surface-subtle rounded-[20px] p-4">
                <p className="text-sm font-semibold text-white">
                  Voice-ready shell
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                  Звонки, unread и retention читаются как часть одного потока, а
                  не как отдельные сервисные панели.
                </p>
              </div>
            </div>
          </div>

          <div className="premium-panel rounded-[28px] p-5">
            <p className="section-kicker">Recent Movement</p>
            <div className="mt-4 grid gap-2">
              {conversations.slice(0, 4).map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/app/messages/${conversation.id}`}
                  className="context-link rounded-[18px]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {conversation.counterpart.profile.displayName}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--text-dim)]">
                      {conversation.lastMessage?.content ?? "Пустой канал"}
                    </span>
                  </span>
                  {conversation.unreadCount > 0 ? (
                    <span className="glass-badge">{conversation.unreadCount}</span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
