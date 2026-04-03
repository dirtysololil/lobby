"use client";

import type { DirectConversationDetail } from "@lobby/shared";
import { Button } from "@/components/ui/button";

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
    <div className="space-y-5">
      {conversation.messages.length === 0 ? (
        <div className="surface-subtle rounded-[26px] p-6 text-sm leading-7 text-[var(--text-muted)]">
          Сообщений пока нет. Здесь появится приватный поток переписки — без
          публичной стены и без лишнего визуального шума.
        </div>
      ) : (
        groupedMessages.map((group) => (
          <div key={group.label} className="space-y-3">
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
                  className={`${isOwn ? "message-bubble-own ml-auto" : "message-bubble"} max-w-[92%] rounded-[28px] p-4 lg:max-w-[78%]`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          {message.author.profile.displayName}
                        </p>
                        <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                          @{message.author.username}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {new Date(message.createdAt).toLocaleTimeString(
                          "ru-RU",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </p>
                    </div>
                    {isOwn ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void onDelete(message.id)}
                        disabled={
                          isDeleting === message.id || message.isDeleted
                        }
                      >
                        {message.isDeleted
                          ? "Удалено"
                          : isDeleting === message.id
                            ? "Удаляем..."
                            : "Удалить"}
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--text)]">
                    {message.isDeleted ? "Сообщение удалено" : message.content}
                  </p>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
