"use client";

import Link from "next/link";
import { MessageSquareQuote, Pin, Tags, Waves } from "lucide-react";
import {
  forumTopicListResponseSchema,
  forumTopicResponseSchema,
  hubShellResponseSchema,
  type ForumTopic,
} from "@lobby/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";

interface ForumLobbyViewProps {
  hubId: string;
  lobbyId: string;
}

export function ForumLobbyView({ hubId, lobbyId }: ForumLobbyViewProps) {
  const [hub, setHub] = useState<
    ReturnType<typeof hubShellResponseSchema.parse>["hub"] | null
  >(null);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [hubPayload, topicsPayload] = await Promise.all([
        apiClientFetch(`/v1/hubs/${hubId}`),
        apiClientFetch(`/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics`),
      ]);
      setHub(hubShellResponseSchema.parse(hubPayload).hub);
      setTopics(forumTopicListResponseSchema.parse(topicsPayload).items);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить форум",
      );
    }
  }, [hubId, lobbyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось создать тему",
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

  if (!hub) {
    return (
      <div className="rounded-[18px] border border-[var(--border)] bg-white/[0.03] p-4 text-sm text-[var(--text-dim)]">
        Загружаем форум...
      </div>
    );
  }

  const lobby = hub.lobbies.find((item) => item.id === lobbyId);

  return (
    <div className="grid gap-4">
      <div className="social-shell rounded-[24px] p-4">
        <div className="compact-toolbar">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <Waves className="h-3.5 w-3.5" />
                Forum
              </span>
              <span className="status-pill">{topics.length} topics</span>
              <span className="status-pill">
                {topics.filter((topic) => topic.pinned).length} pinned
              </span>
            </div>
            <h1 className="mt-2 font-[var(--font-heading)] text-[1.45rem] font-semibold tracking-[-0.04em] text-white">
              {lobby?.name ?? "Форум"}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Темы отсортированы по закреплению и последней активности.
            </p>
          </div>
        </div>
      </div>

      {hub.membershipRole && !hub.isViewerMuted ? (
        <div className="premium-panel rounded-[24px] p-4">
          <div className="compact-toolbar">
            <div>
              <p className="section-kicker">New topic</p>
              <p className="mt-2 text-sm text-[var(--text-dim)]">
                Короткий заголовок, ясный контекст и теги по необходимости.
              </p>
            </div>
          </div>

          <form className="mt-4 grid gap-3" onSubmit={handleCreateTopic}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Заголовок темы"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Описание темы"
              className="field-textarea"
            />
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="теги через запятую"
            />
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? "Публикуем..." : "Создать тему"}
            </Button>
          </form>
        </div>
      ) : (
        <div className="surface-subtle rounded-[18px] px-4 py-4 text-sm text-[var(--text-dim)]">
          {hub.isViewerMuted
            ? "Вы ограничены в этом хабе и не можете создавать темы."
            : "Вступите в хаб, чтобы создавать темы."}
        </div>
      )}

      <div className="premium-panel rounded-[24px] p-3">
        <div className="compact-toolbar px-1">
          <p className="section-kicker">Topics</p>
          <span className="glass-badge">{topics.length}</span>
        </div>

        <div className="mt-2 grid gap-2">
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
                className="list-row rounded-[18px] px-3 py-3"
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
                          Pinned
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-[var(--text-dim)]">
                      {topic.content}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {topic.tags.map((tag) => (
                        <span key={tag.id} className="glass-badge">
                          <Tags className="h-3 w-3" />
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    {topic.locked ? <span className="glass-badge">Locked</span> : null}
                    {topic.archived ? <span className="glass-badge">Archived</span> : null}
                    <span className="glass-badge">
                      <MessageSquareQuote className="h-3 w-3" />
                      {topic.repliesCount}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
