"use client";

import Link from "next/link";
import { Clock3, MessageSquareMore, Search, UserRoundPlus } from "lucide-react";
import {
  directConversationListResponseSchema,
  directConversationSummaryResponseSchema,
  type DirectConversationSummary,
} from "@lobby/shared";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";
import { UserAvatar } from "@/components/ui/user-avatar";

function getUnreadTotal(items: DirectConversationSummary[]) {
  return items.reduce((sum, item) => sum + item.unreadCount, 0);
}

function formatConversationTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return sameDay
    ? date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
}

export function ConversationList() {
  const router = useRouter();
  const [conversations, setConversations] = useState<DirectConversationSummary[]>(
    [],
  );
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    void loadConversations();
  }, []);

  async function loadConversations() {
    setIsLoading(true);
    try {
      const payload = await apiClientFetch("/v1/direct-messages");
      setConversations(directConversationListResponseSchema.parse(payload).items);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load conversations.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenConversation() {
    if (!username.trim()) {
      return;
    }

    setIsOpening(true);

    try {
      const payload = await apiClientFetch("/v1/direct-messages/open", {
        method: "POST",
        body: JSON.stringify({ username: username.trim().toLowerCase() }),
      });

      const conversation =
        directConversationSummaryResponseSchema.parse(payload).conversation;
      router.push(`/app/messages/${conversation.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to open conversation.",
      );
    } finally {
      setIsOpening(false);
    }
  }

  const orderedConversations = useMemo(() => {
    return [...conversations].sort((left, right) => {
      if (left.unreadCount !== right.unreadCount) {
        return right.unreadCount - left.unreadCount;
      }

      return (
        new Date(right.lastMessageAt ?? 0).getTime() -
        new Date(left.lastMessageAt ?? 0).getTime()
      );
    });
  }, [conversations]);

  return (
    <section className="flex min-h-full flex-col">
      <div className="border-b border-[var(--border)] px-3 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <MessageSquareMore className="h-[18px] w-[18px]" />
                Inbox
              </span>
              <span className="status-pill">{conversations.length} chats</span>
              <span className="status-pill">{getUnreadTotal(conversations)} unread</span>
            </div>
            <h2 className="mt-1 text-base font-semibold tracking-[-0.03em] text-white">
              Recent chats
            </h2>
          </div>

          <form
            className="flex w-full max-w-[420px] gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleOpenConversation();
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                className="h-9 pl-9"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="@username"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={isOpening} size="sm">
              <UserRoundPlus className="h-[18px] w-[18px]" />
              {isOpening ? "Opening..." : "New DM"}
            </Button>
          </form>
        </div>
      </div>

      {errorMessage ? (
        <div className="border-b border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-3 py-2 text-xs text-[var(--text-dim)]">
        <div className="flex flex-wrap items-center gap-2">
          <span>{orderedConversations.length} threads</span>
          <span>Sorted by unread</span>
        </div>
        <Link href="/app/people?view=discover" className="glass-badge">
          <UserRoundPlus className="h-[18px] w-[18px]" />
          Find people
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="empty-state-minimal">
            <p className="text-sm text-[var(--text-muted)]">Loading inbox...</p>
          </div>
        ) : orderedConversations.length === 0 ? (
          <div className="empty-state-minimal">
            <MessageSquareMore className="h-5 w-5 text-[var(--text-muted)]" />
            <div>
              <p className="text-base font-semibold text-white">No chats yet</p>
              <p className="mt-1 text-sm text-[var(--text-dim)]">
                Start a DM by username or open someone from People.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {orderedConversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/app/messages/${conversation.id}`}
                className="flex items-start gap-3 border-b border-[var(--border-soft)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-panel-soft)]"
              >
                <UserAvatar user={conversation.counterpart} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {conversation.counterpart.profile.displayName}
                    </p>
                    {conversation.unreadCount > 0 ? (
                      <span className="nav-link-meta">{conversation.unreadCount}</span>
                    ) : null}
                    {conversation.retentionMode !== "OFF" ? (
                      <span className="glass-badge">
                        <Clock3 className="h-[18px] w-[18px]" />
                        {conversation.retentionMode}
                      </span>
                    ) : null}
                    <span className="ml-auto shrink-0 text-xs text-[var(--text-muted)]">
                      {formatConversationTime(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                    @{conversation.counterpart.username}
                  </p>
                  <p className="mt-1 truncate text-sm text-[var(--text-dim)]">
                    {conversation.lastMessage?.isDeleted
                      ? "Last message was deleted"
                      : (conversation.lastMessage?.content ?? "Say hello")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
