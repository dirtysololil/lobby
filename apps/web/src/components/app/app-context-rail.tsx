"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Hash, Layers3, LockKeyhole, MessageSquareMore, Mic, Settings2, ShieldCheck, UserRoundPlus, Users2 } from "lucide-react";
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
import { useEffect, useMemo, useState } from "react";
import { apiClientFetch } from "@/lib/api-client";
import { matchesPath, parseAppPath } from "@/lib/app-shell";
import { buildHubLobbyHref } from "@/lib/hub-routes";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useRealtime } from "@/components/realtime/realtime-provider";

interface AppContextRailProps {
  viewer: PublicUser;
}

const settingsLinks = [
  { href: "/app/settings/profile", label: "Profile" },
  { href: "/app/settings/notifications", label: "Notifications" },
] as const;

const adminLinks = [
  { href: "/app/admin", label: "Overview" },
  { href: "/app/admin/users", label: "Users" },
  { href: "/app/admin/invites", label: "Invites" },
  { href: "/app/admin/audit", label: "Audit log" },
] as const;

const peopleViews = [
  { id: "friends", label: "Friends" },
  { id: "requests", label: "Requests" },
  { id: "discover", label: "Discover" },
  { id: "blocked", label: "Blocked" },
] as const;

export function AppContextRail({ viewer }: AppContextRailProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = parseAppPath(pathname);
  const { incomingCalls, latestSignal } = useRealtime();
  const [conversations, setConversations] = useState<DirectConversationSummary[]>(
    [],
  );
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
    let active = true;

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
            const payload = await apiClientFetch(`/v1/hubs/${route.hubId}`);
            if (!active) {
              return;
            }

            setHub(hubShellResponseSchema.parse(payload).hub);
            setHubs([]);
            setConversations([]);
            setPeopleSummary(null);
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
        label: "Text",
        items: hub.lobbies.filter((item) => item.type === "TEXT"),
      },
      {
        label: "Voice",
        items: hub.lobbies.filter((item) => item.type === "VOICE"),
      },
      {
        label: "Forum",
        items: hub.lobbies.filter((item) => item.type === "FORUM"),
      },
    ].filter((group) => group.items.length > 0);
  }, [hub]);

  return (
    <aside className="context-rail flex min-h-0 flex-col overflow-hidden rounded-[20px] p-2.5 lg:sticky lg:top-3 lg:h-[calc(100vh-1.5rem)]">
      <div className="flex items-center gap-2.5 border-b border-white/8 pb-2.5">
        <UserAvatar user={viewer} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {viewer.profile.displayName}
          </p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            @{viewer.username}
          </p>
        </div>
      </div>

      <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto pr-1">
        {route.section === "messages" ? (
          <div className="rail-group">
            <div className="rail-heading">
              <p className="section-kicker">Conversations</p>
              <Link href="/app/people?view=discover" className="glass-badge">
                <UserRoundPlus className="h-3 w-3" />
                New
              </Link>
            </div>
            <div className="mt-2 grid gap-1">
              {loadingLabel === "messages" ? (
                <div className="surface-subtle rounded-[14px] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                  Загружаем диалоги...
                </div>
              ) : conversations.length === 0 ? (
                <div className="surface-subtle rounded-[14px] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                  Здесь появятся ваши DM.
                </div>
              ) : (
                conversations.map((conversation) => {
                  const href = `/app/messages/${conversation.id}`;

                  return (
                    <Link
                      key={conversation.id}
                      href={href}
                      className={cn(
                        "context-link rounded-[14px]",
                        pathname === href && "context-link-active",
                      )}
                    >
                      <UserAvatar user={conversation.counterpart} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {conversation.counterpart.profile.displayName}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-dim)]">
                          {conversation.lastMessage?.isDeleted
                            ? "Сообщение удалено"
                            : (conversation.lastMessage?.content ?? "Пустой диалог")}
                        </span>
                      </span>
                      {conversation.unreadCount > 0 ? (
                        <span className="nav-link-meta">{conversation.unreadCount}</span>
                      ) : null}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        {route.section === "hubs" && !route.hubId ? (
          <div className="rail-group">
            <div className="rail-heading">
              <p className="section-kicker">Your hubs</p>
              <Link href="/app/hubs" className="glass-badge">
                <Layers3 className="h-3 w-3" />
                All
              </Link>
            </div>
            <div className="mt-2 grid gap-1">
              {loadingLabel === "hubs" ? (
                <div className="surface-subtle rounded-[14px] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                  Загружаем хабы...
                </div>
              ) : (
                hubs.map((item) => (
                  <Link
                    key={item.id}
                    href={`/app/hubs/${item.id}`}
                    className={cn(
                      "context-link rounded-[14px]",
                      pathname.startsWith(`/app/hubs/${item.id}`) && "context-link-active",
                    )}
                  >
                    <span className="dock-icon flex h-9 w-9 items-center justify-center rounded-[12px] text-[11px] font-semibold text-white">
                      {item.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">
                        {item.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--text-dim)]">
                        {item.membershipRole ?? "Гость"}
                      </span>
                    </span>
                    {item.isPrivate ? (
                      <LockKeyhole className="h-3.5 w-3.5 text-[var(--accent)]" />
                    ) : null}
                  </Link>
                ))
              )}
            </div>
          </div>
        ) : null}

        {route.section === "hubs" && route.hubId ? (
          <div className="grid gap-4">
            <div className="surface-subtle rounded-[16px] p-3">
              <p className="truncate text-sm font-semibold text-white">
                {hub?.name ?? "Хаб"}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                {hub?.membershipRole ?? "Структура пространства"}
              </p>
            </div>

            <div className="grid gap-1">
              <Link
                href={`/app/hubs/${route.hubId}`}
                className={cn(
                  "context-link rounded-[14px]",
                  pathname === `/app/hubs/${route.hubId}` && "context-link-active",
                )}
              >
                <Layers3 className="h-4 w-4 text-[var(--accent)]" />
                <span className="text-sm font-semibold text-white">Overview</span>
              </Link>
            </div>

            {groupedLobbies.map((group) => (
              <div key={group.label} className="rail-group">
                <div className="rail-heading">
                  <p className="section-kicker">{group.label}</p>
                </div>
                <div className="mt-2 grid gap-1">
                  {group.items.map((lobby) => {
                    const href = buildHubLobbyHref(route.hubId!, lobby.id, lobby.type);
                    const active = pathname === href || pathname.startsWith(`${href}/`);

                    return (
                      <Link
                        key={lobby.id}
                        href={href}
                        className={cn(
                          "context-link rounded-[14px]",
                          active && "context-link-active",
                        )}
                      >
                        <span className="dock-icon flex h-9 w-9 items-center justify-center rounded-[12px]">
                          {lobby.type === "VOICE" ? (
                            <Mic className="h-4 w-4" />
                          ) : (
                            <Hash className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {lobby.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-dim)]">
                          {lobby.type}
                        </span>
                        </span>
                        {lobby.isPrivate ? (
                          <LockKeyhole className="h-3.5 w-3.5 text-[var(--accent)]" />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {route.section === "people" ? (
          <div className="rail-group">
            <div className="rail-heading">
              <p className="section-kicker">People</p>
              <Link href="/app/messages" className="glass-badge">
                <MessageSquareMore className="h-3 w-3" />
                Inbox
              </Link>
            </div>
            <div className="mt-2 grid gap-1">
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
                  <Link
                    key={item.id}
                    href={href}
                    className={cn(
                      "context-link rounded-[14px]",
                      active && "context-link-active",
                    )}
                  >
                    <Users2 className="h-4 w-4 text-[var(--accent)]" />
                    <span className="min-w-0 flex-1 text-sm font-semibold text-white">
                      {item.label}
                    </span>
                    {count !== undefined ? (
                      <span className="nav-link-meta">{count}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        {route.section === "settings" ? (
          <div className="rail-group">
            <div className="rail-heading">
              <p className="section-kicker">Settings</p>
            </div>
            <div className="mt-2 grid gap-1">
              {settingsLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "context-link rounded-[14px]",
                    matchesPath(pathname, item.href) && "context-link-active",
                  )}
                >
                  <Settings2 className="h-4 w-4 text-[var(--accent)]" />
                  <span className="text-sm font-semibold text-white">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {route.section === "admin" ? (
          <div className="rail-group">
            <div className="rail-heading">
              <p className="section-kicker">Control</p>
            </div>
            <div className="mt-2 grid gap-1">
              {adminLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "context-link rounded-[14px]",
                    matchesPath(pathname, item.href) && "context-link-active",
                  )}
                >
                  <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                  <span className="text-sm font-semibold text-white">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="surface-subtle mt-2.5 rounded-[14px] p-2.5">
        <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-dim)]">
          <span>Realtime</span>
          <span>{incomingCalls.length} calls</span>
        </div>
        <p className="mt-1 text-sm font-medium text-white">
          {latestSignal ? latestSignal.call.status : "Connected"}
        </p>
      </div>
    </aside>
  );
}
