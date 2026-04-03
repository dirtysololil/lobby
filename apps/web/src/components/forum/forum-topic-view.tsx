"use client";

import {
  Archive,
  Lock,
  MessageSquareQuote,
  Pin,
  Sparkles,
  Tags,
} from "lucide-react";
import {
  forumReplyResponseSchema,
  forumTopicDetailSchema,
  forumTopicResponseSchema,
  hubShellResponseSchema,
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
import { apiClientFetch } from "@/lib/api-client";

interface ForumTopicViewProps {
  hubId: string;
  lobbyId: string;
  topicId: string;
}

export function ForumTopicView({
  hubId,
  lobbyId,
  topicId,
}: ForumTopicViewProps) {
  const [hub, setHub] = useState<
    ReturnType<typeof hubShellResponseSchema.parse>["hub"] | null
  >(null);
  const [topic, setTopic] = useState<
    ReturnType<typeof forumTopicDetailSchema.parse>["topic"] | null
  >(null);
  const [replyContent, setReplyContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [hubPayload, topicPayload] = await Promise.all([
        apiClientFetch(`/v1/hubs/${hubId}`),
        apiClientFetch(
          `/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics/${topicId}`,
        ),
      ]);
      setHub(hubShellResponseSchema.parse(hubPayload).hub);
      setTopic(forumTopicDetailSchema.parse(topicPayload).topic);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить тему",
      );
    }
  }, [hubId, lobbyId, topicId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionKey("reply");
    try {
      const payload = await apiClientFetch(
        `/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics/${topicId}/replies`,
        { method: "POST", body: JSON.stringify({ content: replyContent }) },
      );
      forumReplyResponseSchema.parse(payload);
      setReplyContent("");
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось отправить ответ",
      );
    } finally {
      setActionKey(null);
    }
  }

  async function toggleState(
    key: "pinned" | "locked" | "archived",
    value: boolean,
  ) {
    setActionKey(key);
    try {
      const payload = await apiClientFetch(
        `/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics/${topicId}/state`,
        { method: "PATCH", body: JSON.stringify({ [key]: value }) },
      );
      forumTopicResponseSchema.parse(payload);
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось обновить состояние темы",
      );
    } finally {
      setActionKey(null);
    }
  }

  if (errorMessage)
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  if (!hub || !topic)
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-slate-950/40 p-4 text-sm text-slate-400">
        Загружаем тему...
      </div>
    );

  const canReply =
    Boolean(hub.membershipRole) &&
    !hub.isViewerMuted &&
    !topic.locked &&
    !topic.archived;

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <span className="eyebrow-pill">
            <Sparkles className="h-3.5 w-3.5" /> Тема обсуждения
          </span>
          <CardTitle>{topic.title}</CardTitle>
          <CardDescription>
            Автор: {topic.author.profile.displayName} · активность:{" "}
            {new Date(topic.lastActivityAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {topic.pinned ? (
              <span className="glass-badge">
                <Pin className="h-3 w-3" />
                Закреп
              </span>
            ) : null}
            {topic.locked ? (
              <span className="glass-badge">
                <Lock className="h-3 w-3" />
                Закрыта
              </span>
            ) : null}
            {topic.archived ? (
              <span className="glass-badge">
                <Archive className="h-3 w-3" />
                Архив
              </span>
            ) : null}
            {topic.tags.map((tag) => (
              <span key={tag.id} className="glass-badge">
                <Tags className="h-3 w-3" />
                {tag.name}
              </span>
            ))}
          </div>

          <div className="surface-highlight rounded-[26px] p-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">
            {topic.content}
          </div>

          {hub.permissions.canModerateForum ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void toggleState("pinned", !topic.pinned)}
                disabled={actionKey === "pinned"}
              >
                {topic.pinned ? "Снять закреп" : "Закрепить"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void toggleState("locked", !topic.locked)}
                disabled={actionKey === "locked"}
              >
                {topic.locked ? "Открыть" : "Закрыть"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void toggleState("archived", !topic.archived)}
                disabled={actionKey === "archived"}
              >
                {topic.archived ? "Разархивировать" : "В архив"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ответы</CardTitle>
          <CardDescription>
            Ответы отключаются, если тема закрыта или архивирована.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canReply ? (
            <form
              className="surface-subtle space-y-3 rounded-[26px] p-4"
              onSubmit={handleReply}
            >
              <textarea
                value={replyContent}
                onChange={(event) => setReplyContent(event.target.value)}
                placeholder="Ваш ответ"
                className="field-textarea min-h-24"
              />
              <Button type="submit" disabled={actionKey === "reply"}>
                {actionKey === "reply" ? "Отправляем..." : "Ответить"}
              </Button>
            </form>
          ) : (
            <div className="surface-subtle rounded-[24px] p-4 text-sm text-slate-400">
              {hub.isViewerMuted
                ? "Вы ограничены в этом хабе."
                : topic.locked || topic.archived
                  ? "Ответы отключены для этой темы."
                  : "Вступите в хаб, чтобы отвечать."}
            </div>
          )}

          {topic.replies.length === 0 ? (
            <div className="surface-subtle rounded-[24px] p-4 text-sm text-slate-500">
              Ответов пока нет.
            </div>
          ) : (
            topic.replies.map((reply) => (
              <div key={reply.id} className="list-row rounded-[24px] p-4">
                <p className="text-sm font-medium text-white">
                  {reply.author.profile.displayName}
                </p>
                <p className="font-mono text-xs text-[var(--text-soft)]">
                  @{reply.author.username}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  <MessageSquareQuote className="mr-1 inline h-3.5 w-3.5" />
                  {new Date(reply.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                  {reply.content}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
