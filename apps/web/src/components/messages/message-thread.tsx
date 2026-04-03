"use client";

import type { DirectConversationDetail } from "@lobby/shared";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

interface MessageThreadProps {
  viewerId: string;
  conversation: DirectConversationDetail["conversation"];
  isDeleting: string | null;
  onDelete: (messageId: string) => Promise<void>;
}

type ThreadMessage = DirectConversationDetail["conversation"]["messages"][number];
type ThreadGroup = { label: string; items: ThreadMessage[] };

function isContinuation(
  previousMessage: ThreadMessage | undefined,
  currentMessage: ThreadMessage,
) {
  if (!previousMessage) {
    return false;
  }

  if (previousMessage.author.id !== currentMessage.author.id) {
    return false;
  }

  const previousTime = new Date(previousMessage.createdAt).getTime();
  const currentTime = new Date(currentMessage.createdAt).getTime();

  return currentTime - previousTime < 5 * 60 * 1000;
}

export function MessageThread({
  viewerId,
  conversation,
  isDeleting,
  onDelete,
}: MessageThreadProps) {
  const groupedMessages = conversation.messages.reduce<ThreadGroup[]>(
    (accumulator: ThreadGroup[], message: ThreadMessage) => {
      const label = new Date(message.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
      const group = accumulator[accumulator.length - 1];

      if (group && group.label === label) {
        group.items.push(message);
        return accumulator;
      }

      accumulator.push({ label, items: [message] });
      return accumulator;
    },
    [],
  );

  return (
    <div className="min-h-0 overflow-y-auto">
      {conversation.messages.length === 0 ? (
        <div className="empty-state-minimal">
          <p className="text-sm text-[var(--text-muted)]">No messages yet.</p>
        </div>
      ) : (
        <div className="space-y-4 px-3 py-3">
          {groupedMessages.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <div className="flex items-center gap-3 py-1">
                <div className="thread-rule flex-1" />
                <span className="text-[11px] text-[var(--text-muted)]">{group.label}</span>
                <div className="thread-rule flex-1" />
              </div>

              {group.items.map((message, index) => {
                const isOwn = message.author.id === viewerId;
                const previousMessage = group.items[index - 1];
                const continuation = isContinuation(previousMessage, message);

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "group flex gap-2.5",
                      continuation && "mt-[-2px]",
                      isOwn && "flex-row-reverse",
                    )}
                  >
                    <div className="w-8 shrink-0">
                      {continuation ? null : (
                        <UserAvatar
                          user={message.author}
                          size="sm"
                          className={cn(isOwn && "ml-auto")}
                        />
                      )}
                    </div>

                    <div
                      className={cn(
                        "min-w-0 max-w-[min(78ch,100%)] flex-1",
                        isOwn && "text-right",
                      )}
                    >
                      {!continuation ? (
                        <div
                          className={cn(
                            "mb-1 flex items-center gap-2",
                            isOwn && "justify-end",
                          )}
                        >
                          <p className="text-sm font-medium text-white">
                            {message.author.profile.displayName}
                          </p>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {new Date(message.createdAt).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          {isOwn ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void onDelete(message.id)}
                              disabled={isDeleting === message.id || message.isDeleted}
                              className="h-7 w-7 px-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="h-[18px] w-[18px]" />
                            </Button>
                          ) : null}
                        </div>
                      ) : null}

                      <div
                        className={cn(
                          isOwn ? "message-bubble-own ml-auto" : "message-bubble",
                          continuation ? "rounded-[18px] px-3 py-1.5" : "rounded-[18px] px-3 py-2",
                        )}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-5 text-[var(--text)]">
                          {message.isDeleted ? "Message deleted" : message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
