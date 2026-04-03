"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellDot,
  Hash,
  Layers3,
  LockKeyhole,
  MessageSquareMore,
  Mic,
  Settings2,
  ShieldCheck,
  Sparkles,
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
import { useEffect, useState } from "react";
import { apiClientFetch } from "@/lib/api-client";
import { parseAppPath, matchesPath } from "@/lib/app-shell";
import { buildHubLobbyHref } from "@/lib/hub-routes";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useRealtime } from "@/components/realtime/realtime-provider";

interface AppContextRailProps {
  viewer: PublicUser;
}

const settingsLinks = [
  {
    href: "/app/settings/profile",
    label: "Профиль",
    description: "Идентичность и аватар",
  },
  {
    href: "/app/settings/notifications",
    label: "Уведомления",
    description: "Сигналы по хабам и диалогам",
  },
] as const;

const adminLinks = [
  { href: "/app/admin", label: "Обзор", description: "Сводка платформы" },
  {
    href: "/app/admin/users",
    label: "Пользователи",
    description: "Модерация и поиск",
  },
  {
    href: "/app/admin/invites",
    label: "Ключи доступа",
    description: "Инвайты и маршруты входа",
  },
  {
    href: "/app/admin/audit",
    label: "Журнал аудита",
    description: "Критичные действия",
  },
] as const;

