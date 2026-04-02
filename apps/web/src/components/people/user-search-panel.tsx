"use client";

import Link from "next/link";
import type { UserSearchResult } from "@lobby/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface UserSearchPanelProps {
  query: string;
  results: UserSearchResult[];
  searchError: string | null;
  isSearching: boolean;
  actionKey: string | null;
  onQueryChange: (value: string) => void;
  onSearch: () => Promise<void>;
  onSendFriendRequest: (username: string) => Promise<void>;
  onAcceptFriendRequest: (username: string) => Promise<void>;
  onRemoveFriendship: (username: string) => Promise<void>;
  onBlock: (username: string) => Promise<void>;
  onUnblock: (username: string) => Promise<void>;
  onOpenDm: (username: string) => Promise<void>;
}

export function UserSearchPanel({
  query,
  results,
  searchError,
  isSearching,
  actionKey,
  onQueryChange,
  onSearch,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onRemoveFriendship,
  onBlock,
  onUnblock,
  onOpenDm,
}: UserSearchPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User search</CardTitle>
        <CardDescription>Exact and prefix search by username only. No public people catalog.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void onSearch();
          }}
        >
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by username"
            autoComplete="off"
          />
          <Button type="submit" disabled={isSearching}>
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </form>

        {searchError ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {searchError}
          </div>
        ) : null}

        {results.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
            Search results will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((item) => {
              const busyKey = `SEARCH:${item.user.username}`;

              return (
                <div
                  key={item.user.id}
                  className="rounded-3xl border border-white/10 bg-slate-950/35 p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-base font-medium text-white">{item.user.profile.displayName}</p>
                      <p className="font-mono text-xs text-sky-200/75">@{item.user.username}</p>
                      <p className="text-sm leading-6 text-slate-400">
                        {item.user.profile.bio ?? "Profile bio is not set."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.relationship.isBlockedByViewer ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void onUnblock(item.user.username)}
                          disabled={actionKey === busyKey}
                        >
                          Unblock
                        </Button>
                      ) : (
                        <>
                          {item.relationship.friendshipState === "NONE" ||
                          item.relationship.friendshipState === "REMOVED" ? (
                            <Button
                              size="sm"
                              onClick={() => void onSendFriendRequest(item.user.username)}
                              disabled={actionKey === busyKey || item.relationship.hasBlockedViewer}
                            >
                              Add friend
                            </Button>
                          ) : null}

                          {item.relationship.friendshipState === "INCOMING_REQUEST" ? (
                            <Button
                              size="sm"
                              onClick={() => void onAcceptFriendRequest(item.user.username)}
                              disabled={actionKey === busyKey}
                            >
                              Accept
                            </Button>
                          ) : null}

                          {item.relationship.friendshipState === "OUTGOING_REQUEST" ||
                          item.relationship.friendshipState === "ACCEPTED" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void onRemoveFriendship(item.user.username)}
                              disabled={actionKey === busyKey}
                            >
                              Remove
                            </Button>
                          ) : null}

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void onOpenDm(item.user.username)}
                            disabled={actionKey === busyKey || item.relationship.hasBlockedViewer}
                          >
                            {item.relationship.dmConversationId ? "Open DM" : "Start DM"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void onBlock(item.user.username)}
                            disabled={actionKey === busyKey}
                          >
                            Block
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {item.relationship.dmConversationId ? (
                    <div className="mt-4 border-t border-white/10 pt-4 text-sm text-slate-400">
                      Existing DM:{" "}
                      <Link
                        href={`/app/messages/${item.relationship.dmConversationId}`}
                        className="text-sky-300 transition hover:text-sky-200"
                      >
                        open thread
                      </Link>
                    </div>
                  ) : null}

                  {item.relationship.hasBlockedViewer ? (
                    <p className="mt-4 text-sm text-rose-200/80">
                      This user blocked you. Direct interaction is disabled.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
