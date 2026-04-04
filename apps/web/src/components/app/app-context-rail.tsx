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
import { apiClientFetch } from "@/lib/api-client";
import { matchesPath, parseAppPath } from "@/lib/app-shell";
import { applyDmSignalToConversationSummaries } from "@/lib/direct-message-state";
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

const railIconProps = { size: 18, strokeWidth: 1.5 } as const;

function RailRow({
  href,
  active,
  leading,
  label,
  meta,
  detail,
}: {
  href: string;
  active: boolean;
  leading: ReactNode;
  label: string;
  meta?: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "mx-2 my-1 flex min-h-[52px] items-center gap-3 rounded-[16px] border border-transparent px-3 text-sm transition-colors",
        active
          ? "border-[rgba(106,168,248,0.18)] bg-[rgba(106,168,248,0.12)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          : "text-zinc-400 hover:border-white/6 hover:bg-white/5 hover:text-white",
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate leading-tight", active ? "text-white" : "text-zinc-200")}>
          {label}
        </span>
        {detail ? (
          <span className="mt-0.5 block truncate text-xs text-zinc-500">{detail}</span>
        ) : null}
      </span>
      {meta}
    </Link>
  );
}

export function AppContextRail({ viewer }: AppContextRailProps) {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const searchParams = useSearchParams();
  const route = parseAppPath(safePathname);
  const { incomingCalls, latestDmSignal, latestSignal } = useRealtime();
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
    if (!latestDmSignal) {
      return;
    }

    setConversations((current) =>
      applyDmSignalToConversationSummaries(current, latestDmSignal),
    );
  }, [latestDmSignal]);

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
    <aside className="context-rail hidden min-h-screen w-60 border-r border-white/5 bg-[#121214] md:flex md:flex-col">
      <div className="border-b border-white/5 px-3 py-3">
        <div className="flex items-center gap-2 rounded-[18px] border border-white/6 bg-white/[0.03] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <UserAvatar user={viewer} size="sm" />
          <span className="status-dot bg-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {viewer.profile.displayName}
            </p>
            <p className="truncate text-xs text-zinc-500">@{viewer.username}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {route.section === "messages" ? (
          <div>
            <div className="flex h-10 items-center justify-between px-3 pt-2 text-xs text-zinc-500">
              <span>Conversations</span>
              <Link href="/app/people?view=discover" className="inline-flex items-center gap-1 text-zinc-400 hover:text-white">
                <UserRoundPlus {...railIconProps} />
                New
              </Link>
            </div>

            {loadingLabel === "messages" ? (
              <div className="px-3 py-6 text-center text-sm text-zinc-500">
                Loading chats...
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-zinc-500">
                No direct messages yet.
              </div>
            ) : (
              conversations.map((conversation) => {
                const href = `/app/messages/${conversation.id}`;

                return (
                  <RailRow
                    key={conversation.id}
                    href={href}
                    active={safePathname === href}
                    leading={<UserAvatar user={conversation.counterpart} size="sm" />}
                    label={conversation.counterpart.profile.displayName}
                    detail={
                      conversation.lastMessage?.isDeleted
                        ? "Message deleted"
                        : (conversation.lastMessage?.content ?? "No messages yet")
                    }
                    meta={
                      conversation.unreadCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[11px] text-white">
                          {conversation.unreadCount}
                        </span>
                      ) : null
                    }
                  />
                );
              })
            )}
          </div>
        ) : null}

        {route.section === "hubs" && !route.hubId ? (
          <div>
            <div className="flex h-10 items-center justify-between px-3 pt-2 text-xs text-zinc-500">
              <span>Hubs</span>
              <Link href="/app/hubs" className="inline-flex items-center gap-1 text-zinc-400 hover:text-white">
                <Layers3 {...railIconProps} />
                Browse
              </Link>
            </div>

            {loadingLabel === "hubs" ? (
              <div className="px-3 py-6 text-center text-sm text-zinc-500">
                Loading hubs...
              </div>
            ) : hubs.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-zinc-500">
                Join a hub or create a new one.
              </div>
            ) : (
              hubs.map((item) => (
                <RailRow
                  key={item.id}
                  href={`/app/hubs/${item.id}`}
                  active={safePathname.startsWith(`/app/hubs/${item.id}`)}
                  leading={
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-[10px] font-semibold text-zinc-200">
                      {item.name.slice(0, 2).toUpperCase()}
                    </span>
                  }
                  label={item.name}
                  detail={item.membershipRole ?? "Guest"}
                  meta={
                    item.isPrivate ? (
                      <LockKeyhole {...railIconProps} className="text-zinc-500" />
                    ) : null
                  }
                />
              ))
            )}
          </div>
        ) : null}

        {route.section === "hubs" && route.hubId ? (
          <div>
            <div className="px-3 py-3">
              <p className="truncate text-sm font-medium text-white">
                {hub?.name ?? "Hub"}
              </p>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {hub?.membershipRole ?? "Member"}
              </p>
            </div>

            <RailRow
              href={`/app/hubs/${route.hubId}`}
              active={safePathname === `/app/hubs/${route.hubId}`}
              leading={<House {...railIconProps} className="text-zinc-400" />}
              label="Home"
            />

            {groupedLobbies.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-2 text-xs text-zinc-500">{group.label}</div>

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
                      detail={lobby.type}
                      meta={
                        lobby.isPrivate ? (
                          <LockKeyhole {...railIconProps} className="text-zinc-500" />
                        ) : null
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}

        {route.section === "people" ? (
          <div>
            <div className="flex h-10 items-center justify-between px-3 pt-2 text-xs text-zinc-500">
              <span>People</span>
              <Link href="/app/messages" className="inline-flex items-center gap-1 text-zinc-400 hover:text-white">
                <MessageSquareMore {...railIconProps} />
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
                <RailRow
                  key={item.id}
                  href={href}
                  active={active}
                  leading={<Users2 {...railIconProps} className="text-zinc-400" />}
                  label={item.label}
                  meta={
                    count !== undefined ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[11px] text-zinc-200">
                        {count}
                      </span>
                    ) : null
                  }
                />
              );
            })}
          </div>
        ) : null}

        {route.section === "settings" ? (
          <div>
            <div className="px-3 py-3 text-xs text-zinc-500">Settings</div>
            {settingsLinks.map((item) => (
              <RailRow
                key={item.href}
                href={item.href}
                active={matchesPath(safePathname, item.href)}
                leading={<Settings2 {...railIconProps} className="text-zinc-400" />}
                label={item.label}
              />
            ))}
          </div>
        ) : null}

        {route.section === "admin" ? (
          <div>
            <div className="px-3 py-3 text-xs text-zinc-500">Control</div>
            {adminLinks.map((item) => (
              <RailRow
                key={item.href}
                href={item.href}
                active={matchesPath(safePathname, item.href)}
                leading={<ShieldCheck {...railIconProps} className="text-zinc-400" />}
                label={item.label}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/5 px-3 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
          <span>Realtime</span>
          <span>{incomingCalls.length} active</span>
        </div>
        <div className="mt-2 rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <p className="truncate text-sm text-zinc-200">
            {latestSignal ? latestSignal.call.status : "Connected"}
          </p>
        </div>
      </div>
    </aside>
  );
}