export function AppContextRail({ viewer }: AppContextRailProps) {
  const pathname = usePathname();
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
          const items = directConversationListResponseSchema.parse(payload).items;
          if (active) {
            setConversations(items);
            setHub(null);
            setPeopleSummary(null);
          }
          return;
        }

        if (route.section === "hubs") {
          if (route.hubId) {
            const payload = await apiClientFetch(`/v1/hubs/${route.hubId}`);
            if (active) {
              setHub(hubShellResponseSchema.parse(payload).hub);
              setConversations([]);
              setPeopleSummary(null);
            }
          } else {
            const payload = await apiClientFetch("/v1/hubs");
            if (active) {
              setHubs(hubListResponseSchema.parse(payload).items);
              setHub(null);
              setConversations([]);
              setPeopleSummary(null);
            }
          }
          return;
        }

        if (route.section === "people") {
          const [friendshipsPayload, blocksPayload] = await Promise.all([
            apiClientFetch("/v1/relationships/friends"),
            apiClientFetch("/v1/relationships/blocks"),
          ]);

          const friendships =
            friendshipsResponseSchema.parse(friendshipsPayload).items;
          const blocks = blocksResponseSchema.parse(blocksPayload).items;

          if (active) {
            setPeopleSummary({
              friends: friendships.filter((item) => item.state === "ACCEPTED")
                .length,
              incoming: friendships.filter(
                (item) => item.state === "INCOMING_REQUEST",
              ).length,
              blocks: blocks.length,
            });
            setConversations([]);
            setHub(null);
          }
          return;
        }

        const payload = await apiClientFetch("/v1/hubs");
        if (active) {
          setHubs(hubListResponseSchema.parse(payload).items);
          setConversations([]);
          setHub(null);
          setPeopleSummary(null);
        }
      } catch {
        if (active) {
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

  return (
    <aside className="context-rail flex min-h-0 flex-col overflow-hidden rounded-[28px] p-4 xl:sticky xl:top-3 xl:h-[calc(100vh-1.5rem)]">
      <div className="surface-highlight rounded-[24px] p-4">
        <p className="section-kicker">Context Rail</p>
        <div className="mt-3 flex items-start gap-3">
          <UserAvatar user={viewer} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {viewer.profile.displayName}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
              @{viewer.username}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="status-pill">
            <BellDot className="h-3.5 w-3.5 text-[var(--accent)]" />
            {incomingCalls.length} live
          </span>
          <span className="status-pill">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-warm)]" />
            {route.section}
          </span>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {route.section === "messages" ? (
          <div className="grid gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="section-kicker">Direct Lines</p>
                <Link href="/app/people" className="glass-badge">
                  <UserRoundPlus className="h-3 w-3" />
                  Новый контакт
                </Link>
              </div>
              <div className="grid gap-2">
                {loadingLabel === "messages" ? (
                  <div className="surface-subtle rounded-[20px] px-4 py-4 text-sm text-[var(--text-muted)]">
                    Загружаем диалоги...
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="surface-subtle rounded-[20px] px-4 py-4 text-sm text-[var(--text-muted)]">
                    Здесь появятся личные каналы, как только вы откроете первый
                    приватный диалог.
                  </div>
                ) : (
                  conversations.map((conversation) => {
                    const href = `/app/messages/${conversation.id}`;
                    const active = pathname === href;

                    return (
                      <Link
                        key={conversation.id}
                        href={href}
                        className={cn(
                          "context-link rounded-[20px]",
                          active && "context-link-active",
                        )}
                      >
                        <UserAvatar user={conversation.counterpart} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">
                            {conversation.counterpart.profile.displayName}
                          </span>
                          <span className="mt-1 block truncate text-xs text-[var(--text-dim)]">
                            {conversation.lastMessage?.content ??
                              "Пустой канал"}
                          </span>
                        </span>
                        {conversation.unreadCount > 0 ? (
                          <span className="glass-badge">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : null}

        {route.section === "hubs" && !route.hubId ? (
          <div className="grid gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="section-kicker">Spaces</p>
                <Link href="/app/hubs" className="glass-badge">
                  <Layers3 className="h-3 w-3" />
                  Все хабы
                </Link>
              </div>
              <div className="grid gap-2">
                {loadingLabel === "hubs" ? (
                  <div className="surface-subtle rounded-[20px] px-4 py-4 text-sm text-[var(--text-muted)]">
                    Загружаем пространства...
                  </div>
                ) : (
                  hubs.map((item) => (
                    <Link
                      key={item.id}
                      href={`/app/hubs/${item.id}`}
                      className={cn(
                        "context-link rounded-[20px]",
                        pathname.startsWith(`/app/hubs/${item.id}`) &&
                          "context-link-active",
                      )}
                    >
                      <span className="dock-icon flex h-10 w-10 items-center justify-center rounded-[16px] text-xs font-semibold text-white">
                        {item.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {item.name}
                        </span>
                        <span className="mt-1 block truncate text-xs text-[var(--text-dim)]">
                          {item.description ?? "Сообщество без описания"}
                        </span>
                      </span>
                      {item.isPrivate ? (
                        <LockKeyhole className="h-3.5 w-3.5 text-[var(--accent-warm)]" />
                      ) : null}
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {route.section === "hubs" && route.hubId ? (
          <div className="grid gap-4">
            <div className="surface-subtle rounded-[22px] p-4">
              <p className="section-kicker">Active Hub</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {hub?.name ?? "Пространство"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                {hub?.description ?? "Контекст пространства загружается."}
              </p>
            </div>

            <div>
              <div className="mb-2 px-1">
                <p className="section-kicker">Navigation</p>
              </div>
              <div className="grid gap-2">
                <Link
                  href={`/app/hubs/${route.hubId}`}
                  className={cn(
                    "context-link rounded-[20px]",
                    pathname === `/app/hubs/${route.hubId}` &&
                      "context-link-active",
                  )}
                >
                  <Layers3 className="h-4 w-4 text-[var(--accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">
                      Обзор хаба
                    </span>
                    <span className="mt-1 block text-xs text-[var(--text-dim)]">
                      Роли, участники и управление
                    </span>
                  </span>
                </Link>
                {hub?.lobbies.map((lobby) => {
                  const href = buildHubLobbyHref(route.hubId!, lobby.id, lobby.type);
                  const active = pathname === href || pathname.startsWith(`${href}/`);

                  return (
                    <Link
                      key={lobby.id}
                      href={href}
                      className={cn(
                        "context-link rounded-[20px]",
                        active && "context-link-active",
                      )}
                    >
                      <span className="dock-icon flex h-10 w-10 items-center justify-center rounded-[16px]">
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
                        <span className="mt-1 block truncate text-xs text-[var(--text-dim)]">
                          {lobby.type === "FORUM"
                            ? "Форумные треды"
                            : lobby.type === "VOICE"
                              ? "Голосовая сцена"
                              : "Текстовая лента"}
                        </span>
                      </span>
                      {lobby.isPrivate ? (
                        <LockKeyhole className="h-3.5 w-3.5 text-[var(--accent-warm)]" />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {route.section === "people" ? (
          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <div className="metric-tile rounded-[20px] p-4">
                <p className="section-kicker">Друзья</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {peopleSummary?.friends ?? 0}
                </p>
              </div>
              <div className="metric-tile rounded-[20px] p-4">
                <p className="section-kicker">Запросы</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {peopleSummary?.incoming ?? 0}
                </p>
              </div>
              <div className="metric-tile rounded-[20px] p-4">
                <p className="section-kicker">Блоки</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {peopleSummary?.blocks ?? 0}
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              {[
                {
                  href: "/app/people",
                  label: "Найти человека",
                  description: "Поиск по username и старт DM",
                },
                {
                  href: "/app/messages",
                  label: "Вернуться в inbox",
                  description: "Открыть приватные линии связи",
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "context-link rounded-[20px]",
                    matchesPath(pathname, item.href) && "context-link-active",
                  )}
                >
                  <Users2 className="h-4 w-4 text-[var(--accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--text-dim)]">
                      {item.description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {route.section === "settings" ? (
          <div className="grid gap-2">
            {settingsLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "context-link rounded-[20px]",
                  matchesPath(pathname, item.href) && "context-link-active",
                )}
              >
                <Settings2 className="h-4 w-4 text-[var(--accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--text-dim)]">
                    {item.description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : null}

        {route.section === "admin" ? (
          <div className="grid gap-2">
            {adminLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "context-link rounded-[20px]",
                  matchesPath(pathname, item.href) && "context-link-active",
                )}
              >
                <ShieldCheck className="h-4 w-4 text-[var(--accent-warm)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--text-dim)]">
                    {item.description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : null}

        {route.section === "overview" ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              {[
                {
                  href: "/app/messages",
                  icon: MessageSquareMore,
                  label: "Входящие линии",
                  description: "Диалоги, unread и live calls",
                },
                {
                  href: "/app/hubs",
                  icon: Layers3,
                  label: "Комьюнити-хабы",
                  description: "Пространства, роли, лобби",
                },
                {
                  href: "/app/people",
                  icon: Users2,
                  label: "Социальный граф",
                  description: "Друзья, запросы, блокировки",
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "context-link rounded-[20px]",
                    matchesPath(pathname, item.href) && "context-link-active",
                  )}
                >
                  <item.icon className="h-4 w-4 text-[var(--accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--text-dim)]">
                      {item.description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>

            {hubs.length > 0 ? (
              <div className="surface-subtle rounded-[22px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="section-kicker">Recent Hubs</p>
                  <span className="glass-badge">{hubs.length}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {hubs.slice(0, 5).map((item) => (
                    <Link
                      key={item.id}
                      href={`/app/hubs/${item.id}`}
                      className="context-link rounded-[18px]"
                    >
                      <span className="dock-icon flex h-9 w-9 items-center justify-center rounded-[14px] text-xs font-semibold text-white">
                        {item.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {item.name}
                        </span>
                        <span className="mt-1 block truncate text-xs text-[var(--text-dim)]">
                          {item.description ?? "Сообщество без описания"}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="surface-subtle mt-4 rounded-[22px] p-4">
        <p className="section-kicker">Realtime Layer</p>
        <p className="mt-2 text-sm font-semibold text-white">
          {latestSignal ? latestSignal.call.status : "Сеть синхронизирована"}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
          Нижняя control-зона удерживает чувство присутствия: кто в сети, где
          идет сигнал и какой раздел сейчас является контекстным центром.
        </p>
      </div>
    </aside>
  );
}
