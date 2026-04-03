"use client";

import Link from "next/link";
import { MessageSquareQuote, Pin, Sparkles, Tags, Waves } from "lucide-react";
import {
  forumTopicListResponseSchema,
  forumTopicResponseSchema,
  hubShellResponseSchema,
  type ForumTopic,
} from "@lobby/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  if (errorMessage)
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  if (!hub)
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[#0b1322]/70 p-4 text-sm text-[var(--text-dim)]">
        Загружаем форум...
      </div>
    );

  const lobby = hub.lobbies.find((item) => item.id === lobbyId);

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <span className="eyebrow-pill">
            <Sparkles className="h-3.5 w-3.5" /> Форумное лобби
          </span>
          <CardTitle>{lobby?.name ?? "Форум"}</CardTitle>
          <CardDescription>
            Темы сортируются по закреплению и последней активности.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="metric-tile rounded-[24px] p-4">
              <p className="section-kicker">Темы</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {topics.length}
              </p>
            </div>
            <div className="metric-tile rounded-[24px] p-4">
              <p className="section-kicker">Закреплённые</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {topics.filter((topic) => topic.pinned).length}
              </p>
            </div>
            <div className="metric-tile rounded-[24px] p-4">
              <p className="section-kicker">Активность</p>
              <p className="mt-2 text-base font-semibold text-white">
                Последние обсуждения наверху
              </p>
            </div>
          </div>

          {hub.membershipRole && !hub.isViewerMuted ? (
            <form
              className="surface-highlight space-y-3 rounded-[28px] p-4"
              onSubmit={handleCreateTopic}
            >
              <p className="text-sm font-medium text-white">Новая тема</p>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Заголовок темы"
              />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Сформулируйте вопрос, контекст или решение"
                className="field-textarea min-h-32"
              />
              <Input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="теги через запятую"
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Публикуем..." : "Опубликовать тему"}
              </Button>
            </form>
          ) : (
            <div className="surface-subtle rounded-[24px] p-4 text-sm text-[var(--text-dim)]">
              {hub.isViewerMuted
                ? "Вы ограничены в этом хабе и не можете писать в форуме."
                : "Вступите в хаб, чтобы создавать темы."}
            </div>
          )}

          <div className="space-y-2.5">
            {topics.length === 0 ? (
              <div className="surface-subtle rounded-[24px] p-4 text-sm text-[var(--text-muted)]">
                Тем пока нет.
              </div>
            ) : (
              topics.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/app/hubs/${hubId}/forum/${lobbyId}/topics/${topic.id}`}
                  className="list-row block rounded-[28px] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-medium text-white">
                          {topic.title}
                        </p>
                        {topic.pinned ? (
                          <span className="glass-badge">
                            <Pin className="h-3 w-3" />
                            закреп
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-dim)] line-clamp-2">
                        {topic.content}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {topic.tags.map((tag) => (
                          <span key={tag.id} className="glass-badge">
                            <Tags className="h-3 w-3" />
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {topic.locked ? (
                        <span className="glass-badge">Закрыта</span>
                      ) : null}
                      {topic.archived ? (
                        <span className="glass-badge">Архив</span>
                      ) : null}
                      <span className="glass-badge">
                        <MessageSquareQuote className="h-3 w-3" />
                        {topic.repliesCount}
                      </span>
                      <span className="status-pill">
                        <Waves className="h-3.5 w-3.5 text-[var(--accent)]" />
                        Открыть тему
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
