"use client";

import type { DirectConversationDetail } from "@lobby/shared";
import { AlertCircle, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

export type ThreadMessageItem =
  DirectConversationDetail["conversation"]["messages"][number] & {
    localState?: "sending" | "failed";
  };

interface MessageThreadProps {
  viewerId: string;
  messages: ThreadMessageItem[];
  isDeleting: string | null;
  lastReadAt: string | null;
  onDelete: (messageId: string) => Promise<void>;
  onRetry: (messageId: string) => Promise<void>;
}

type ThreadGroup = { label: string; items: ThreadMessageItem[] };

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

function isContinuation(
  previousMessage: ThreadMessageItem | undefined,
  currentMessage: ThreadMessageItem,
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

function formatThreadDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    month: "long",
    day: "numeric",
  });
}

function formatThreadTime(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageThread({
  viewerId,
  messages,
  isDeleting,
  lastReadAt,
  onDelete,
  onRetry,
}: MessageThreadProps) {
  const groupedMessages = messages.reduce<ThreadGroup[]>(
    (accumulator: ThreadGroup[], message: ThreadMessageItem) => {
      const label = formatThreadDate(message.createdAt);
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

  const unreadIndex =
    lastReadAt == null
      ? -1
      : messages.findIndex(
          (message) =>
            message.author.id !== viewerId &&
            new Date(message.createdAt).getTime() > new Date(lastReadAt).getTime(),
        );
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const didInitScrollRef = useRef(false);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    if (!didInitScrollRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
      didInitScrollRef.current = true;
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    if (distanceFromBottom < 160) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={viewportRef}
      className="min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.05),transparent_18%),transparent]"
    >
      {messages.length === 0 ? (
        <div className="empty-state-minimal text-[var(--text-muted)]">
          <p className="text-sm">Сообщений пока нет.</p>
          <p className="text-xs text-[var(--text-dim)]">
            Переписка появится здесь, как только кто-то напишет.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 px-3 py-2.5">
          {groupedMessages.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="flex items-center gap-3 py-0.5">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-white/5" />
              </div>

              {group.items.map((message, index) => {
                const globalIndex = messages.findIndex((item) => item.id === message.id);
                const isOwn = message.author.id === viewerId;
                const previousMessage = group.items[index - 1];
                const continuation = isContinuation(previousMessage, message);
                const isUnreadMarker = unreadIndex >= 0 && globalIndex === unreadIndex;

                return (
                  <div key={message.id}>
                    {isUnreadMarker ? (
                      <div className="mb-2 flex items-center gap-3 py-0.5">
                        <div className="h-px flex-1 bg-[color:var(--accent)]/35" />
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--accent)]">
                          Новое
                        </span>
                        <div className="h-px flex-1 bg-[color:var(--accent)]/35" />
                      </div>
                    ) : null}

                    <div
                      className={cn(
                        "group flex gap-2 py-0.5",
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
                          "min-w-0 max-w-[min(76ch,100%)] flex-1",
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
                            <p className="text-sm font-medium tracking-tight text-white">
                              {message.author.profile.displayName}
                            </p>
                            <span className="text-[11px] text-[var(--text-muted)]">
                              {formatThreadTime(message.createdAt)}
                            </span>
                            {message.localState === "sending" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-white/6 bg-white/[0.03] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                                Отправляем
                              </span>
                            ) : null}
                            {message.localState === "failed" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-300">
                                <AlertCircle size={14} strokeWidth={1.5} />
                                Ошибка
                              </span>
                            ) : null}
                            {isOwn && message.canDelete ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void onDelete(message.id)}
                                disabled={isDeleting === message.id}
                                className="h-7 w-7 rounded-full px-0 text-[var(--text-muted)] opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 {...iconProps} />
                              </Button>
                            ) : null}
                          </div>
                        ) : null}

                        <div
                          className={cn(
                            "rounded-[16px] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_10px_18px_rgba(5,10,18,0.08)]",
                            isOwn ? "message-bubble-own ml-auto" : "message-bubble",
                            continuation && "rounded-[14px] py-1.5",
                            message.localState === "failed" &&
                              "border-amber-400/30 bg-amber-400/10",
                          )}
                        >
                          <p className="whitespace-pre-wrap text-[13px] leading-[1.32] text-white">
                            {message.content}
                          </p>
                        </div>

                        {message.localState === "failed" ? (
                          <div
                            className={cn(
                              "mt-1 flex items-center gap-2 text-[11px]",
                              isOwn ? "justify-end" : "justify-start",
                            )}
                          >
                            <span className="text-[var(--text-muted)]">
                              Не доставлено
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void onRetry(message.id)}
                              className="h-7 gap-1 rounded-full px-2 text-[var(--text-soft)]"
                            >
                              <RotateCcw size={14} strokeWidth={1.5} />
                              Повторить
                            </Button>
                          </div>
                        ) : null}
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
