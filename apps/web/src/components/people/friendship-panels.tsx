"use client";

import type { BlockRecord, FriendshipRecord } from "@lobby/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FriendshipPanelsProps {
  friendships: FriendshipRecord[];
  blocks: BlockRecord[];
  actionKey: string | null;
  onAccept: (username: string) => Promise<void>;
  onRemove: (username: string) => Promise<void>;
  onBlock: (username: string) => Promise<void>;
  onUnblock: (username: string) => Promise<void>;
  onOpenDm: (username: string) => Promise<void>;
}

const friendshipSections = [
  { title: "Incoming requests", state: "INCOMING_REQUEST" },
  { title: "Outgoing requests", state: "OUTGOING_REQUEST" },
  { title: "Accepted", state: "ACCEPTED" },
  { title: "Removed", state: "REMOVED" },
] as const;

export function FriendshipPanels({
  friendships,
  blocks,
  actionKey,
  onAccept,
  onRemove,
  onBlock,
  onUnblock,
  onOpenDm,
}: FriendshipPanelsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.66fr_0.34fr]">
      <Card>
        <CardHeader>
          <CardTitle>Friendships</CardTitle>
          <CardDescription>Incoming, outgoing, accepted and removed states stay private.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {friendshipSections.map((section) => {
            const items = friendships.filter((friendship) => friendship.state === section.state);

            return (
              <div key={section.title} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-white">{section.title}</p>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="text-sm text-slate-500">Nothing here yet.</p>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => {
                      const isBusyForUser = actionKey?.endsWith(`:${item.otherUser.username}`) ?? false;

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium text-white">{item.otherUser.profile.displayName}</p>
                            <p className="font-mono text-xs text-sky-200/75">@{item.otherUser.username}</p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {item.state === "INCOMING_REQUEST" ? (
                              <Button
                                size="sm"
                                onClick={() => void onAccept(item.otherUser.username)}
                                disabled={isBusyForUser}
                              >
                                Accept
                              </Button>
                            ) : null}

                            {item.state === "ACCEPTED" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void onOpenDm(item.otherUser.username)}
                                disabled={isBusyForUser}
                              >
                                Open DM
                              </Button>
                            ) : null}

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void onRemove(item.otherUser.username)}
                              disabled={isBusyForUser}
                            >
                              Remove
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void onBlock(item.otherUser.username)}
                              disabled={isBusyForUser}
                            >
                              Block
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blocks</CardTitle>
          <CardDescription>Blocked users cannot receive DM, calls or invite-related interactions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {blocks.length === 0 ? (
            <p className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
              No blocked users.
            </p>
          ) : (
            blocks.map((block) => (
              <div
                key={block.id}
                className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-950/35 p-5"
              >
                <div>
                  <p className="text-sm font-medium text-white">{block.blockedUser.profile.displayName}</p>
                  <p className="font-mono text-xs text-sky-200/75">@{block.blockedUser.username}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void onUnblock(block.blockedUser.username)}
                  disabled={actionKey === `UNBLOCK:${block.blockedUser.username}`}
                >
                  Unblock
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
