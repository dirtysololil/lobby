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

type ThreadMessage =
  DirectConversationDetail["conversation"]["messages"][number];
type ThreadGroup = { label: string; items: ThreadMessage[] };

export function MessageThread({
  viewerId,
  conversation,
  isDeleting,
  onDelete,
}: MessageThreadProps) {
  const groupedMessages = conversation.messages.reduce<ThreadGroup[]>(
    (accumulator: ThreadGroup[], message: ThreadMessage) => {
      const label = new Date(message.createdAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
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
    <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
      {conversation.messages.length === 0 ? (
        <div className="surface-subtle rounded-[16px] p-4 text-sm text-[var(--text-muted)]">
          Сообщений пока нет.
        </div>
      ) : (
        groupedMessages.map((group) => (
          <div key={group.label} className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="thread-rule flex-1" />
              <span className="glass-badge">{group.label}</span>
              <div className="thread-rule flex-1" />
            </div>

            {group.items.map((message) => {
              const isOwn = message.author.id === viewerId;

              return (
                <div
                  key={message.id}
                  className={cn("flex gap-3", isOwn && "flex-row-reverse")}
                >
                  <UserAvatar user={message.author} size="sm" className="mt-0.5 shrink-0" />

                  <div
                    className={cn(
                      "min-w-0 max-w-[min(78ch,100%)] flex-1",
                      isOwn && "text-right",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-1 flex flex-wrap items-center gap-2",
                        isOwn && "justify-end",
                      )}
                    >
                      <p className="text-sm font-semibold text-white">
                        {message.author.profile.displayName}
                      </p>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(message.createdAt).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isOwn ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void onDelete(message.id)}
                          disabled={isDeleting === message.id || message.isDeleted}
                          className="px-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>

                    <div
                      className={cn(
                        isOwn ? "message-bubble-own ml-auto" : "message-bubble",
                        "rounded-[14px] px-3 py-2",
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-5 text-[var(--text)]">
                        {message.isDeleted ? "Сообщение удалено" : message.content}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
