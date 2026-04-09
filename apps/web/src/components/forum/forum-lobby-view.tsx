"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  MessageSquareQuote,
  Pin,
  Tags,
} from "lucide-react";
import {
  forumTopicListResponseSchema,
  forumTopicResponseSchema,
  type ForumTopic,
  type HubShell,
} from "@lobby/shared";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { HubShellBootstrap } from "@/components/hubs/hub-shell-bootstrap";
import { apiClientFetch } from "@/lib/api-client";
import {
  notificationSettingAllowsSound,
  requestMessageNotificationSound,
} from "@/lib/message-notification-sound";

interface ForumLobbyViewProps {
  hub: HubShell["hub"];
  hubId: string;
  lobbyId: string;
  initialTopics: ForumTopic[];
}

function formatTopicDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ForumLobbyView({
  hub,
  hubId,
  lobbyId,
  initialTopics,
}: ForumLobbyViewProps) {
  const lobby = hub.lobbies.find((item) => item.id === lobbyId) ?? null;
  const knownTopicIdsRef = useRef(new Set(initialTopics.map((topic) => topic.id)));
  const [topics, setTopics] = useState<ForumTopic[]>(initialTopics);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTopics = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const topicsPayload = await apiClientFetch(
        `/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics`,
      );
      const nextTopics = forumTopicListResponseSchema.parse(topicsPayload).items;
      const previousTopicIds = knownTopicIdsRef.current;
      const hasNewTopics =
        options?.silent &&
        notificationSettingAllowsSound(lobby?.notificationSetting ?? hub.notificationSetting) &&
        nextTopics.some((topic) => !previousTopicIds.has(topic.id));

      setTopics(nextTopics);
      knownTopicIdsRef.current = new Set(nextTopics.map((topic) => topic.id));
      setErrorMessage(null);

      if (hasNewTopics) {
        requestMessageNotificationSound({ source: "forum-lobby" });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить форум.",
      );
    }
  }, [hub.notificationSetting, hubId, lobby?.notificationSetting, lobbyId]);

  useEffect(() => {
    setTopics(initialTopics);
    knownTopicIdsRef.current = new Set(initialTopics.map((topic) => topic.id));
  }, [initialTopics, lobbyId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadTopics({ silent: true });
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadTopics]);

  async function handleCreateTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = await apiClientFetch(
        `/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics`,
        {
          method: "POST",
          body: JSON.stringify({
            title,
            content,
            tags: tags
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          }),
        },
      );
      forumTopicResponseSchema.parse(payload);
      setTitle("");
      setContent("");
      setTags("");
      await loadTopics({ silent: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось создать тему.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (errorMessage) {
    return (
      <div className="rounded-[16px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  }

  const canCreateTopic = Boolean(hub.membershipRole) && !hub.isViewerMuted;
  const pinnedCount = topics.filter((topic) => topic.pinned).length;

  return (
    <div className="h-full min-h-0 overflow-y-auto px-3 py-3">
      <HubShellBootstrap hub={hub} />

      <div className="grid gap-3">
        <section className="premium-panel rounded-[24px] px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">
              <MessageSquareQuote className="h-3.5 w-3.5" />
              Форум
            </span>
            <span className="status-pill">{topics.length} тем</span>
            <span className="status-pill">{pinnedCount} закреплены</span>
          </div>
          <h1 className="mt-2 truncate text-lg font-semibold tracking-tight text-white">
            {lobby?.name ?? "Форум"}
          </h1>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--text-dim)]">
            {lobby?.description?.trim() ||
              "Темы, ответы и теги для длинных обсуждений без лишнего шума в ленте хаба."}
          </p>
        </section>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="premium-panel rounded-[24px] p-4">
            <div className="compact-toolbar">
              <div>
                <p className="section-kicker">Темы</p>
                <p className="mt-2 text-sm text-[var(--text-dim)]">
                  Основная колонка форума: активность, статусы и быстрый вход в нужную тему.
                </p>
              </div>
              <span className="glass-badge">{topics.length}</span>
            </div>

            <div className="mt-4 grid gap-2">
              {topics.length === 0 ? (
                <EmptyState
                  title="Тем пока нет"
                  description="Создайте первую тему или дождитесь новой активности в этом форуме."
                />
              ) : (
                topics.map((topic) => (
                  <Link
                    key={topic.id}
                    href={`/app/hubs/${hubId}/forum/${lobbyId}/topics/${topic.id}`}
                    className="rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3 transition-colors hover:border-[var(--border)] hover:bg-white/[0.05]"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">
                            {topic.title}
                          </p>
                          {topic.pinned ? (
                            <span className="glass-badge">
                              <Pin className="h-3 w-3" />
                              Закреплена
                            </span>
                          ) : null}
                          {topic.locked ? (
                            <span className="glass-badge">Закрыта</span>
                          ) : null}
                          {topic.archived ? (
                            <span className="glass-badge">В архиве</span>
                          ) : null}
                        </div>

                        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[var(--text-soft)]">
                          {topic.content}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                          <span>{topic.author.profile.displayName}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatTopicDate(topic.lastActivityAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquareQuote className="h-3.5 w-3.5" />
                            {topic.repliesCount} ответов
                          </span>
                        </div>

                        {topic.tags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {topic.tags.map((tag) => (
                              <span key={tag.id} className="glass-badge">
                                <Tags className="h-3 w-3" />
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          <aside className="grid content-start gap-3">
            <section className="premium-panel rounded-[24px] p-4">
              <p className="section-kicker">Новая тема</p>
              {canCreateTopic ? (
                <form className="mt-3 grid gap-2.5" onSubmit={handleCreateTopic}>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Заголовок темы"
                  />
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Коротко опишите контекст, вопрос или решение"
                    className="field-textarea min-h-[120px]"
                  />
                  <Input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="Теги через запятую"
                  />
                  <Button type="submit" disabled={isSubmitting} className="h-10 w-full">
                    {isSubmitting ? "Публикуем..." : "Опубликовать тему"}
                  </Button>
                </form>
              ) : (
                <div className="mt-3 rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-[var(--text-soft)]">
                  {hub.isViewerMuted
                    ? "Вы ограничены в этом хабе и не можете создавать темы."
                    : "Вступите в хаб, чтобы создавать темы и участвовать в обсуждении."}
                </div>
              )}
            </section>

            <section className="premium-panel rounded-[24px] p-4">
              <Link
                href={`/app/hubs/${hubId}`}
                className="status-pill transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                К обзору хаба
              </Link>

              <div className="mt-4 grid gap-2">
                <div className="surface-subtle rounded-[16px] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Текущая лента
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {topics.length} тем
                  </p>
                </div>
                <div className="surface-subtle rounded-[16px] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Закреплено
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {pinnedCount}
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
