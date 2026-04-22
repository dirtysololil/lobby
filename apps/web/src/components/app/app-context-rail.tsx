"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Hash,
  House,
  Layers3,
  LockKeyhole,
  MessageSquareMore,
  Search,
  SlidersHorizontal,
  SquarePen,
  Mic,
  Settings2,
  ShieldCheck,
  Users2,
} from "lucide-react";
import {
  blocksResponseSchema,
  directConversationListResponseSchema,
  friendshipsResponseSchema,
  hubListResponseSchema,
  hubShellResponseSchema,
  type DirectConversationSummary,
  type HubShell,
  type HubSummary,
  type PublicUser,
} from "@lobby/shared";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  CompactList,
  CompactListCount,
  CompactListHeader,
  CompactListLink,
} from "@/components/ui/compact-list";
import { apiClientFetch } from "@/lib/api-client";
import { matchesPath, parseAppPath } from "@/lib/app-shell";
import { applyDmSignalToConversationSummaries } from "@/lib/direct-message-state";
import { buildHubLobbyHref } from "@/lib/hub-routes";
import {
  getCachedHubShell,
  primeHubShellCache,
  subscribeToHubShellCache,
} from "@/lib/hub-shell-cache";
import { adminNavigationItems } from "@/lib/admin-navigation";
import { cn } from "@/lib/utils";
import {
  useOptionalRealtimePresence,
  useRealtime,
} from "@/components/realtime/realtime-provider";

interface AppContextRailProps {
  viewer: PublicUser;
}

const settingsLinks = [
  { href: "/app/settings/profile", label: "Профиль" },
  { href: "/app/settings/notifications", label: "Уведомления" },
] as const;

const peopleViews = [
  { id: "friends", label: "Друзья" },
  { id: "requests", label: "Заявки" },
  { id: "discover", label: "Поиск" },
  { id: "blocked", label: "Блокировки" },
] as const;

const railIconProps = { size: 18, strokeWidth: 1.5 } as const;

function formatMembershipRole(role: string | null | undefined) {
  switch (role) {
    case "OWNER":
      return "Владелец";
    case "ADMIN":
      return "Администратор";
    case "MEMBER":
      return "Участник";
    case "GUEST":
      return "Гость";
    default:
      return role ?? "Участник";
  }
}

function formatLobbyType(type: string) {
  switch (type) {
    case "TEXT":
      return "Текст";
    case "VOICE":
      return "Голос";
    case "FORUM":
      return "Форум";
    default:
      return type;
  }
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

function RailRow({
  href,
  active,
  leading,
  label,
  meta,
  detail,
  unread = false,
}: {
  href: string;
  active: boolean;
  leading: ReactNode;
  label: string;
  meta?: ReactNode;
  detail?: ReactNode;
  unread?: boolean;
}) {
  return (
    <CompactListLink href={href} active={active} unread={unread} compact className="gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center">{leading}</div>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm leading-tight",
            active ? "text-white" : "text-zinc-100",
          )}
        >
          {label}
        </span>
        {detail ? (
          <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
            {detail}
          </span>
        ) : null}
      </span>
      {meta}
    </CompactListLink>
  );
}

function RailEmpty({ children }: { children: ReactNode }) {
  return <div className="px-3 py-4 text-sm text-[var(--text-muted)]">{children}</div>;
}

