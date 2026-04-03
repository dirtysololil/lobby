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
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";

function getUnreadTotal(items: DirectConversationSummary[]) {
  return items.reduce((sum, item) => sum + item.unreadCount, 0);
}

function getRetentionTotal(items: DirectConversationSummary[]) {
  return items.filter((item) => item.retentionMode !== "OFF").length;
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
        day: "numeric",
        month: "short",
      });
}

export function ConversationList() {
  const router = useRouter();
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

  async function loadConversations() {
    setIsLoading(true);
    try {
      const payload = await apiClientFetch("/v1/direct-messages");
      setConversations(directConversationListResponseSchema.parse(payload).items);
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
    <section className="grid gap-3">
      <div className="social-shell rounded-[20px] p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <MessageSquareMore className="h-3.5 w-3.5" />
                Inbox
              </span>
              <span className="status-pill">{conversations.length} threads</span>
              <span className="status-pill">{getUnreadTotal(conversations)} unread</span>
            </div>
            <h2 className="mt-1.5 font-[var(--font-heading)] text-[1.15rem] font-semibold tracking-[-0.04em] text-white">
              Inbox
            </h2>
          </div>

          <form
            className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-[460px]"
            onSubmit={(event) => {
              event.preventDefault();
              void handleOpenConversation();
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                className="pl-9"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="@username"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={isOpening}>
              <UserRoundPlus className="h-4 w-4" />
              {isOpening ? "Открываем..." : "Новый DM"}
            </Button>
          </form>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-[16px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="premium-panel overflow-hidden rounded-[20px]">
        <div className="compact-toolbar border-b border-white/8 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="glass-badge">{getRetentionTotal(conversations)} retention</span>
            <span className="glass-badge">Sorted by unread</span>
          </div>
          <Link href="/app/people?view=discover" className="glass-badge">
            <UserRoundPlus className="h-3 w-3" />
            Find people
          </Link>
        </div>

        <div className="grid gap-1 p-2">
          {isLoading ? (
            <div className="surface-subtle rounded-[16px] px-3 py-3 text-sm text-[var(--text-muted)]">
              Загружаем inbox...
            </div>
          ) : orderedConversations.length === 0 ? (
            <div className="surface-subtle rounded-[16px] px-3 py-3 text-sm text-[var(--text-muted)]">
              Пока пусто. Откройте DM по username или через People.
            </div>
          ) : (
            orderedConversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/app/messages/${conversation.id}`}
                className="list-row rounded-[16px] px-3 py-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <UserAvatar user={conversation.counterpart} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {conversation.counterpart.profile.displayName}
                      </p>
                      {conversation.unreadCount > 0 ? (
                        <span className="glass-badge">{conversation.unreadCount}</span>
                      ) : null}
                      {conversation.retentionMode !== "OFF" ? (
                        <span className="glass-badge">
                          <Clock3 className="h-3 w-3" />
                          {conversation.retentionMode}
                        </span>
                      ) : null}
                      {conversation.isBlockedByViewer || conversation.hasBlockedViewer ? (
                        <span className="glass-badge">Blocked</span>
                      ) : null}
                      <span className="ml-auto text-xs text-[var(--text-muted)]">
                        {formatConversationTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                      @{conversation.counterpart.username}
                    </p>
                    <p className="mt-1.5 truncate text-sm text-[var(--text-dim)]">
                      {conversation.lastMessage?.isDeleted
                        ? "Последнее сообщение удалено"
                        : (conversation.lastMessage?.content ?? "Напишите первым")}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
