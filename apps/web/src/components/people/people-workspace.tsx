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
import { MessageSquareMore, Search, ShieldBan, UserPlus2, Users2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type PeopleView = "friends" | "requests" | "discover" | "blocked";

const peopleViews: Array<{ id: PeopleView; label: string }> = [
  { id: "friends", label: "Friends" },
  { id: "requests", label: "Requests" },
  { id: "discover", label: "Discover" },
  { id: "blocked", label: "Blocked" },
];

interface RelationshipRowProps {
  user: PublicUser;
  subtitle?: string;
  meta?: ReactNode;
  actionKey: string | null;
  actions: ReactNode;
}

function RelationshipRow({
  user,
  subtitle,
  meta,
  actionKey,
  actions,
}: RelationshipRowProps) {
  return (
    <div className={cn("group list-row rounded-[16px] px-3 py-2.5", actionKey && "opacity-80")}>
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <UserAvatar user={user} size="sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-white">
                {user.profile.displayName}
              </p>
              {meta}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
              @{user.username}
            </p>
            <p className="mt-1 truncate text-sm text-[var(--text-dim)]">
              {subtitle ?? user.profile.bio ?? "Профиль без биографии."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:opacity-0 lg:transition lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          {actions}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <div className="compact-toolbar px-1">
      <p className="section-kicker">{title}</p>
      <span className="glass-badge">{count}</span>
    </div>
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
      setPanelError(
        error instanceof Error ? error.message : "Не удалось загрузить данные по людям",
      );
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
      setSearchError(
        error instanceof Error
          ? error.message
          : "Не удалось выполнить поиск пользователей",
      );
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
        error instanceof Error ? error.message : "Не удалось выполнить действие",
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
            "ru",
          ),
        ),
    [friendships],
  );
  const incoming = friendships.filter((item) => item.state === "INCOMING_REQUEST");
  const outgoing = friendships.filter((item) => item.state === "OUTGOING_REQUEST");

  return (
    <section className="grid gap-3">
      <div className="social-shell rounded-[20px] p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <Users2 className="h-3.5 w-3.5" />
                People
              </span>
              <span className="status-pill">{friends.length} friends</span>
              <span className="status-pill">
                {incoming.length + outgoing.length} requests
              </span>
            </div>
            <h2 className="mt-1.5 font-[var(--font-heading)] text-[1.15rem] font-semibold tracking-[-0.04em] text-white">
              People
            </h2>
          </div>

          <form
            className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-[460px]"
            onSubmit={(event) => {
              event.preventDefault();
              setView("discover");
              void refreshSearch();
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти по username"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={isSearching}>
              {isSearching ? "Ищем..." : "Search"}
            </Button>
          </form>
        </div>

        {searchError ? (
          <p className="mt-3 text-sm text-rose-200">{searchError}</p>
        ) : null}
      </div>

      {panelError ? (
        <div className="rounded-[16px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {panelError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 lg:hidden">
        {peopleViews.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "segment-chip",
              activeView === item.id && "segment-chip-active",
            )}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="premium-panel rounded-[20px] p-3">
        {activeView === "friends" ? (
          <div className="grid gap-2">
            <SectionHeader title="Friends" count={friends.length} />
            {friends.length === 0 ? (
              <EmptyState
                title="Пока нет друзей"
                description="Найдите человека и отправьте запрос."
              />
            ) : (
              friends.map((item) => (
                <RelationshipRow
                  key={item.id}
                  user={item.otherUser}
                  actionKey={actionKey === `ACCEPTED:${item.otherUser.username}` ? actionKey : null}
                  actions={
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void openDm(item.otherUser.username)}
                        disabled={actionKey === `SEARCH:${item.otherUser.username}`}
                      >
                        <MessageSquareMore className="h-3.5 w-3.5" />
                        Message
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          void withAction(`ACCEPTED:${item.otherUser.username}`, async () => {
                            await apiClientFetch("/v1/relationships/friends/remove", {
                              method: "POST",
                              body: JSON.stringify({ username: item.otherUser.username }),
                            });
                          })
                        }
                        disabled={actionKey === `ACCEPTED:${item.otherUser.username}`}
                      >
                        Remove
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          void withAction(`ACCEPTED:${item.otherUser.username}`, async () => {
                            await apiClientFetch("/v1/relationships/blocks", {
                              method: "POST",
                              body: JSON.stringify({ username: item.otherUser.username }),
                            });
                          })
                        }
                        disabled={actionKey === `ACCEPTED:${item.otherUser.username}`}
                      >
                        <ShieldBan className="h-3.5 w-3.5" />
                        Block
                      </Button>
                    </>
                  }
                />
              ))
            )}
          </div>
        ) : null}

        {activeView === "requests" ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <SectionHeader title="Incoming" count={incoming.length} />
              {incoming.length === 0 ? (
                <div className="surface-subtle rounded-[16px] px-3 py-3 text-sm text-[var(--text-muted)]">
                  Нет входящих запросов.
                </div>
              ) : (
                incoming.map((item) => (
                  <RelationshipRow
                    key={item.id}
                    user={item.otherUser}
                    subtitle="Хочет добавить вас в друзья."
                    actionKey={
                      actionKey === `INCOMING_REQUEST:${item.otherUser.username}`
                        ? actionKey
                        : null
                    }
                    actions={
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            void withAction(`INCOMING_REQUEST:${item.otherUser.username}`, async () => {
                              await apiClientFetch("/v1/relationships/friends/accept", {
                                method: "POST",
                                body: JSON.stringify({ username: item.otherUser.username }),
                              });
                            })
                          }
                          disabled={actionKey === `INCOMING_REQUEST:${item.otherUser.username}`}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void withAction(`INCOMING_REQUEST:${item.otherUser.username}`, async () => {
                              await apiClientFetch("/v1/relationships/friends/remove", {
                                method: "POST",
                                body: JSON.stringify({ username: item.otherUser.username }),
                              });
                            })
                          }
                          disabled={actionKey === `INCOMING_REQUEST:${item.otherUser.username}`}
                        >
                          Dismiss
                        </Button>
                      </>
                    }
                  />
                ))
              )}
            </div>

            <div className="grid gap-2">
              <SectionHeader title="Outgoing" count={outgoing.length} />
              {outgoing.length === 0 ? (
                <div className="surface-subtle rounded-[16px] px-3 py-3 text-sm text-[var(--text-muted)]">
                  Нет исходящих запросов.
                </div>
              ) : (
                outgoing.map((item) => (
                  <RelationshipRow
                    key={item.id}
                    user={item.otherUser}
                    subtitle="Ожидает ответа на ваш запрос."
                    actionKey={
                      actionKey === `OUTGOING_REQUEST:${item.otherUser.username}`
                        ? actionKey
                        : null
                    }
                    actions={
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          void withAction(`OUTGOING_REQUEST:${item.otherUser.username}`, async () => {
                            await apiClientFetch("/v1/relationships/friends/remove", {
                              method: "POST",
                              body: JSON.stringify({ username: item.otherUser.username }),
                            });
                          })
                        }
                        disabled={actionKey === `OUTGOING_REQUEST:${item.otherUser.username}`}
                      >
                        Cancel
                      </Button>
                    }
                  />
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeView === "discover" ? (
          <div className="grid gap-2">
            <SectionHeader title="Discover" count={results.length} />
            {query.trim().length === 0 ? (
              <EmptyState
                title="Начните с username"
                description="Введите username."
              />
            ) : results.length === 0 ? (
              <div className="surface-subtle rounded-[16px] px-3 py-3 text-sm text-[var(--text-muted)]">
                Ничего не найдено.
              </div>
            ) : (
              results.map((item) => {
                const busyKey = `SEARCH:${item.user.username}`;
                const friendshipState = item.relationship.friendshipState;

                return (
                  <RelationshipRow
                    key={item.user.id}
                    user={item.user}
                    subtitle={item.user.profile.bio ?? "Профиль без биографии."}
                    actionKey={actionKey === busyKey ? actionKey : null}
                    meta={
                      friendshipState === "ACCEPTED" ? (
                        <span className="glass-badge">Friend</span>
                      ) : item.relationship.isBlockedByViewer ? (
                        <span className="glass-badge">Blocked</span>
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
                        >
                          Unblock
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
                              disabled={actionKey === busyKey || item.relationship.hasBlockedViewer}
                            >
                              <UserPlus2 className="h-3.5 w-3.5" />
                              Add
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
                            >
                              Accept
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
                            >
                              Remove
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void openDm(item.user.username)}
                            disabled={actionKey === busyKey || item.relationship.hasBlockedViewer}
                          >
                            {item.relationship.dmConversationId ? "Open chat" : "Message"}
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
                          >
                            <ShieldBan className="h-3.5 w-3.5" />
                            Block
                          </Button>
                        </>
                      )
                    }
                  />
                );
              })
            )}
          </div>
        ) : null}

        {activeView === "blocked" ? (
          <div className="grid gap-2">
            <SectionHeader title="Blocked" count={blocks.length} />
            {blocks.length === 0 ? (
              <EmptyState
                title="Список блокировок пуст"
                description="Здесь появятся скрытые пользователи."
              />
            ) : (
              blocks.map((block) => (
                <RelationshipRow
                  key={block.id}
                  user={block.blockedUser}
                  subtitle="Сообщения и звонки с этим пользователем заблокированы."
                  actionKey={actionKey === `UNBLOCK:${block.blockedUser.username}` ? actionKey : null}
                  actions={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void withAction(`UNBLOCK:${block.blockedUser.username}`, async () => {
                          await apiClientFetch("/v1/relationships/blocks/unblock", {
                            method: "POST",
                            body: JSON.stringify({ username: block.blockedUser.username }),
                          });
                        })
                      }
                      disabled={actionKey === `UNBLOCK:${block.blockedUser.username}`}
                    >
                      Unblock
                    </Button>
                  }
                />
              ))
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
