"use client";

import type { DirectConversationDetail } from "@lobby/shared";
import { Button } from "@/components/ui/button";

interface MessageThreadProps {
  viewerId: string;
  conversation: DirectConversationDetail["conversation"];
  isDeleting: string | null;
  onDelete: (messageId: string) => Promise<void>;
}

export function MessageThread({
  viewerId,
  conversation,
  isDeleting,
  onDelete,
}: MessageThreadProps) {
  return (
    <div className="space-y-3">
      {conversation.messages.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
          No messages yet.
        </div>
      ) : (
        conversation.messages.map((message) => {
          const isOwn = message.author.id === viewerId;

          return (
            <div
              key={message.id}
              className="rounded-3xl border border-white/10 bg-slate-950/35 p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    {message.author.profile.displayName}
                  </p>
                  <p className="font-mono text-xs text-sky-200/75">@{message.author.username}</p>
                </div>

                {isOwn ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void onDelete(message.id)}
                    disabled={isDeleting === message.id || message.isDeleted}
                  >
                    {message.isDeleted ? "Deleted" : "Delete"}
                  </Button>
                ) : null}
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                {message.isDeleted ? "Message deleted" : message.content}
              </p>
            </div>
          );
        })
      )}
    </div>
  );
}
