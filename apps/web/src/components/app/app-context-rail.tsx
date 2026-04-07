"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Hash,
  House,
  Layers3,
  LockKeyhole,
  MessageSquareMore,
  Mic,
  Settings2,
  ShieldCheck,
  UserRoundPlus,
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
import { LogoutButton } from "@/components/app/logout-button";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  CompactList,
  CompactListCount,
  CompactListHeader,
  CompactListLink,
  CompactListMeta,
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
import { getResolvedPresenceLabel } from "@/lib/presence";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/components/realtime/realtime-provider";

interface AppContextRailProps {
  viewer: PublicUser;
}

const settingsLinks = [
  { href: "/app/settings/profile", label: "Профиль" },
  { href: "/app/settings/notifications", label: "Уведомления" },
] as const;

const adminLinks = [
  { href: "/app/admin", label: "Обзор" },
  { href: "/app/admin/users", label: "Пользователи" },
  { href: "/app/admin/invites", label: "Инвайты" },
  { href: "/app/admin/audit", label: "Аудит" },
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
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([]);
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [hub, setHub] = useState<HubShell["hub"] | null>(null);
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

  return (
    <aside className="context-rail relative hidden h-full w-56 shrink-0 border-r border-white/5 bg-[#10161f] shadow-[10px_0_26px_rgba(4,8,16,0.18)] md:flex md:flex-col">
      <div className="border-b border-white/5 px-3 py-3">
        <div className="flex items-center gap-2 rounded-[16px] border border-white/6 bg-white/[0.03] px-2.5 py-2">
          <UserAvatar user={viewer} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {viewer.profile.displayName}
            </p>
            <p className="truncate text-xs text-[var(--text-muted)]">@{viewer.username}</p>
          </div>
          <PresenceIndicator user={viewer} compact />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {route.section === "messages" ? (
          <div>
            <CompactListHeader>
              <span>Диалоги</span>
              <Link
                href="/app/people?view=discover"
                className="inline-flex items-center gap-1 normal-case tracking-normal text-[var(--text-dim)] transition-colors hover:text-white"
              >
                <UserRoundPlus {...railIconProps} />
                Новое
              </Link>
            </CompactListHeader>

            {loadingLabel === "messages" ? (
              <RailEmpty>Загружаем диалоги...</RailEmpty>
            ) : conversations.length === 0 ? (
              <RailEmpty>Личных диалогов пока нет.</RailEmpty>
            ) : (
              <CompactList>
                {conversations.map((conversation) => {
                  const href = `/app/messages/${conversation.id}`;

                  return (
                    <RailRow
                      key={conversation.id}
                      href={href}
                      active={safePathname === href}
                      unread={conversation.unreadCount > 0}
                      leading={<UserAvatar user={conversation.counterpart} size="sm" />}
                      label={conversation.counterpart.profile.displayName}
                      detail={
                        conversation.lastMessagePreview ?? "Сообщений пока нет"
                      }
                      meta={
                        conversation.unreadCount > 0 ? (
                          <CompactListCount>{conversation.unreadCount}</CompactListCount>
                        ) : null
                      }
                    />
                  );
                })}
              </CompactList>
            )}
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
              {adminLinks.map((item) => (
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

      <div className="border-t border-white/5 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Сеанс
          </p>
          <CompactListMeta>{getResolvedPresenceLabel(viewer)}</CompactListMeta>
        </div>
        <div className="mt-2 rounded-[16px] border border-white/6 bg-white/[0.03] p-2">
          <LogoutButton
            label="Выйти"
            pendingLabel="Выходим..."
            className="call-danger-button h-9 w-full justify-between rounded-[12px] px-3 text-sm"
          />
        </div>
      </div>
    </aside>
  );
}