export function AppContextRail({ viewer }: AppContextRailProps) {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const searchParams = useSearchParams();
  const route = parseAppPath(safePathname);
  const { latestDmSignal } = useRealtime();
  const realtimePresence = useOptionalRealtimePresence();
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([]);
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [hub, setHub] = useState<HubShell["hub"] | null>(null);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageFilter, setMessageFilter] = useState<"all" | "personal" | "unread">(
    "personal",
  );
  const [peopleSummary, setPeopleSummary] = useState<{
    friends: number;
    incoming: number;
    outgoing: number;
    blocks: number;
  } | null>(null);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);

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
    let deferredHubFetch: number | null = null;
    let unsubscribeFromHubCache: (() => void) | null = null;

    setLoadingLabel(route.section);

    void (async () => {
      try {
        if (route.section === "messages") {
          const payload = await apiClientFetch("/v1/direct-messages");
          if (!active) {
            return;
          }

          setConversations(directConversationListResponseSchema.parse(payload).items);
          setHubs([]);
          setHub(null);
          setPeopleSummary(null);
          return;
        }

        if (route.section === "hubs") {
          if (route.hubId) {
            const cachedHub = getCachedHubShell(route.hubId);

            unsubscribeFromHubCache = subscribeToHubShellCache(
              route.hubId,
              (nextHub) => {
                if (!active) {
                  return;
                }

                setHub(nextHub);
                setHubs([]);
                setConversations([]);
                setPeopleSummary(null);
                setLoadingLabel(null);

                if (deferredHubFetch !== null) {
                  window.clearTimeout(deferredHubFetch);
                  deferredHubFetch = null;
                }
              },
            );

            setHub(cachedHub);
            setHubs([]);
            setConversations([]);
            setPeopleSummary(null);

            if (cachedHub) {
              setLoadingLabel(null);
              return;
            }

            deferredHubFetch = window.setTimeout(() => {
              void (async () => {
                try {
                  const payload = await apiClientFetch(`/v1/hubs/${route.hubId}`);
                  if (!active) {
                    return;
                  }

                  const nextHub = hubShellResponseSchema.parse(payload).hub;
                  primeHubShellCache(nextHub);
                  setHub(nextHub);
                } catch {
                  if (active) {
                    setHub(null);
                  }
                } finally {
                  if (active) {
                    setLoadingLabel(null);
                  }
                }
              })();
            }, 160);

            return;
          }

          const payload = await apiClientFetch("/v1/hubs");
          if (!active) {
            return;
          }

          setHubs(hubListResponseSchema.parse(payload).items);
          setHub(null);
          setConversations([]);
          setPeopleSummary(null);
          return;
        }

        if (route.section === "people") {
          const [friendshipsPayload, blocksPayload] = await Promise.all([
            apiClientFetch("/v1/relationships/friends"),
            apiClientFetch("/v1/relationships/blocks"),
          ]);

          if (!active) {
            return;
          }

          const friendships = friendshipsResponseSchema.parse(friendshipsPayload).items;
          const blocks = blocksResponseSchema.parse(blocksPayload).items;

          setPeopleSummary({
            friends: friendships.filter((item) => item.state === "ACCEPTED").length,
            incoming: friendships.filter((item) => item.state === "INCOMING_REQUEST")
              .length,
            outgoing: friendships.filter((item) => item.state === "OUTGOING_REQUEST")
              .length,
            blocks: blocks.length,
          });
          setHubs([]);
          setConversations([]);
          setHub(null);
          return;
        }

        setHubs([]);
        setConversations([]);
        setHub(null);
        setPeopleSummary(null);
      } catch {
        if (active) {
          setHubs([]);
          setConversations([]);
          setHub(null);
          setPeopleSummary(null);
        }
      } finally {
        if (active) {
          setLoadingLabel(null);
        }
      }
    })();

    return () => {
      active = false;
      unsubscribeFromHubCache?.();

      if (deferredHubFetch !== null) {
        window.clearTimeout(deferredHubFetch);
      }
    };
  }, [route.section, route.hubId]);

  const rawPeopleView = searchParams.get("view");
  const activePeopleView = peopleViews.some((item) => item.id === rawPeopleView)
    ? rawPeopleView
    : "friends";

  const groupedLobbies = useMemo(() => {
    if (!hub) {
      return [];
    }

    return [
      {
        label: "Текстовые",
        items: hub.lobbies.filter((item) => item.type === "TEXT"),
      },
      {
        label: "Голосовые",
        items: hub.lobbies.filter((item) => item.type === "VOICE"),
      },
      {
        label: "Форумы",
        items: hub.lobbies.filter((item) => item.type === "FORUM"),
      },
    ].filter((group) => group.items.length > 0);
  }, [hub]);
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
    <aside
      className={cn(
        "context-rail relative hidden h-full shrink-0 border-r border-white/5 shadow-[10px_0_26px_rgba(4,8,16,0.18)] md:flex md:flex-col",
        route.section === "messages"
          ? "w-[19.5rem] bg-[#0d151f]"
          : "w-60 bg-[#10161f]",
      )}
    >
      {route.section !== "messages" ? (
        <div className="border-b border-white/5 px-3 py-3">
          <div className="flex items-center gap-2 rounded-[16px] border border-white/6 bg-white/[0.03] px-2.5 py-2">
            <UserAvatar user={viewer} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {viewer.profile.displayName}
              </p>
              <p className="truncate text-xs text-[var(--text-muted)]">
                @{viewer.username}
              </p>
            </div>
            <PresenceIndicator user={viewer} compact />
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {route.section === "messages" ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-white/5 px-4 pb-3 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[27px] font-semibold tracking-[-0.04em] text-white"
                  >
                    <span>Чаты</span>
                    <ChevronDown size={16} strokeWidth={1.9} className="mt-1 text-[#7b8697]" />
                  </button>
                </div>
                <Link
                  href="/app/people?view=discover"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/6 bg-white/[0.03] text-[#9ca9bb] transition-colors hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                  aria-label="Новый чат"
                  title="Новый чат"
                >
                  <SquarePen size={20} strokeWidth={1.65} />
                </Link>
              </div>
            </div>

            <div className="border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-[15px] border border-white/6 bg-white/[0.04] px-3 text-[#9ca9bb] transition-colors focus-within:border-[#3b6ed8]/32 focus-within:bg-white/[0.055]">
                  <Search size={18} strokeWidth={1.7} className="shrink-0" />
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
                  className="inline-flex h-12 w-12 items-center justify-center rounded-[15px] border border-white/6 bg-white/[0.04] text-[#9ca9bb] transition-colors hover:border-white/10 hover:bg-white/[0.055] hover:text-white"
                  aria-label="Фильтры диалогов"
                  title="Фильтры диалогов"
                >
                  <SlidersHorizontal size={18} strokeWidth={1.7} />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-5 border-b border-white/5 pb-0.5 text-[14px] font-medium text-[#7f8a9c]">
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

            <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
              {loadingLabel === "messages" ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[#7b8697]">
                  Загружаем диалоги...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#7b8697]">
                  {messageSearchQuery
                    ? "По вашему запросу диалогов не найдено."
                    : "Личных диалогов пока нет."}
                </div>
              ) : (
                <div className="grid gap-1.5">
                  {filteredConversations.map((conversation) => {
                    const href = `/app/messages/${conversation.id}`;
                    const active = safePathname === href;
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
                        href={href}
                        className={cn(
                          "group relative grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-[20px] border px-3 py-3 transition-all duration-150",
                          active
                            ? "border-[#3a6cd4]/32 bg-[linear-gradient(180deg,rgba(51,72,104,0.42),rgba(24,31,45,0.92))] shadow-[0_16px_28px_rgba(5,12,22,0.22)]"
                            : "border-transparent bg-transparent hover:border-white/6 hover:bg-white/[0.035]",
                        )}
                      >
                        {active ? (
                          <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-[#4a84ff]" />
                        ) : null}

                        <div className="relative row-span-2 mt-0.5">
                          <UserAvatar
                            user={conversation.counterpart}
                            size="sm"
                            className="h-11 w-11"
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
                            <p className="truncate text-[15px] font-medium tracking-[-0.02em] text-white">
                              {conversation.counterpart.profile.displayName}
                            </p>
                            {liveCounterpart.isOnline ? (
                              <span className="h-2 w-2 rounded-full bg-[#2ecf7c]" />
                            ) : null}
                          </div>
                          <p
                            className={cn(
                              "mt-1 truncate text-[14px]",
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
                            <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#4a84ff] px-1.5 text-[11px] font-semibold text-white">
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

            <div className="px-4 pb-4 pt-1 text-center text-[12px] text-[#7b8697]">
              {conversations.length} диалогов
            </div>
          </div>
        ) : null}

        {route.section === "hubs" && !route.hubId ? (
          <div>
            <CompactListHeader>
              <span>Хабы</span>
              <Link
                href="/app/hubs"
                className="inline-flex items-center gap-1 normal-case tracking-normal text-[var(--text-dim)] transition-colors hover:text-white"
              >
                <Layers3 {...railIconProps} />
                Все
              </Link>
            </CompactListHeader>

            {loadingLabel === "hubs" ? (
              <RailEmpty>Загружаем хабы...</RailEmpty>
            ) : hubs.length === 0 ? (
              <RailEmpty>Присоединитесь к хабу или создайте его, чтобы увидеть список.</RailEmpty>
            ) : (
              <CompactList>
                {hubs.map((item) => (
                  <RailRow
                    key={item.id}
                    href={`/app/hubs/${item.id}`}
                    active={safePathname.startsWith(`/app/hubs/${item.id}`)}
                    leading={
                      <span className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-white/5 text-[10px] font-semibold text-zinc-200">
                        {item.name.slice(0, 2).toUpperCase()}
                      </span>
                    }
                    label={item.name}
                    detail={formatMembershipRole(item.membershipRole)}
                    meta={
                      item.isPrivate ? (
                        <LockKeyhole {...railIconProps} className="text-zinc-500" />
                      ) : null
                    }
                  />
                ))}
              </CompactList>
            )}
          </div>
        ) : null}

        {route.section === "hubs" && route.hubId ? (
          <div>
            <div className="px-3 py-3">
              <p className="truncate text-sm font-medium text-white">{hub?.name ?? "Хаб"}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                {formatMembershipRole(hub?.membershipRole)}
              </p>
            </div>

            <CompactList>
              <RailRow
                href={`/app/hubs/${route.hubId}`}
                active={safePathname === `/app/hubs/${route.hubId}`}
                leading={<House {...railIconProps} className="text-zinc-400" />}
                label="Обзор"
              />
            </CompactList>

            {groupedLobbies.map((group) => (
              <div key={group.label}>
                <CompactListHeader>
                  <span>{group.label}</span>
                </CompactListHeader>
                <CompactList>
                  {group.items.map((lobby) => {
                    const href = buildHubLobbyHref(route.hubId!, lobby.id, lobby.type);
                    const active =
                      safePathname === href || safePathname.startsWith(`${href}/`);

                    return (
                      <RailRow
                        key={lobby.id}
                        href={href}
                        active={active}
                        leading={
                          lobby.type === "VOICE" ? (
                            <Mic {...railIconProps} className="text-zinc-400" />
                          ) : (
                            <Hash {...railIconProps} className="text-zinc-400" />
                          )
                        }
                        label={lobby.name}
                        detail={formatLobbyType(lobby.type)}
                        meta={
                          lobby.isPrivate ? (
                            <LockKeyhole {...railIconProps} className="text-zinc-500" />
                          ) : null
                        }
                      />
                    );
                  })}
                </CompactList>
              </div>
            ))}
          </div>
        ) : null}

        {route.section === "people" ? (
          <div>
            {route.peopleUsername ? (
              <>
                <CompactListHeader>
                  <span>Profile</span>
                  <Link
                    href="/app/people?view=discover"
                    className="inline-flex items-center gap-1 normal-case tracking-normal text-[var(--text-dim)] transition-colors hover:text-white"
                  >
                    <Users2 {...railIconProps} />
                    People
                  </Link>
                </CompactListHeader>

                <CompactList>
                  <RailRow
                    href="/app/people?view=discover"
                    active={false}
                    leading={<Users2 {...railIconProps} className="text-zinc-400" />}
                    label={`@${route.peopleUsername}`}
                    detail="Открыт публичный профиль"
                  />
                  <RailRow
                    href="/app/messages"
                    active={false}
                    leading={<MessageSquareMore {...railIconProps} className="text-zinc-400" />}
                    label="Диалоги"
                    detail="Быстрый возврат к переписке"
                  />
                </CompactList>
              </>
            ) : (
              <>
            <CompactListHeader>
              <span>Люди</span>
              <Link
                href="/app/messages"
                className="inline-flex items-center gap-1 normal-case tracking-normal text-[var(--text-dim)] transition-colors hover:text-white"
              >
                <MessageSquareMore {...railIconProps} />
                Диалоги
              </Link>
            </CompactListHeader>

            <CompactList>
              {peopleViews.map((item) => {
                const href = `/app/people?view=${item.id}`;
                const active = activePeopleView === item.id;
                const count =
                  item.id === "friends"
                    ? peopleSummary?.friends
                    : item.id === "requests"
                      ? (peopleSummary?.incoming ?? 0) + (peopleSummary?.outgoing ?? 0)
                      : item.id === "blocked"
                        ? peopleSummary?.blocks
                        : undefined;

                return (
                  <RailRow
                    key={item.id}
                    href={href}
                    active={active}
                    leading={<Users2 {...railIconProps} className="text-zinc-400" />}
                    label={item.label}
                    meta={
                      count !== undefined ? <CompactListCount>{count}</CompactListCount> : null
                    }
                  />
                );
              })}
            </CompactList>
              </>
            )}
          </div>
        ) : null}

        {route.section === "settings" ? (
          <div>
            <CompactListHeader>
              <span>Настройки</span>
            </CompactListHeader>
            <CompactList>
              {settingsLinks.map((item) => (
                <RailRow
                  key={item.href}
                  href={item.href}
                  active={matchesPath(safePathname, item.href)}
                  leading={<Settings2 {...railIconProps} className="text-zinc-400" />}
                  label={item.label}
                />
              ))}
            </CompactList>
          </div>
        ) : null}

        {route.section === "admin" ? (
          <div>
            <CompactListHeader>
              <span>Админка</span>
            </CompactListHeader>
            <CompactList>
              {adminNavigationItems.map((item) => (
                <RailRow
                  key={item.href}
                  href={item.href}
                  active={
                    item.href === "/app/admin"
                      ? route.adminSection === "overview"
                      : safePathname === item.href
                  }
                  leading={<ShieldCheck {...railIconProps} className="text-zinc-400" />}
                  label={item.label}
                />
              ))}
            </CompactList>
          </div>
        ) : null}
      </div>

    </aside>
  );
}


