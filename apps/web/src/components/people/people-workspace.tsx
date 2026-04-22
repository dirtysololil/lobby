"use client";

import Link from "next/link";
import {
  blocksResponseSchema,
  directConversationSummaryResponseSchema,
  friendshipsResponseSchema,
  userSearchResponseSchema,
  type BlockRecord,
  type FriendshipRecord,
  type PublicUser,
  type UserSearchResult,
} from "@lobby/shared";
import {
  Inbox,
  MessageSquareMore,
  Search,
  Send,
  ShieldBan,
  UserPlus2,
  Users2,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppMobileTopNav } from "@/components/app/app-mobile-top-nav";
import {
  CompactList,
  CompactListCount,
  CompactListHeader,
  CompactListMeta,
  CompactListRow,
} from "@/components/ui/compact-list";
import { Button } from "@/components/ui/button";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { buildUserProfileHref } from "@/lib/profile-routes";
import { cn } from "@/lib/utils";

type PeopleView = "friends" | "requests" | "discover" | "blocked";

const peopleViews: Array<{ id: PeopleView; label: string }> = [
  { id: "friends", label: "Друзья" },
  { id: "requests", label: "Заявки" },
  { id: "discover", label: "Поиск" },
  { id: "blocked", label: "Блокировки" },
];

const peopleViewCopy: Record<
  PeopleView,
  { title: string; description: string; countLabel: string }
> = {
  friends: {
    title: "Контакты",
    description: "Быстрый доступ к друзьям, чату и действиям без лишних панелей.",
    countLabel: "друзей",
  },
  requests: {
    title: "Заявки",
    description: "Новые входящие и исходящие запросы в одном плотном рабочем экране.",
    countLabel: "заявок",
  },
  discover: {
    title: "Поиск людей",
    description: "Ищите по нику, открывайте чат и управляйте связями из одного списка.",
    countLabel: "результатов",
  },
  blocked: {
    title: "Блокировки",
    description: "Управление заблокированными аккаунтами без переходов по дополнительным экранам.",
    countLabel: "блокировок",
  },
};

interface RelationshipRowProps {
  user: PublicUser;
  subtitle: string;
  meta?: ReactNode;
  busy: boolean;
  actions: ReactNode;
}

