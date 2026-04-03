"use client";

import Link from "next/link";
import {
  ArrowUpRight,
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
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

function getUnreadTotal(items: DirectConversationSummary[]) {
  return items.reduce(
    (sum: number, item: DirectConversationSummary) => sum + item.unreadCount,
    0,
  );
}

function getBlockedTotal(items: DirectConversationSummary[]) {
  return items.filter(
    (item: DirectConversationSummary) =>
      item.isBlockedByViewer || item.hasBlockedViewer,
  ).length;
}

function getRetentionTotal(items: DirectConversationSummary[]) {
  return items.filter(
    (item: DirectConversationSummary) => item.retentionMode !== "OFF",
  ).length;
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

  return (
    <section className="social-shell rounded-[32px] p-5 lg:p-6">
      <div className="surface-highlight rounded-[28px] p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Мессенджер</p>
            <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-semibold tracking-[-0.05em] text-white lg:text-4xl">
              Личные диалоги
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-dim)]">
              Это не таблица входящих и не CRM-список. Перед вами плотный слой
              личных коммуникаций: быстрый переход к живым контактам,
              непрочитанным потокам и новым приватным каналам связи.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="eyebrow-pill">
              <Sparkles className="h-3.5 w-3.5" /> Приватная сеть
            </span>
            <span className="status-pill">
              <Waves className="h-3.5 w-3.5 text-[var(--accent)]" />
              {conversations.length} активных диалогов
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="metric-tile rounded-[22px] px-4 py-4">
            <p className="section-kicker">Непрочитанные</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {getUnreadTotal(conversations)}
            </p>
          </div>
          <div className="metric-tile rounded-[22px] px-4 py-4">
            <p className="section-kicker">С блокировкой</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {getBlockedTotal(conversations)}
            </p>
          </div>
          <div className="metric-tile rounded-[22px] px-4 py-4">
            <p className="section-kicker">Автоудаление</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {getRetentionTotal(conversations)}
            </p>
          </div>
        </div>
      </div>

      <form
        className="surface-subtle mt-5 flex flex-col gap-3 rounded-[26px] p-4 lg:flex-row lg:items-center"
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
        <Button type="submit" disabled={isOpening} className="lg:min-w-[220px]">
          <UserRoundPlus className="h-4 w-4" />
          {isOpening ? "Открываем канал..." : "Создать / открыть диалог"}
        </Button>
      </form>

      {errorMessage ? (
        <div className="mt-4 rounded-[22px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {isLoading ? (
          <div className="surface-subtle rounded-[26px] p-5 text-sm text-[var(--text-muted)]">
            Загружаем приватные каналы...
          </div>
        ) : conversations.length === 0 ? (
          <div className="surface-subtle rounded-[26px] p-6 text-sm leading-7 text-[var(--text-muted)]">
            Диалогов пока нет. Начните первую персональную линию связи по
            username — новый чат сразу появится в рабочей сети.
          </div>
        ) : (
          conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/app/messages/${conversation.id}`}
              className="list-row rounded-[28px] p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-semibold text-white">
                      {conversation.counterpart.profile.displayName}
                    </p>
                    {conversation.isBlockedByViewer ||
                    conversation.hasBlockedViewer ? (
                      <span className="glass-badge">ограничение</span>
                    ) : null}
                    {conversation.retentionMode !== "OFF" ? (
                      <span className="glass-badge">автоудаление</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">
                    @{conversation.counterpart.username}
                  </p>
                  <p className="mt-3 line-clamp-2 text-sm leading-7 text-[var(--text-dim)]">
                    {conversation.lastMessage?.isDeleted
                      ? "Последнее сообщение удалено"
                      : (conversation.lastMessage?.content ??
                        "Диалог пуст — откройте канал и начните разговор.")}
                  </p>
                </div>

                <div className="flex min-w-[180px] flex-wrap items-center justify-between gap-3 lg:justify-end">
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">
                      Непрочитано
                    </p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {conversation.unreadCount}
                    </p>
                  </div>
                  <span className="status-pill">
                    Открыть{" "}
                    <ArrowUpRight className="h-3.5 w-3.5 text-[var(--accent)]" />
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
