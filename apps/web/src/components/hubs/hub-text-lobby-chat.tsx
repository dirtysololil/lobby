"use client";

import Link from "next/link";
import {
  forumTopicListResponseSchema,
  forumTopicResponseSchema,
  type ForumTopic,
  type HubShell,
} from "@lobby/shared";
import { LoaderCircle, MessageSquare, RefreshCw, SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { buildUserProfileHref } from "@/lib/profile-routes";

interface HubTextLobbyChatProps {
  hub: HubShell["hub"];
  lobby: HubShell["hub"]["lobbies"][number];
  initialTopics: ForumTopic[];
}

function formatMessageDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildMessageTitle(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");

  if (normalized.length >= 3) {
    return normalized.slice(0, 160);
  }

  return "Сообщение";
}

export function HubTextLobbyChat({
  hub,
  lobby,
  initialTopics,
}: HubTextLobbyChatProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const [topics, setTopics] = useState<ForumTopic[]>(initialTopics);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSendMessages = Boolean(hub.membershipRole) && !hub.isViewerMuted;
  const orderedTopics = useMemo(
    () =>
      [...topics].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    [topics],
  );

  useEffect(() => {
    setTopics(initialTopics);
    setDraft("");
    setErrorMessage(null);
    shouldStickToBottomRef.current = true;
  }, [initialTopics, lobby.id]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    list.scrollTo({
      top: list.scrollHeight,
      behavior,
    });
  }, []);

  const loadTopics = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsRefreshing(true);
      }

      try {
        const payload = await apiClientFetch(
          `/v1/forum/hubs/${hub.id}/lobbies/${lobby.id}/topics`,
        );
        setTopics(forumTopicListResponseSchema.parse(payload).items);
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Не удалось загрузить чат канала.",
        );
      } finally {
        if (!options?.silent) {
          setIsRefreshing(false);
        }
      }
    },
    [hub.id, lobby.id],
  );

  useEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    function handleScroll() {
      shouldStickToBottomRef.current =
        list.scrollHeight - list.scrollTop - list.clientHeight < 64;
    }

    handleScroll();
    list.addEventListener("scroll", handleScroll);

    return () => {
      list.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    scrollToBottom("auto");
  }, [scrollToBottom]);

  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      scrollToBottom(topics.length > initialTopics.length ? "smooth" : "auto");
    }
  }, [initialTopics.length, scrollToBottom, topics.length]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadTopics({ silent: true });
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadTopics]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();

    if (!content) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await apiClientFetch(
        `/v1/forum/hubs/${hub.id}/lobbies/${lobby.id}/topics`,
        {
          method: "POST",
          body: JSON.stringify({
            title: buildMessageTitle(content),
            content,
            tags: [],
          }),
        },
      );
      forumTopicResponseSchema.parse(payload);
      setDraft("");
      shouldStickToBottomRef.current = true;
      await loadTopics({ silent: true });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось отправить сообщение.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="premium-panel flex min-h-[420px] flex-col overflow-hidden rounded-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">
              <MessageSquare className="h-3.5 w-3.5" />
              Чат
            </span>
            <span className="status-pill">{orderedTopics.length} сообщений</span>
          </div>
          <p className="mt-2 text-sm text-[var(--text-dim)]">
            Живая лента канала для коротких сообщений участников хаба.
          </p>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => void loadTopics()}
          disabled={isRefreshing || isSubmitting}
        >
          {isRefreshing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Обновить
        </Button>
      </div>

      {errorMessage ? (
        <div className="mx-4 mt-4 rounded-[16px] border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {orderedTopics.length === 0 ? (
          <div className="flex h-full min-h-[220px] items-center justify-center">
            <EmptyState
              title="Сообщений пока нет"
              description="Напишите первое сообщение, и этот канал станет общей лентой хаба."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {orderedTopics.map((topic) => (
              <article
                key={topic.id}
                className="rounded-[20px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3.5"
              >
                <div className="flex items-start gap-3">
                  <Link href={buildUserProfileHref(topic.author.username)}>
                    <UserAvatar user={topic.author} size="sm" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={buildUserProfileHref(topic.author.username)}
                        className="truncate text-sm font-medium text-white transition-colors hover:text-[var(--accent-strong)]"
                      >
                        {topic.author.profile.displayName}
                      </Link>
                      <span className="truncate text-xs text-[var(--text-muted)]">
                        @{topic.author.username}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatMessageDate(topic.createdAt)}
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-soft)]">
                      {topic.content}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-white/5 bg-[rgba(11,16,24,0.72)] px-4 py-4"
      >
        <div className="grid gap-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              canSendMessages
                ? "Напишите сообщение для участников хаба"
                : hub.isViewerMuted
                  ? "Для вас отправка сообщений в этом хабе ограничена"
                  : "Вступите в хаб, чтобы писать в этот канал"
            }
            disabled={!canSendMessages || isSubmitting}
            className="field-textarea min-h-[112px] resize-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-dim)]">
              {canSendMessages
                ? "Короткие сообщения остаются в ленте канала и видны всем участникам."
                : "Читать можно, отправка сейчас недоступна."}
            </p>

            <Button
              type="submit"
              disabled={!canSendMessages || isSubmitting || draft.trim().length === 0}
              className="h-10 px-4"
            >
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
              {isSubmitting ? "Отправляем..." : "Отправить"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
