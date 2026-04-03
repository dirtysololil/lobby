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
  { href: "/app/admin", label: "Control" },
  { href: "/app/admin/users", label: "Users" },
  { href: "/app/admin/invites", label: "Invites" },
  { href: "/app/admin/audit", label: "Audit Log" },
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
    <aside className="context-rail hidden min-h-screen w-64 border-r border-[var(--border)] md:flex md:flex-col">
      <div className="flex h-12 items-center gap-2 border-b border-[var(--border)] px-3">
        <UserAvatar user={viewer} size="sm" />
        <div className="flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {viewer.profile.displayName}
          </p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            @{viewer.username}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {route.section === "messages" ? (
          <div>
            <div className="flex items-center justify-between px-3 py-2 text-xs text-[var(--text-muted)]">
              <span className="section-kicker">Conversations</span>
              <Link href="/app/people?view=discover" className="glass-badge">
                <UserRoundPlus className="h-[18px] w-[18px]" />
                New
              </Link>
            </div>

            {loadingLabel === "messages" ? (
              <div className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                Loading chats...
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                No direct messages yet.
              </div>
            ) : (
              <div>
                {conversations.map((conversation) => {
                  const href = `/app/messages/${conversation.id}`;

                  return (
                    <Link
                      key={conversation.id}
                      href={href}
                      className={cn(
                        "flex items-center gap-3 border-b border-[var(--border-soft)] px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-panel-soft)]",
                        pathname === href && "bg-[var(--bg-active)]",
                      )}
                    >
                      <UserAvatar user={conversation.counterpart} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-white">
                          {conversation.counterpart.profile.displayName}
                        </span>
                        <span className="block truncate text-xs text-[var(--text-dim)]">
                          {conversation.lastMessage?.isDeleted
                            ? "Message deleted"
                            : (conversation.lastMessage?.content ?? "No messages yet")}
                        </span>
                      </span>
                      {conversation.unreadCount > 0 ? (
                        <span className="nav-link-meta">{conversation.unreadCount}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {route.section === "hubs" && !route.hubId ? (
          <div>
            <div className="flex items-center justify-between px-3 py-2 text-xs text-[var(--text-muted)]">
              <span className="section-kicker">Hubs</span>
              <Link href="/app/hubs" className="glass-badge">
                <Layers3 className="h-[18px] w-[18px]" />
                Browse
              </Link>
            </div>

            {loadingLabel === "hubs" ? (
              <div className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                Loading hubs...
              </div>
            ) : hubs.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
                Join a hub or create a new one.
              </div>
            ) : (
              <div>
                {hubs.map((item) => (
                  <Link
                    key={item.id}
                    href={`/app/hubs/${item.id}`}
                    className={cn(
                      "flex items-center gap-3 border-b border-[var(--border-soft)] px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-panel-soft)]",
                      pathname.startsWith(`/app/hubs/${item.id}`) && "bg-[var(--bg-active)]",
                    )}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--bg-panel-soft)] text-[10px] font-semibold text-white">
                      {item.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-white">
                        {item.name}
                      </span>
                      <span className="block truncate text-xs text-[var(--text-dim)]">
                        {item.membershipRole ?? "Guest"}
                      </span>
                    </span>
                    {item.isPrivate ? (
                      <LockKeyhole className="h-[18px] w-[18px] text-[var(--accent)]" />
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {route.section === "hubs" && route.hubId ? (
          <div>
            <div className="border-b border-[var(--border-soft)] px-3 py-3">
              <p className="truncate text-sm font-semibold text-white">
                {hub?.name ?? "Hub"}
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--text-dim)]">
                {hub?.membershipRole ?? "Member"}
              </p>
            </div>

            <div>
              <Link
                href={`/app/hubs/${route.hubId}`}
                className={cn(
                  "flex items-center gap-3 border-b border-[var(--border-soft)] px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-panel-soft)]",
                  pathname === `/app/hubs/${route.hubId}` && "bg-[var(--bg-active)]",
                )}
              >
                <House className="h-[18px] w-[18px] text-[var(--accent)]" />
                <span className="font-medium text-white">Home</span>
              </Link>
            </div>

            {groupedLobbies.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-2 text-xs text-[var(--text-muted)]">
                  <span className="section-kicker">{group.label}</span>
                </div>

                {group.items.map((lobby) => {
                  const href = buildHubLobbyHref(route.hubId!, lobby.id, lobby.type);
                  const active = pathname === href || pathname.startsWith(`${href}/`);

                  return (
                    <Link
                      key={lobby.id}
                      href={href}
                      className={cn(
                        "flex items-center gap-3 border-b border-[var(--border-soft)] px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-panel-soft)]",
                        active && "bg-[var(--bg-active)]",
                      )}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--bg-panel-soft)]">
                        {lobby.type === "VOICE" ? (
                            <Mic className="h-[18px] w-[18px]" />
                          ) : (
                            <Hash className="h-[18px] w-[18px]" />
                          )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-white">
                          {lobby.name}
                        </span>
                        <span className="block truncate text-xs text-[var(--text-dim)]">
                          {lobby.type}
                        </span>
                      </span>
                      {lobby.isPrivate ? (
                          <LockKeyhole className="h-[18px] w-[18px] text-[var(--accent)]" />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}

        {route.section === "people" ? (
          <div>
            <div className="flex items-center justify-between px-3 py-2 text-xs text-[var(--text-muted)]">
              <span className="section-kicker">People</span>
              <Link href="/app/messages" className="glass-badge">
                <MessageSquareMore className="h-[18px] w-[18px]" />
                Inbox
              </Link>
            </div>

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
                    "flex items-center gap-3 border-b border-[var(--border-soft)] px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-panel-soft)]",
                    active && "bg-[var(--bg-active)]",
                  )}
                >
                    <Users2 className="h-[18px] w-[18px] text-[var(--accent)]" />
                  <span className="min-w-0 flex-1 font-medium text-white">
                    {item.label}
                  </span>
                  {count !== undefined ? <span className="nav-link-meta">{count}</span> : null}
                </Link>
              );
            })}
          </div>
        ) : null}

        {route.section === "settings" ? (
          <div>
            <div className="px-3 py-2 text-xs text-[var(--text-muted)]">
              <span className="section-kicker">Settings</span>
            </div>

            {settingsLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 border-b border-[var(--border-soft)] px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-panel-soft)]",
                  matchesPath(pathname, item.href) && "bg-[var(--bg-active)]",
                )}
              >
                  <Settings2 className="h-[18px] w-[18px] text-[var(--accent)]" />
                <span className="font-medium text-white">{item.label}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {route.section === "admin" ? (
          <div>
            <div className="px-3 py-2 text-xs text-[var(--text-muted)]">
              <span className="section-kicker">Control</span>
            </div>

            {adminLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 border-b border-[var(--border-soft)] px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-panel-soft)]",
                  matchesPath(pathname, item.href) && "bg-[var(--bg-active)]",
                )}
              >
                  <ShieldCheck className="h-[18px] w-[18px] text-[var(--accent)]" />
                <span className="font-medium text-white">{item.label}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-[var(--border)] px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-dim)]">
          <span>Realtime</span>
          <span>{incomingCalls.length} active</span>
        </div>
        <p className="mt-1 truncate text-sm font-medium text-white">
          {latestSignal ? latestSignal.call.status : "Connected"}
        </p>
      </div>
    </aside>
  );
}