function ViewTabs({
  activeView,
  onSelect,
  className,
}: {
  activeView: PeopleView;
  onSelect: (view: PeopleView) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-6 overflow-x-auto text-[13px] font-medium text-[#7f8a9c]",
        className,
      )}
    >
      {peopleViews.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={cn(
            "relative shrink-0 whitespace-nowrap pb-2 transition-colors",
            activeView === item.id ? "text-[#4a84ff]" : "hover:text-white",
          )}
        >
          {item.label}
          {activeView === item.id ? (
            <span className="absolute inset-x-0 bottom-[-2px] h-[2px] rounded-full bg-[#4a84ff]" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function EmptyView({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users2;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state-minimal">
      <Icon className="h-5 w-5 text-[var(--text-muted)]" />
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-xs text-[var(--text-dim)]">{description}</p>
      </div>
    </div>
  );
}

function CompactEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users2;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[144px] flex-col items-center justify-center gap-2 px-4 py-5 text-center">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--border-soft)] bg-white/[0.04] text-[var(--text-muted)]">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs leading-5 text-[var(--text-dim)]">{description}</p>
      </div>
    </div>
  );
}

function RequestPanel({
  title,
  description,
  count,
  icon: Icon,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string;
  description: string;
  count: number;
  icon: typeof Users2;
  emptyTitle: string;
  emptyDescription: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%),rgba(16,24,36,0.76)] p-3.5 shadow-[0_18px_36px_rgba(4,10,18,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/6 bg-white/[0.04] text-[#9fbfff]">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium tracking-tight text-white">{title}</p>
            <p className="mt-1 text-sm text-[#8d98aa]">{description}</p>
          </div>
        </div>

        <CompactListCount>{count}</CompactListCount>
      </div>

      <div className="mt-3 overflow-hidden rounded-[18px] border border-white/6 bg-[#0f1823]/82">
        {count === 0 ? (
          <CompactEmptyState
            icon={Icon}
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function RelationshipRow({
  user,
  subtitle,
  meta,
  busy,
  actions,
}: RelationshipRowProps) {
  return (
    <CompactListRow
      className={cn(
        "group flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-between",
        busy && "opacity-70",
      )}
    >
      <Link
        href={buildUserProfileHref(user.username)}
        className="identity-link rounded-[16px] sm:max-w-[min(100%,420px)]"
      >
        <UserAvatar user={user} size="sm" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium leading-tight text-white">
              {user.profile.displayName}
            </p>
            <PresenceIndicator user={user} compact />
            {meta}
          </div>
          <p className="mt-0.5 truncate text-xs leading-tight text-[var(--text-muted)]">
            @{user.username}
          </p>
          <p className="mt-1 truncate text-xs leading-tight text-[var(--text-dim)]">
            {subtitle}
          </p>
        </div>
      </Link>

      <div className="flex flex-wrap gap-1.5">{actions}</div>
    </CompactListRow>
  );
}

export function PeopleWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [friendships, setFriendships] = useState<FriendshipRecord[]>([]);
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const rawView = searchParams.get("view");
  const activeView = peopleViews.some((item) => item.id === rawView)
    ? (rawView as PeopleView)
    : "friends";

  useEffect(() => {
    void refreshPanels();
  }, []);

  async function refreshPanels() {
    try {
      const [friendshipsPayload, blocksPayload] = await Promise.all([
        apiClientFetch("/v1/relationships/friends"),
        apiClientFetch("/v1/relationships/blocks"),
      ]);

      setFriendships(friendshipsResponseSchema.parse(friendshipsPayload).items);
      setBlocks(blocksResponseSchema.parse(blocksPayload).items);
      setPanelError(null);
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Не удалось загрузить людей.");
    }
  }

  async function refreshSearch(nextQuery = query) {
    const normalizedQuery = nextQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      setResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);

    try {
      const payload = await apiClientFetch(
        `/v1/users/search?query=${encodeURIComponent(normalizedQuery)}`,
      );
      setResults(userSearchResponseSchema.parse(payload).items);
      setSearchError(null);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Не удалось выполнить поиск.");
    } finally {
      setIsSearching(false);
    }
  }

  async function withAction(key: string, action: () => Promise<void>) {
    setActionKey(key);

    try {
      await action();
      await refreshPanels();
      await refreshSearch();
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Не удалось выполнить это действие.",
      );
    } finally {
      setActionKey(null);
    }
  }

  async function openDm(username: string) {
    setActionKey(`SEARCH:${username}`);
    setSearchError(null);

    try {
      const payload = await apiClientFetch("/v1/direct-messages/open", {
        method: "POST",
        body: JSON.stringify({ username }),
      });

      const conversation =
        directConversationSummaryResponseSchema.parse(payload).conversation;
      router.push(`/app/messages/${conversation.id}`);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Не удалось открыть диалог.");
    } finally {
      setActionKey(null);
    }
  }

  function setView(nextView: PeopleView) {
    router.replace(`${pathname}?view=${nextView}`);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setView("discover");
    void refreshSearch();
  }

  const friends = useMemo(
    () =>
      friendships
        .filter((item) => item.state === "ACCEPTED")
        .sort((left, right) =>
          left.otherUser.profile.displayName.localeCompare(
            right.otherUser.profile.displayName,
            "ru",
          ),
        ),
    [friendships],
  );

  const incoming = friendships.filter((item) => item.state === "INCOMING_REQUEST");
  const outgoing = friendships.filter((item) => item.state === "OUTGOING_REQUEST");
  const activeViewMeta = peopleViewCopy[activeView];
  const activeCount =
    activeView === "friends"
      ? friends.length
      : activeView === "requests"
        ? incoming.length + outgoing.length
        : activeView === "discover"
          ? results.length
          : blocks.length;

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0d151f] md:bg-[linear-gradient(180deg,rgba(255,255,255,0.012),transparent_14%),#0f1721]">
      <div className="absolute inset-0 hidden bg-[radial-gradient(circle_at_50%_15%,rgba(69,110,185,0.14),transparent_0%,transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.01),transparent_18%)] md:block" />

      <div className="relative flex h-full min-h-0 flex-col">
        <div className="border-b border-white/5 px-4 pb-3 pt-5 md:px-5 md:pb-4 md:pt-5">
          <div className="md:hidden">
            <AppMobileTopNav active="people" />
          </div>

          <div className="mt-4 flex flex-col gap-4 md:mt-0 md:flex-row md:items-start md:justify-between">
            <div className="hidden min-w-0 md:block">
              <div className="flex flex-wrap items-center gap-2">
                <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
                  Люди
                </CompactListMeta>
                <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
                  {friends.length} друзей
                </CompactListMeta>
                <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
                  {incoming.length + outgoing.length} заявок
                </CompactListMeta>
                <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
                  {blocks.length} блокировок
                </CompactListMeta>
              </div>
              <h2 className="mt-3 text-[26px] font-semibold tracking-[-0.04em] text-white">
                {activeViewMeta.title}
              </h2>
              <p className="mt-1 text-sm text-[#8d98aa]">
                {activeViewMeta.description}
              </p>
            </div>

            <form
              className="flex w-full items-center gap-2 md:max-w-[430px]"
              onSubmit={handleSearchSubmit}
            >
              <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-white/6 bg-white/[0.04] px-3 text-[#9ca9bb] focus-within:border-[#3b6ed8]/32">
                <Search size={17} strokeWidth={1.75} className="shrink-0" />
                <input
                  className="w-full border-0 bg-transparent p-0 text-[14px] text-white outline-none placeholder:text-[#7b8697]"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Поиск по нику"
                  aria-label="Поиск по людям"
                  autoComplete="off"
                />
              </label>
              <button
                type="submit"
                disabled={isSearching}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/6 bg-white/[0.04] text-[#9ca9bb] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-60 md:w-auto md:gap-2 md:border-[#4a84ff]/24 md:bg-[#14233a] md:px-4 md:text-white"
                aria-label="Найти людей"
                title="Найти людей"
              >
                <Search size={17} strokeWidth={1.75} />
                <span className="hidden md:inline">
                  {isSearching ? "Ищем..." : "Найти"}
                </span>
              </button>
            </form>
          </div>

          <ViewTabs
            activeView={activeView}
            onSelect={setView}
            className="mt-4 border-b border-white/5 pb-0.5 pl-1"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-0 py-2 md:px-5 md:py-5">
            {panelError ? (
              <div className="mx-4 mb-3 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 md:mx-0">
                {panelError}
              </div>
            ) : null}

            {searchError ? (
              <div className="mx-4 mb-3 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100 md:mx-0">
                {searchError}
              </div>
            ) : null}

            {activeView === "friends" ? (
              <section className="md:overflow-hidden md:rounded-[24px] md:border md:border-white/6 md:bg-white/[0.02]">
                <CompactListHeader className="px-4 py-3">
                  <span>Друзья</span>
                  <CompactListCount>{friends.length}</CompactListCount>
                </CompactListHeader>
                {friends.length === 0 ? (
                  <EmptyView
                    icon={Users2}
                    title="Друзей пока нет"
                    description="Найдите кого-нибудь и отправьте заявку."
                  />
                ) : (
                  <CompactList>
                    {friends.map((item) => {
                      const removeKey = `ACCEPTED:${item.otherUser.username}`;
                      const messageKey = `SEARCH:${item.otherUser.username}`;

                      return (
                        <RelationshipRow
                          key={item.id}
                          user={item.otherUser}
                          subtitle={item.otherUser.profile.bio ?? "Описания пока нет."}
                          busy={actionKey === removeKey || actionKey === messageKey}
                          actions={
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void openDm(item.otherUser.username)}
                                disabled={actionKey === messageKey}
                                className="h-8 px-2.5"
                              >
                                <MessageSquareMore className="h-[18px] w-[18px]" />
                                Написать
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  void withAction(removeKey, async () => {
                                    await apiClientFetch("/v1/relationships/friends/remove", {
                                      method: "POST",
                                      body: JSON.stringify({
                                        username: item.otherUser.username,
                                      }),
                                    });
                                  })
                                }
                                disabled={actionKey === removeKey}
                                className="h-8 px-2.5"
                              >
                                Удалить
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  void withAction(removeKey, async () => {
                                    await apiClientFetch("/v1/relationships/blocks", {
                                      method: "POST",
                                      body: JSON.stringify({
                                        username: item.otherUser.username,
                                      }),
                                    });
                                  })
                                }
                                disabled={actionKey === removeKey}
                                className="h-8 px-2.5"
                              >
                                <ShieldBan className="h-[18px] w-[18px]" />
                                Заблокировать
                              </Button>
                            </>
                          }
                        />
                      );
                    })}
                  </CompactList>
                )}
              </section>
            ) : null}

            {activeView === "requests" ? (
              <div className="grid gap-3 px-4 py-3 md:px-0 md:py-0 xl:grid-cols-2">
                <RequestPanel
                  title="Входящие заявки"
                  description="Новые люди, которые хотят добавить вас в контакты."
                  count={incoming.length}
                  icon={Inbox}
                  emptyTitle="Пока ничего нового"
                  emptyDescription="Новые входящие заявки появятся здесь, когда кто-то запросит контакт."
                >
                  <CompactList>
                    {incoming.map((item) => {
                      const busyKey = `INCOMING_REQUEST:${item.otherUser.username}`;

                      return (
                        <RelationshipRow
                          key={item.id}
                          user={item.otherUser}
                          subtitle="Хочет добавить вас в контакты."
                          busy={actionKey === busyKey}
                          actions={
                            <>
                              <Button
                                size="sm"
                                onClick={() =>
                                  void withAction(busyKey, async () => {
                                    await apiClientFetch("/v1/relationships/friends/accept", {
                                      method: "POST",
                                      body: JSON.stringify({
                                        username: item.otherUser.username,
                                      }),
                                    });
                                  })
                                }
                                disabled={actionKey === busyKey}
                                className="h-8 px-2.5"
                              >
                                Принять
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  void withAction(busyKey, async () => {
                                    await apiClientFetch("/v1/relationships/friends/remove", {
                                      method: "POST",
                                      body: JSON.stringify({
                                        username: item.otherUser.username,
                                      }),
                                    });
                                  })
                                }
                                disabled={actionKey === busyKey}
                                className="h-8 px-2.5"
                              >
                                Отклонить
                              </Button>
                            </>
                          }
                        />
                      );
                    })}
                  </CompactList>
                </RequestPanel>

                <RequestPanel
                  title="Исходящие заявки"
                  description="Запросы, которые уже отправлены и ждут ответа."
                  count={outgoing.length}
                  icon={Send}
                  emptyTitle="Нет ожидающих запросов"
                  emptyDescription="Когда вы отправите новую заявку, она появится здесь до ответа."
                >
                  <CompactList>
                    {outgoing.map((item) => {
                      const busyKey = `OUTGOING_REQUEST:${item.otherUser.username}`;

                      return (
                        <RelationshipRow
                          key={item.id}
                          user={item.otherUser}
                          subtitle="Ожидает ответа."
                          busy={actionKey === busyKey}
                          actions={
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void withAction(busyKey, async () => {
                                  await apiClientFetch("/v1/relationships/friends/remove", {
                                    method: "POST",
                                    body: JSON.stringify({
                                      username: item.otherUser.username,
                                    }),
                                  });
                                })
                              }
                              disabled={actionKey === busyKey}
                              className="h-8 px-2.5"
                            >
                              Отменить
                            </Button>
                          }
                        />
                      );
                    })}
                  </CompactList>
                </RequestPanel>
              </div>
            ) : null}

            {activeView === "discover" ? (
              <section className="md:overflow-hidden md:rounded-[24px] md:border md:border-white/6 md:bg-white/[0.02]">
                <CompactListHeader className="px-4 py-3">
                  <span>Поиск</span>
                  <CompactListCount>{results.length}</CompactListCount>
                </CompactListHeader>
                {query.trim().length === 0 ? (
                  <EmptyView
                    icon={Search}
                    title="Поиск по нику"
                    description="Введите ник, чтобы найти людей."
                  />
                ) : results.length === 0 ? (
                  <EmptyView
                    icon={Search}
                    title="Ничего не найдено"
                    description="Попробуйте другой ник."
                  />
                ) : (
                  <CompactList>
                    {results.map((item) => {
                      const busyKey = `SEARCH:${item.user.username}`;
                      const friendshipState = item.relationship.friendshipState;

                      return (
                        <RelationshipRow
                          key={item.user.id}
                          user={item.user}
                          subtitle={item.user.profile.bio ?? "Описания пока нет."}
                          busy={actionKey === busyKey}
                          meta={
                            friendshipState === "ACCEPTED" ? (
                              <CompactListCount>Друг</CompactListCount>
                            ) : item.relationship.isBlockedByViewer ? (
                              <CompactListCount>Заблокирован</CompactListCount>
                            ) : null
                          }
                          actions={
                            item.relationship.isBlockedByViewer ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  void withAction(busyKey, async () => {
                                    await apiClientFetch(
                                      "/v1/relationships/blocks/unblock",
                                      {
                                        method: "POST",
                                        body: JSON.stringify({
                                          username: item.user.username,
                                        }),
                                      },
                                    );
                                  })
                                }
                                disabled={actionKey === busyKey}
                                className="h-8 px-2.5"
                              >
                                Разблокировать
                              </Button>
                            ) : (
                              <>
                                {(friendshipState === "NONE" ||
                                  friendshipState === "REMOVED") && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      void withAction(busyKey, async () => {
                                        await apiClientFetch(
                                          "/v1/relationships/friends/request",
                                          {
                                            method: "POST",
                                            body: JSON.stringify({
                                              username: item.user.username,
                                            }),
                                          },
                                        );
                                      })
                                    }
                                    disabled={
                                      actionKey === busyKey ||
                                      item.relationship.hasBlockedViewer
                                    }
                                    className="h-8 px-2.5"
                                  >
                                    <UserPlus2 className="h-[18px] w-[18px]" />
                                    Добавить
                                  </Button>
                                )}
                                {friendshipState === "INCOMING_REQUEST" && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      void withAction(busyKey, async () => {
                                        await apiClientFetch(
                                          "/v1/relationships/friends/accept",
                                          {
                                            method: "POST",
                                            body: JSON.stringify({
                                              username: item.user.username,
                                            }),
                                          },
                                        );
                                      })
                                    }
                                    disabled={actionKey === busyKey}
                                    className="h-8 px-2.5"
                                  >
                                    Принять
                                  </Button>
                                )}
                                {(friendshipState === "OUTGOING_REQUEST" ||
                                  friendshipState === "ACCEPTED") && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                      void withAction(busyKey, async () => {
                                        await apiClientFetch(
                                          "/v1/relationships/friends/remove",
                                          {
                                            method: "POST",
                                            body: JSON.stringify({
                                              username: item.user.username,
                                            }),
                                          },
                                        );
                                      })
                                    }
                                    disabled={actionKey === busyKey}
                                    className="h-8 px-2.5"
                                  >
                                    Удалить
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void openDm(item.user.username)}
                                  disabled={
                                    actionKey === busyKey ||
                                    item.relationship.hasBlockedViewer ||
                                    (!item.relationship.dmConversationId &&
                                      item.relationship.friendshipState !== "ACCEPTED")
                                  }
                                  className="h-8 px-2.5"
                                >
                                  <MessageSquareMore className="h-[18px] w-[18px]" />
                                  {item.relationship.dmConversationId
                                    ? "Открыть чат"
                                    : "Написать"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    void withAction(busyKey, async () => {
                                      await apiClientFetch("/v1/relationships/blocks", {
                                        method: "POST",
                                        body: JSON.stringify({
                                          username: item.user.username,
                                        }),
                                      });
                                    })
                                  }
                                  disabled={actionKey === busyKey}
                                  className="h-8 px-2.5"
                                >
                                  <ShieldBan className="h-[18px] w-[18px]" />
                                  Заблокировать
                                </Button>
                              </>
                            )
                          }
                        />
                      );
                    })}
                  </CompactList>
                )}
              </section>
            ) : null}

            {activeView === "blocked" ? (
              <section className="md:overflow-hidden md:rounded-[24px] md:border md:border-white/6 md:bg-white/[0.02]">
                <CompactListHeader className="px-4 py-3">
                  <span>Блокировки</span>
                  <CompactListCount>{blocks.length}</CompactListCount>
                </CompactListHeader>
                {blocks.length === 0 ? (
                  <EmptyView
                    icon={ShieldBan}
                    title="Никто не заблокирован"
                    description="Заблокированные аккаунты появятся здесь."
                  />
                ) : (
                  <CompactList>
                    {blocks.map((block) => {
                      const busyKey = `UNBLOCK:${block.blockedUser.username}`;

                      return (
                        <RelationshipRow
                          key={block.id}
                          user={block.blockedUser}
                          subtitle="Сообщения и звонки заблокированы."
                          busy={actionKey === busyKey}
                          actions={
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void withAction(busyKey, async () => {
                                  await apiClientFetch("/v1/relationships/blocks/unblock", {
                                    method: "POST",
                                    body: JSON.stringify({
                                      username: block.blockedUser.username,
                                    }),
                                  });
                                })
                              }
                              disabled={actionKey === busyKey}
                              className="h-8 px-2.5"
                            >
                              Разблокировать
                            </Button>
                          }
                        />
                      );
                    })}
                  </CompactList>
                )}
              </section>
            ) : null}

            <div className="px-4 pb-2 pt-3 text-center text-[12px] text-[#7b8697] md:px-0">
              {activeCount} {activeViewMeta.countLabel}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
