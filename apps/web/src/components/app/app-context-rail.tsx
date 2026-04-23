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
  { id: "suggested", label: "Возможные друзья" },
  { id: "blocked", label: "Блокировки" },
] as const;

const railIconProps = { size: 18, strokeWidth: 1.9 } as const;

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
    <Link
      href={href}
      className={cn(
        "group relative flex w-full min-w-0 items-center gap-3 rounded-[15px] px-3 py-2.5 transition-all duration-150",
        active
          ? "text-white"
          : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-white",
        unread &&
          !active &&
          "before:absolute before:inset-y-3 before:left-0 before:w-[2px] before:rounded-full before:bg-white",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] transition-all duration-150",
          active
            ? "border border-white/10 bg-[var(--bg-active)] text-white"
            : "text-[var(--text-dim)] group-hover:text-white",
        )}
      >
        {leading}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-medium leading-tight",
            active ? "text-white" : "text-[var(--text-dim)] group-hover:text-white",
          )}
        >
          {label}
        </span>
        {detail ? (
          <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)] group-hover:text-[var(--text-soft)]">
            {detail}
          </span>
        ) : null}
      </span>

      {meta}
    </Link>
  );
}

function RailEmpty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-4 text-sm text-[var(--text-muted)]">{children}</div>;
}

const railHeaderClassName =
  "px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]";
const railHeaderLinkClassName =
  "inline-flex items-center gap-1.5 normal-case tracking-normal text-[var(--text-dim)] transition-colors hover:text-white";
const railListClassName = "gap-1.5 px-3 pb-3";
const railCountClassName =
  "min-h-6 rounded-full border border-white/8 bg-black px-2.5 text-[11px] font-medium text-[var(--text-dim)]";

