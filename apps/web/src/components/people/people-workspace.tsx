"use client";

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
  MessageSquareMore,
  Search,
  ShieldBan,
  UserPlus2,
  Users2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CompactList,
  CompactListCount,
  CompactListHeader,
  CompactListMeta,
  CompactListRow,
} from "@/components/ui/compact-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type PeopleView = "friends" | "requests" | "discover" | "blocked";

const peopleViews: Array<{ id: PeopleView; label: string }> = [
  { id: "friends", label: "Друзья" },
  { id: "requests", label: "Заявки" },
  { id: "discover", label: "Поиск" },
  { id: "blocked", label: "Блокировки" },
];

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
}: {
  activeView: PeopleView;
  onSelect: (view: PeopleView) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border-soft)] px-3 py-2 lg:hidden">
      {peopleViews.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={cn(
            "segment-chip whitespace-nowrap",
            activeView === item.id && "segment-chip-active",
          )}
        >
          {item.label}
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
        "group flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:justify-between",
        busy && "opacity-70",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <UserAvatar user={user} size="sm" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium leading-tight text-white">
              {user.profile.displayName}
            </p>
            <PresenceIndicator presence={user.profile.presence} compact />
            {meta}
          </div>
          <p className="mt-0.5 truncate text-xs leading-tight text-[var(--text-muted)]">
            @{user.username}
          </p>
          <p className="mt-1 truncate text-xs leading-tight text-[var(--text-dim)]">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
        {actions}
      </div>
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
    await withAction(`SEARCH:${username}`, async () => {
      const payload = await apiClientFetch("/v1/direct-messages/open", {
        method: "POST",
        body: JSON.stringify({ username }),
      });

      const conversation =
        directConversationSummaryResponseSchema.parse(payload).conversation;
      router.push(`/app/messages/${conversation.id}`);
      router.refresh();
    });
  }

  function setView(nextView: PeopleView) {
    router.replace(`${pathname}?view=${nextView}`);
  }

  const friends = useMemo(
    () =>
      friendships
        .filter((item) => item.state === "ACCEPTED")
        .sort((left, right) =>
          left.otherUser.profile.displayName.localeCompare(
            right.otherUser.profile.displayName,
            "en",
          ),
        ),
    [friendships],
  );

  const incoming = friendships.filter((item) => item.state === "INCOMING_REQUEST");
  const outgoing = friendships.filter((item) => item.state === "OUTGOING_REQUEST");

  return (
    <section className="flex min-h-full flex-col">
      <div className="border-b border-[var(--border-soft)] px-3 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CompactListMeta>Люди</CompactListMeta>
              <CompactListMeta>{friends.length} друзей</CompactListMeta>
              <CompactListMeta>{incoming.length + outgoing.length} заявок</CompactListMeta>
            </div>
            <h2 className="mt-2 text-base font-semibold tracking-tight text-white">
              Социальный граф
            </h2>
          </div>

          <form
            className="flex w-full max-w-[420px] gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setView("discover");
              void refreshSearch();
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                className="h-10 pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по нику"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={isSearching} className="h-10 px-3">
              {isSearching ? "Ищем..." : "Найти"}
            </Button>
          </form>
        </div>
      </div>

      {panelError ? (
        <div className="border-b border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {panelError}
        </div>
      ) : null}

      {searchError ? (
        <div className="border-b border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {searchError}
        </div>
      ) : null}

      <ViewTabs activeView={activeView} onSelect={setView} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeView === "friends" ? (
          <div>
            <CompactListHeader>
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
                                  body: JSON.stringify({ username: item.otherUser.username }),
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
                                  body: JSON.stringify({ username: item.otherUser.username }),
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
          </div>
        ) : null}

        {activeView === "requests" ? (
          <div>
            <CompactListHeader>
              <span>Входящие заявки</span>
              <CompactListCount>{incoming.length}</CompactListCount>
            </CompactListHeader>
            {incoming.length === 0 ? (
              <EmptyView
                icon={Users2}
                title="Входящих заявок нет"
                description="Новые заявки появятся здесь."
              />
            ) : (
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
                                  body: JSON.stringify({ username: item.otherUser.username }),
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
                                  body: JSON.stringify({ username: item.otherUser.username }),
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
            )}

            <CompactListHeader>
              <span>Исходящие заявки</span>
              <CompactListCount>{outgoing.length}</CompactListCount>
            </CompactListHeader>
            {outgoing.length === 0 ? (
              <EmptyView
                icon={Users2}
                title="Исходящих заявок нет"
                description="Ожидающие заявки появятся здесь."
              />
            ) : (
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
                                body: JSON.stringify({ username: item.otherUser.username }),
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
            )}
          </div>
        ) : null}

        {activeView === "discover" ? (
          <div>
            <CompactListHeader>
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
              <EmptyView icon={Search} title="Ничего не найдено" description="Попробуйте другой ник." />
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
                                await apiClientFetch("/v1/relationships/blocks/unblock", {
                                  method: "POST",
                                  body: JSON.stringify({ username: item.user.username }),
                                });
                              })
                            }
                            disabled={actionKey === busyKey}
                            className="h-8 px-2.5"
                          >
                            Разблокировать
                          </Button>
                        ) : (
                          <>
                            {(friendshipState === "NONE" || friendshipState === "REMOVED") && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  void withAction(busyKey, async () => {
                                    await apiClientFetch("/v1/relationships/friends/request", {
                                      method: "POST",
                                      body: JSON.stringify({ username: item.user.username }),
                                    });
                                  })
                                }
                                disabled={
                                  actionKey === busyKey || item.relationship.hasBlockedViewer
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
                                    await apiClientFetch("/v1/relationships/friends/accept", {
                                      method: "POST",
                                      body: JSON.stringify({ username: item.user.username }),
                                    });
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
                                    await apiClientFetch("/v1/relationships/friends/remove", {
                                      method: "POST",
                                      body: JSON.stringify({ username: item.user.username }),
                                    });
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
                                actionKey === busyKey || item.relationship.hasBlockedViewer
                              }
                              className="h-8 px-2.5"
                            >
                              <MessageSquareMore className="h-[18px] w-[18px]" />
                              {item.relationship.dmConversationId ? "Открыть чат" : "Написать"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                void withAction(busyKey, async () => {
                                  await apiClientFetch("/v1/relationships/blocks", {
                                    method: "POST",
                                    body: JSON.stringify({ username: item.user.username }),
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
          </div>
        ) : null}

        {activeView === "blocked" ? (
          <div>
            <CompactListHeader>
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
          </div>
        ) : null}
      </div>
    </section>
  );
}
