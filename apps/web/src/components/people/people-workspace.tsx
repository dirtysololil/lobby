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
import { Button } from "@/components/ui/button";
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
  subtitle: string;
  meta?: ReactNode;
  busy: boolean;
  actions: ReactNode;
}

function CountBadge({ value }: { value: number | string }) {
  return (
    <span className="inline-flex min-h-5 items-center rounded-full bg-[var(--bg-panel-soft)] px-2 text-[11px] font-medium text-[var(--text-dim)]">
      {value}
    </span>
  );
}

function ViewTabs({
  activeView,
  onSelect,
}: {
  activeView: PeopleView;
  onSelect: (view: PeopleView) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto px-3 py-2 lg:hidden">
      {peopleViews.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={cn("segment-chip whitespace-nowrap", activeView === item.id && "segment-chip-active")}
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

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-3 py-2 text-xs text-[var(--text-dim)]">
      <span>{title}</span>
      <CountBadge value={count} />
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
    <div
      className={cn(
        "group flex flex-col gap-2 border-b border-[var(--border-soft)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)] lg:flex-row lg:items-center lg:justify-between",
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
        error instanceof Error ? error.message : "Unable to load people right now.",
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
        error instanceof Error ? error.message : "Unable to search people.",
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
        error instanceof Error ? error.message : "Unable to complete that action.",
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
      <div className="border-b border-[var(--border)] px-3 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <Users2 className="h-[18px] w-[18px]" />
                People
              </span>
              <span className="status-pill">{friends.length} friends</span>
              <span className="status-pill">
                {incoming.length + outgoing.length} requests
              </span>
            </div>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-white">
              Social graph
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
                className="h-9 pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by username"
                autoComplete="off"
              />
            </div>
            <Button type="submit" size="sm" disabled={isSearching} className="h-9 px-3">
              {isSearching ? "Searching..." : "Search"}
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
            <SectionHeader title="Friends" count={friends.length} />
            {friends.length === 0 ? (
              <EmptyView
                icon={Users2}
                title="No friends yet"
                description="Search for someone and send a request."
              />
            ) : (
              friends.map((item) => {
                const removeKey = `ACCEPTED:${item.otherUser.username}`;
                const messageKey = `SEARCH:${item.otherUser.username}`;

                return (
                  <RelationshipRow
                    key={item.id}
                    user={item.otherUser}
                    subtitle={item.otherUser.profile.bio ?? "No bio yet."}
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
                          Message
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
                          Remove
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
                          Block
                        </Button>
                      </>
                    }
                  />
                );
              })
            )}
          </div>
        ) : null}

        {activeView === "requests" ? (
          <div>
            <SectionHeader title="Incoming requests" count={incoming.length} />
            {incoming.length === 0 ? (
              <EmptyView
                icon={Users2}
                title="No incoming requests"
                description="New requests will show up here."
              />
            ) : (
              incoming.map((item) => {
                const busyKey = `INCOMING_REQUEST:${item.otherUser.username}`;

                return (
                  <RelationshipRow
                    key={item.id}
                    user={item.otherUser}
                    subtitle="Wants to connect with you."
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
                          Accept
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
                          Dismiss
                        </Button>
                      </>
                    }
                  />
                );
              })
            )}

            <SectionHeader title="Outgoing requests" count={outgoing.length} />
            {outgoing.length === 0 ? (
              <EmptyView
                icon={Users2}
                title="No outgoing requests"
                description="Pending requests will show up here."
              />
            ) : (
              outgoing.map((item) => {
                const busyKey = `OUTGOING_REQUEST:${item.otherUser.username}`;

                return (
                  <RelationshipRow
                    key={item.id}
                    user={item.otherUser}
                    subtitle="Waiting for a reply."
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
                        Cancel
                      </Button>
                    }
                  />
                );
              })
            )}
          </div>
        ) : null}

        {activeView === "discover" ? (
          <div>
            <SectionHeader title="Discover" count={results.length} />
            {query.trim().length === 0 ? (
              <EmptyView
                icon={Search}
                title="Search by username"
                description="Type a username to find people."
              />
            ) : results.length === 0 ? (
              <EmptyView
                icon={Search}
                title="No matches"
                description="Try another username."
              />
            ) : (
              results.map((item) => {
                const busyKey = `SEARCH:${item.user.username}`;
                const friendshipState = item.relationship.friendshipState;

                return (
                  <RelationshipRow
                    key={item.user.id}
                    user={item.user}
                    subtitle={item.user.profile.bio ?? "No bio yet."}
                    busy={actionKey === busyKey}
                    meta={
                      friendshipState === "ACCEPTED" ? (
                        <CountBadge value="Friend" />
                      ) : item.relationship.isBlockedByViewer ? (
                        <CountBadge value="Blocked" />
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
                              className="h-8 px-2.5"
                            >
                              <UserPlus2 className="h-[18px] w-[18px]" />
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
                              className="h-8 px-2.5"
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
                              className="h-8 px-2.5"
                            >
                              Remove
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void openDm(item.user.username)}
                            disabled={actionKey === busyKey || item.relationship.hasBlockedViewer}
                            className="h-8 px-2.5"
                          >
                            <MessageSquareMore className="h-[18px] w-[18px]" />
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
                            className="h-8 px-2.5"
                          >
                            <ShieldBan className="h-[18px] w-[18px]" />
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
          <div>
            <SectionHeader title="Blocked" count={blocks.length} />
            {blocks.length === 0 ? (
              <EmptyView
                icon={ShieldBan}
                title="Nobody is blocked"
                description="Blocked accounts will appear here."
              />
            ) : (
              blocks.map((block) => {
                const busyKey = `UNBLOCK:${block.blockedUser.username}`;

                return (
                  <RelationshipRow
                    key={block.id}
                    user={block.blockedUser}
                    subtitle="Messages and calls are blocked."
                    busy={actionKey === busyKey}
                    actions={
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          void withAction(busyKey, async () => {
                            await apiClientFetch("/v1/relationships/blocks/unblock", {
                              method: "POST",
                              body: JSON.stringify({ username: block.blockedUser.username }),
                            });
                          })
                        }
                        disabled={actionKey === busyKey}
                        className="h-8 px-2.5"
                      >
                        Unblock
                      </Button>
                    }
                  />
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