function getPeopleViewLeading(viewId: (typeof peopleViews)[number]["id"]) {
  switch (viewId) {
    case "discover":
      return <Search {...railIconProps} className="text-current" />;
    case "blocked":
      return <LockKeyhole {...railIconProps} className="text-current" />;
    default:
      return <Users2 {...railIconProps} className="text-current" />;
  }
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
        "context-rail relative hidden h-full shrink-0 border-r border-white/8 bg-black md:flex md:flex-col",
        route.section === "messages"
          ? "w-[306px]"
          : "w-60",
      )}
    >
      {route.section !== "messages" ? (
        <div className="border-b border-white/8 px-3 py-3.5">
          <div className="flex items-center gap-2.5 rounded-[20px] border border-white/10 bg-black px-3 py-2.5">
            <UserAvatar
              user={viewer}
              size="sm"
              className="h-10 w-10 text-[11px]"
              showPresenceIndicator={false}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {viewer.profile.displayName}
              </p>
              <p className="truncate text-xs text-[var(--text-muted)]">
                @{viewer.username}
              </p>
            </div>
            <PresenceIndicator
              user={viewer}
              compact
              className="border-white/10 bg-black px-2.5 py-1 text-[11px] text-[var(--text-dim)]"
            />
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {route.section === "messages" ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-white/8 px-[18px] pb-[11px] pt-[18px]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-[20px] font-semibold tracking-[-0.03em] text-white"
                  >
                    <span>Чаты</span>
                    <ChevronDown size={16} strokeWidth={1.9} className="mt-0.5 text-[var(--text-muted)]" />
                  </button>
                </div>
                <Link
                  href="/app/people?view=discover"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/8 bg-black text-[var(--text-dim)] transition-colors hover:border-white/12 hover:bg-[var(--bg-hover)] hover:text-white"
                  aria-label="Новый чат"
                  title="Новый чат"
                >
                  <SquarePen size={18} strokeWidth={1.65} />
                </Link>
              </div>
            </div>

            <div className="border-b border-white/8 px-[14px] py-[12px]">
              <div className="flex items-center gap-2">
                <label className="flex h-[42px] min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-white/8 bg-black px-3 text-[var(--text-dim)] transition-colors focus-within:border-white/14 focus-within:bg-black">
                  <Search size={17} strokeWidth={1.65} className="shrink-0" />
                  <input
                    className="w-full border-0 bg-transparent p-0 text-[14px] text-white outline-none placeholder:text-[var(--text-muted)]"
                    value={messageSearchQuery}
                    onChange={(event) => setMessageSearchQuery(event.target.value)}
                    placeholder="Поиск"
                    aria-label="Поиск по диалогам"
                  />
                </label>
                <button
                  type="button"
                  className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-white/8 bg-black text-[var(--text-dim)] transition-colors hover:border-white/12 hover:bg-[var(--bg-hover)] hover:text-white"
                  aria-label="Фильтры диалогов"
                  title="Фильтры диалогов"
                >
                  <SlidersHorizontal size={17} strokeWidth={1.65} />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-6 border-b border-white/8 pb-0.5 pl-1 text-[13px] font-medium text-[var(--text-muted)]">
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
                        active ? "text-white" : "hover:text-white",
                      )}
                    >
                      {item.label}
                      {active ? (
                        <span className="absolute inset-x-0 bottom-[-2px] h-[2px] rounded-full bg-white" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-0 py-2">
              {loadingLabel === "messages" ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--text-muted)]">
                  Загружаем диалоги...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--text-muted)]">
                  {messageSearchQuery
                    ? "По вашему запросу диалогов не найдено."
                    : "Личных диалогов пока нет."}
                </div>
              ) : (
                <div className="grid gap-0.5">
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
                          "group relative grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-3 pl-[18px] pr-[14px] transition-all duration-150",
                          active
                            ? "bg-[var(--bg-active)] shadow-none"
                            : "bg-transparent hover:bg-[var(--bg-hover)]",
                        )}
                      >
                        {active ? (
                          <span className="absolute bottom-0 left-0 top-0 w-[3px] rounded-r-full bg-[#0070F3]" />
                        ) : null}

                        <div className="relative row-span-2 mt-0.5">
                          <UserAvatar
                            user={conversation.counterpart}
                            size="sm"
                            className="h-12 w-12 text-[12px]"
                            showPresenceIndicator={false}
                          />
                          <span
                            className={cn(
                              "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[2px] border-black bg-[var(--text-dim)]",
                              liveCounterpart.isOnline && "bg-emerald-400",
                            )}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-white">
                              {conversation.counterpart.profile.displayName}
                            </p>
                            {liveCounterpart.isOnline ? (
                              <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            ) : null}
                          </div>
                          <p
                            className={cn(
                              "mt-1 truncate text-[13px]",
                              conversation.unreadCount > 0
                                ? "text-[var(--text-soft)]"
                                : "text-[var(--text-muted)]",
                            )}
                          >
                            {conversation.lastMessagePreview ?? "Сообщений пока нет"}
                          </p>
                        </div>

                        <div className="row-span-2 flex min-w-[2.75rem] flex-col items-end gap-2 text-[12px] text-[var(--text-muted)]">
                          <span>{formatConversationTime(conversation.lastMessageAt)}</span>
                          {conversation.unreadCount > 0 ? (
                            <span className="inline-flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full border border-white/12 bg-white px-1.5 text-[11px] font-semibold text-black">
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

            <div className="px-4 pb-5 pt-2 text-center text-[12px] text-[var(--text-muted)]">
              {conversations.length} диалогов
            </div>
          </div>
        ) : null}

        {route.section === "hubs" && !route.hubId ? (
          <div>
            <CompactListHeader className={railHeaderClassName}>
              <span>Хабы</span>
              <Link
                href="/app/hubs"
                className={railHeaderLinkClassName}
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
              <CompactList className={railListClassName}>
                {hubs.map((item) => (
                  <RailRow
                    key={item.id}
                    href={`/app/hubs/${item.id}`}
                    active={safePathname.startsWith(`/app/hubs/${item.id}`)}
                    leading={
                      <span className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-[var(--border-soft)] bg-black text-[10px] font-semibold text-white">
                        {item.name.slice(0, 2).toUpperCase()}
                      </span>
                    }
                    label={item.name}
                    detail={formatMembershipRole(item.membershipRole)}
                    meta={
                      item.isPrivate ? (
                        <LockKeyhole
                          {...railIconProps}
                          className="text-[var(--text-muted)]"
                        />
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
            <div className="px-4 py-4">
              <p className="truncate text-sm font-medium text-white">{hub?.name ?? "Хаб"}</p>
              <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                {formatMembershipRole(hub?.membershipRole)}
              </p>
            </div>

            <CompactList className={railListClassName}>
              <RailRow
                href={`/app/hubs/${route.hubId}`}
                active={safePathname === `/app/hubs/${route.hubId}`}
                leading={<House {...railIconProps} className="text-current" />}
                label="Обзор"
              />
            </CompactList>

            {groupedLobbies.map((group) => (
              <div key={group.label}>
                <CompactListHeader className={railHeaderClassName}>
                  <span>{group.label}</span>
                </CompactListHeader>
                <CompactList className={railListClassName}>
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
                            <Mic {...railIconProps} className="text-current" />
                          ) : (
                            <Hash {...railIconProps} className="text-current" />
                          )
                        }
                        label={lobby.name}
                        detail={formatLobbyType(lobby.type)}
                        meta={
                          lobby.isPrivate ? (
                            <LockKeyhole
                              {...railIconProps}
                              className="text-[var(--text-muted)]"
                            />
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
                <CompactListHeader className={railHeaderClassName}>
                  <span>Profile</span>
                  <Link
                    href="/app/people?view=discover"
                    className={railHeaderLinkClassName}
                  >
                    <Users2 {...railIconProps} />
                    People
                  </Link>
                </CompactListHeader>

                <CompactList className={railListClassName}>
                  <RailRow
                    href="/app/people?view=discover"
                    active={false}
                    leading={<Users2 {...railIconProps} className="text-current" />}
                    label={`@${route.peopleUsername}`}
                    detail="Открыт публичный профиль"
                  />
                  <RailRow
                    href="/app/messages"
                    active={false}
                    leading={<MessageSquareMore {...railIconProps} className="text-current" />}
                    label="Диалоги"
                    detail="Быстрый возврат к переписке"
                  />
                </CompactList>
              </>
            ) : (
              <>
            <CompactListHeader className={railHeaderClassName}>
              <span>Люди</span>
              <Link
                href="/app/messages"
                className={railHeaderLinkClassName}
              >
                <MessageSquareMore {...railIconProps} />
                Диалоги
              </Link>
            </CompactListHeader>

            <CompactList className={railListClassName}>
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
                    leading={getPeopleViewLeading(item.id)}
                    label={item.label}
                    meta={
                      count !== undefined ? (
                        <CompactListCount className={railCountClassName}>
                          {count}
                        </CompactListCount>
                      ) : null
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
            <CompactListHeader className={railHeaderClassName}>
              <span>Настройки</span>
            </CompactListHeader>
            <CompactList className={railListClassName}>
              {settingsLinks.map((item) => (
                <RailRow
                  key={item.href}
                  href={item.href}
                  active={matchesPath(safePathname, item.href)}
                  leading={<Settings2 {...railIconProps} className="text-current" />}
                  label={item.label}
                />
              ))}
            </CompactList>
          </div>
        ) : null}

        {route.section === "admin" ? (
          <div>
            <CompactListHeader className={railHeaderClassName}>
              <span>Админка</span>
            </CompactListHeader>
            <CompactList className={railListClassName}>
              {adminNavigationItems.map((item) => (
                <RailRow
                  key={item.href}
                  href={item.href}
                  active={
                    item.href === "/app/admin"
                      ? route.adminSection === "overview"
                      : safePathname === item.href
                  }
                  leading={<ShieldCheck {...railIconProps} className="text-current" />}
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


