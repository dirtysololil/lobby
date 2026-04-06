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
import {
  CompactList,
  CompactListCount,
  CompactListHeader,
  CompactListLink,
  CompactListMeta,
} from "@/components/ui/compact-list";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  useOptionalRealtimePresence,
  useRealtime,
} from "@/components/realtime/realtime-provider";
import { apiClientFetch } from "@/lib/api-client";
import { applyDmSignalToConversationSummaries } from "@/lib/direct-message-state";
import { getAvailabilityLabel } from "@/lib/last-seen";
import { dmRetentionLabels } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

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
        day: "numeric",
        month: "short",
      });
}

export function ConversationList() {
  const router = useRouter();
  const { latestDmSignal } = useRealtime();
  const realtimePresence = useOptionalRealtimePresence();
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([]);
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
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить диалоги.");
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
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ]);
      setUsername("");
      router.push(`/app/messages/${conversation.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть диалог.");
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
      <div className="border-b border-[var(--border-soft)] px-3 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CompactListMeta>Сообщения</CompactListMeta>
              <CompactListMeta>{conversations.length} диалогов</CompactListMeta>
              <CompactListMeta>{getUnreadTotal(conversations)} непрочитанных</CompactListMeta>
            </div>
            <h2 className="mt-2 text-base font-semibold tracking-tight text-white">
              Личные сообщения
            </h2>
          </div>

          <form
            className="w-full max-w-[468px]"
            onSubmit={(event) => {
              event.preventDefault();
              void handleOpenConversation();
            }}
          >
            <div className="flex items-center gap-2 rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-transparent bg-[var(--bg-panel-muted)] px-3 text-[var(--text-muted)] transition-colors focus-within:border-[var(--border-strong)] focus-within:bg-white/[0.06]">
                <Search {...iconProps} className="h-4 w-4 shrink-0" />
                <input
                  className="h-9 w-full border-0 bg-transparent px-0 text-sm leading-none text-white outline-none placeholder:text-[var(--text-muted)]"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="@username"
                  autoComplete="off"
                  aria-label="Ник пользователя для нового диалога"
                />
              </label>
              <Button
                type="submit"
                disabled={isOpening}
                className="h-9 shrink-0 rounded-[14px] px-3.5"
              >
                <UserRoundPlus {...iconProps} />
                {isOpening ? "Открываем..." : "Новое ЛС"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {errorMessage ? (
        <div className="border-b border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      <CompactListHeader className="border-b border-[var(--border-soft)] px-3 py-2">
        <span>Диалоги</span>
        <Link
          href="/app/people?view=discover"
          className="inline-flex items-center gap-1 normal-case tracking-normal text-[var(--text-dim)] transition-colors hover:text-white"
        >
          <UserRoundPlus {...iconProps} />
          Найти людей
        </Link>
      </CompactListHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="empty-state-minimal text-[var(--text-muted)]">
            <MessageSquareMore {...iconProps} />
            <p className="text-sm">Загружаем диалоги...</p>
          </div>
        ) : orderedConversations.length === 0 ? (
          <div className="empty-state-minimal text-[var(--text-muted)]">
            <MessageSquareMore size={20} strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-white">Диалогов пока нет</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Начните переписку по нику или откройте ЛС из списка людей.
              </p>
            </div>
          </div>
        ) : (
          <CompactList>
            {orderedConversations.map((conversation) => (
              <CompactListLink
                key={conversation.id}
                href={`/app/messages/${conversation.id}`}
                unread={conversation.unreadCount > 0}
                className="gap-3"
              >
                <UserAvatar user={conversation.counterpart} size="sm" />
                <div className="min-w-0 flex-1">
                  {(() => {
                    const liveCounterpart =
                      realtimePresence !== null
                        ? {
                            ...conversation.counterpart,
                            isOnline: Boolean(
                              realtimePresence[conversation.counterpart.id],
                            ),
                          }
                        : conversation.counterpart;
                    const availabilityLabel = getAvailabilityLabel(liveCounterpart);

                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium tracking-tight text-white">
                            {conversation.counterpart.profile.displayName}
                          </p>
                          {conversation.unreadCount > 0 ? (
                            <CompactListCount>{conversation.unreadCount}</CompactListCount>
                          ) : null}
                          {conversation.retentionMode !== "OFF" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                              <Clock3 {...iconProps} />
                              {dmRetentionLabels[conversation.retentionMode]}
                            </span>
                          ) : null}
                          <span className="ml-auto shrink-0 text-[11px] text-[var(--text-muted)]">
                            {formatConversationTime(conversation.lastMessageAt)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="truncate text-[var(--text-muted)]">
                            @{conversation.counterpart.username}
                          </span>
                          {availabilityLabel ? (
                            <>
                              <span className="text-[var(--text-muted)]">•</span>
                              <span
                                className={cn(
                                  "truncate",
                                  liveCounterpart.isOnline
                                    ? "text-[var(--text-soft)]"
                                    : "text-[var(--text-muted)]",
                                )}
                              >
                                {availabilityLabel}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </>
                    );
                  })()}
                  <p
                    className={cn(
                      "mt-1 truncate text-[13px] leading-tight",
                      conversation.unreadCount > 0 ? "text-zinc-100" : "text-zinc-400",
                    )}
                  >
                    {conversation.lastMessage?.isDeleted
                      ? "Последнее сообщение удалено"
                      : (conversation.lastMessage?.content ?? "Напишите первым")}
                  </p>
                </div>
              </CompactListLink>
            ))}
          </CompactList>
        )}
      </div>
    </section>
  );
}
