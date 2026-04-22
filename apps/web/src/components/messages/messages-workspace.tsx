"use client";

import Link from "next/link";
import {
  ChevronDown,
  MessageSquareMore,
  Search,
  SlidersHorizontal,
  SquarePen,
  UserRoundPlus,
} from "lucide-react";
import {
  directConversationListResponseSchema,
  type DirectConversationSummary,
} from "@lobby/shared";
import { useEffect, useMemo, useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { applyDmSignalToConversationSummaries } from "@/lib/direct-message-state";
import { cn } from "@/lib/utils";
import {
  useOptionalRealtimePresence,
  useRealtime,
} from "@/components/realtime/realtime-provider";

const iconProps = { size: 20, strokeWidth: 1.6 } as const;

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

export function MessagesWorkspace() {
  const { latestDmSignal } = useRealtime();
  const realtimePresence = useOptionalRealtimePresence();
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageFilter, setMessageFilter] = useState<"all" | "personal" | "unread">(
    "personal",
  );

  useEffect(() => {
    if (!latestDmSignal) {
      return;
    }

    setConversations((current) =>
      applyDmSignalToConversationSummaries(current, latestDmSignal),
    );
  }, [latestDmSignal]);

  useEffect(() => {
    let active = true;

    void (async () => {
      setIsLoading(true);

      try {
        const payload = await apiClientFetch("/v1/direct-messages");

        if (!active) {
          return;
        }

        setConversations(directConversationListResponseSchema.parse(payload).items);
      } catch {
        if (active) {
          setConversations([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const normalizedMessageSearchQuery = messageSearchQuery.trim().toLowerCase();
  const filteredConversations = useMemo(() => {
    const orderedItems = [...conversations].sort((left, right) => {
      return (
        new Date(right.lastMessageAt ?? 0).getTime() -
        new Date(left.lastMessageAt ?? 0).getTime()
      );
    });

    return orderedItems.filter((conversation) => {
      if (messageFilter === "unread" && conversation.unreadCount === 0) {
        return false;
      }

      const searchableText = [
        conversation.counterpart.profile.displayName,
        conversation.counterpart.username,
        conversation.lastMessagePreview,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase();

      if (!normalizedMessageSearchQuery) {
        return true;
      }

      return searchableText.includes(normalizedMessageSearchQuery);
    });
  }, [conversations, messageFilter, normalizedMessageSearchQuery]);

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0d151f] md:bg-[linear-gradient(180deg,rgba(255,255,255,0.012),transparent_14%),#0f1721]">
      <div className="flex h-full min-h-0 flex-col md:hidden">
        <div className="border-b border-white/5 px-4 pb-3 pt-5">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[24px] font-semibold tracking-[-0.04em] text-white"
            >
              <span>Чаты</span>
              <ChevronDown
                size={16}
                strokeWidth={1.9}
                className="mt-1 text-[#7b8697]"
              />
            </button>
            <Link
              href="/app/people?view=discover"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/6 bg-white/[0.035] text-[#9ca9bb]"
              aria-label="Новый чат"
              title="Новый чат"
            >
              <SquarePen size={18} strokeWidth={1.75} />
            </Link>
          </div>
        </div>

        <div className="border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-white/6 bg-white/[0.04] px-3 text-[#9ca9bb] focus-within:border-[#3b6ed8]/32">
              <Search size={17} strokeWidth={1.75} className="shrink-0" />
              <input
                className="w-full border-0 bg-transparent p-0 text-[14px] text-white outline-none placeholder:text-[#7b8697]"
                value={messageSearchQuery}
                onChange={(event) => setMessageSearchQuery(event.target.value)}
                placeholder="Поиск"
                aria-label="Поиск по диалогам"
              />
            </label>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/6 bg-white/[0.04] text-[#9ca9bb]"
              aria-label="Фильтры диалогов"
              title="Фильтры диалогов"
            >
              <SlidersHorizontal size={17} strokeWidth={1.75} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-6 border-b border-white/5 pb-0.5 pl-1 text-[13px] font-medium text-[#7f8a9c]">
            {[
              { id: "all", label: "Все" },
              { id: "personal", label: "Личные" },
              { id: "unread", label: "Непрочитанные" },
            ].map((item) => {
              const active = messageFilter === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setMessageFilter(item.id as "all" | "personal" | "unread")
                  }
                  className={cn(
                    "relative pb-2 transition-colors",
                    active ? "text-[#4a84ff]" : "hover:text-white",
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-0 bottom-[-2px] h-[2px] rounded-full bg-[#4a84ff]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-0 py-2">
          {isLoading ? (
            <div className="flex h-full items-center justify-center px-5 text-center text-sm text-[#7b8697]">
              Загружаем диалоги...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <p className="text-sm text-[#9ba8bc]">
                {messageSearchQuery
                  ? "По вашему запросу диалогов не найдено."
                  : "Личных диалогов пока нет."}
              </p>
              <Link
                href="/app/people?view=discover"
                className="inline-flex min-h-10 items-center justify-center rounded-[14px] border border-[#4a84ff]/24 bg-[#14233a] px-4 text-sm font-medium text-white"
              >
                Найти людей
              </Link>
            </div>
          ) : (
            <div className="grid gap-0.5">
              {filteredConversations.map((conversation) => {
                const liveCounterpart =
                  realtimePresence !== null
                    ? {
                        ...conversation.counterpart,
                        isOnline: Boolean(
                          realtimePresence[conversation.counterpart.id],
                        ),
                      }
                    : conversation.counterpart;

                return (
                  <Link
                    key={conversation.id}
                    href={`/app/messages/${conversation.id}`}
                    className="group relative grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 border border-transparent py-3 pl-5 pr-4 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="relative row-span-2 mt-0.5">
                      <UserAvatar
                        user={conversation.counterpart}
                        size="sm"
                        className="h-12 w-12 text-[12px]"
                        showPresenceIndicator={false}
                      />
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[2px] border-[#0d151f] bg-[#6b7381]",
                          liveCounterpart.isOnline && "bg-[#2ecf7c]",
                        )}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-white">
                          {conversation.counterpart.profile.displayName}
                        </p>
                        {liveCounterpart.isOnline ? (
                          <span className="h-2 w-2 rounded-full bg-[#2ecf7c]" />
                        ) : null}
                      </div>
                      <p
                        className={cn(
                          "mt-1 truncate text-[13px]",
                          conversation.unreadCount > 0
                            ? "text-[#d9e3f2]"
                            : "text-[#8894a6]",
                        )}
                      >
                        {conversation.lastMessagePreview ?? "Сообщений пока нет"}
                      </p>
                    </div>

                    <div className="row-span-2 flex min-w-[2.75rem] flex-col items-end gap-2 text-[12px] text-[#7f8a9c]">
                      <span>{formatConversationTime(conversation.lastMessageAt)}</span>
                      {conversation.unreadCount > 0 ? (
                        <span className="inline-flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#4a84ff] px-1.5 text-[11px] font-semibold text-white">
                          {conversation.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-2 text-center text-[12px] text-[#7b8697]">
          {conversations.length} диалогов
        </div>
      </div>

      <div className="absolute inset-0 hidden bg-[radial-gradient(circle_at_50%_15%,rgba(69,110,185,0.16),transparent_0%,transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.01),transparent_18%)] md:block" />
      <div className="absolute inset-0 hidden opacity-[0.08] [background-image:radial-gradient(circle_at_20px_20px,rgba(255,255,255,0.16)_1px,transparent_0)] [background-size:34px_34px] md:block" />

      <div className="relative hidden h-full min-h-0 items-center justify-center px-6 py-10 md:flex">
        <div className="w-full max-w-[38rem] rounded-[30px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_18%),rgba(16,24,36,0.92)] p-7 shadow-[0_28px_60px_rgba(4,10,18,0.32)]">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] border border-[#4a84ff]/28 bg-[linear-gradient(180deg,rgba(74,132,255,0.22),rgba(74,132,255,0.08))] text-white shadow-[0_14px_32px_rgba(10,20,38,0.32)]">
            <MessageSquareMore {...iconProps} />
          </div>

          <h1 className="mt-5 text-[32px] font-semibold tracking-[-0.05em] text-white">
            Выберите диалог
          </h1>
          <p className="mt-3 max-w-[32rem] text-[15px] leading-7 text-[#8d98aa]">
            Список чатов уже открыт слева. Выберите существующую переписку или
            начните новую, чтобы перейти к экрану сообщений в обновлённом стиле.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link
              href="/app/people?view=discover"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] border border-[#4a84ff]/28 bg-[linear-gradient(180deg,rgba(74,132,255,0.24),rgba(61,104,192,0.14))] px-4 text-sm font-medium text-white transition-transform duration-150 hover:-translate-y-0.5"
            >
              <SquarePen {...iconProps} />
              Новый чат
            </Link>
            <Link
              href="/app/people?view=discover"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] border border-white/8 bg-white/[0.03] px-4 text-sm font-medium text-[#d8e1ef] transition-colors duration-150 hover:bg-white/[0.05]"
            >
              <UserRoundPlus {...iconProps} />
              Найти людей
            </Link>
          </div>

          <div className="mt-7 rounded-[22px] border border-white/6 bg-[#121b27]/88 p-4">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white/[0.045] text-[#94a4bb]">
                <Search {...iconProps} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Быстрый поиск по чатам</p>
                <p className="mt-1 text-sm leading-6 text-[#7d899b]">
                  Используйте поиск и вкладки в левой колонке, чтобы быстро найти
                  личный диалог или непрочитанные сообщения.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
