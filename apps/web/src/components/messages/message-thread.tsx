"use client";

import type { DirectConversationDetail } from "@lobby/shared";
import { Button } from "@/components/ui/button";

interface MessageThreadProps {
  viewerId: string;
  conversation: DirectConversationDetail["conversation"];
  isDeleting: string | null;
  onDelete: (messageId: string) => Promise<void>;
}

export function MessageThread({ viewerId, conversation, isDeleting, onDelete }: MessageThreadProps) {
  return (
    <div className="space-y-3">
      {conversation.messages.length === 0 ? (
        <div className="premium-tile rounded-2xl p-5 text-sm text-[var(--text-muted)]">Сообщений пока нет. Начните разговор первым.</div>
      ) : (
        conversation.messages.map((message) => {
          const isOwn = message.author.id === viewerId;
          return (
            <div key={message.id} className={`${isOwn ? "chat-bubble-own" : "chat-bubble"} rounded-3xl p-4`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{message.author.profile.displayName}</p>
                  <p className="font-mono text-xs text-[#afcbf8]">@{message.author.username}</p>
                </div>
                {isOwn ? <Button size="sm" variant="secondary" onClick={() => void onDelete(message.id)} disabled={isDeleting === message.id || message.isDeleted}>{message.isDeleted ? "Удалено" : "Удалить"}</Button> : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--text)]">{message.isDeleted ? "Сообщение удалено" : message.content}</p>
            </div>
          );
        })
      )}
    </div>
  );
}
