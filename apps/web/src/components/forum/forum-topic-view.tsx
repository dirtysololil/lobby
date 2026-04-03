"use client";

import { Archive, Lock, MessageSquareQuote, Pin, Tags } from "lucide-react";
import {
  forumReplyResponseSchema,
  forumTopicDetailSchema,
  forumTopicResponseSchema,
  hubShellResponseSchema,
} from "@lobby/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
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

  if (errorMessage) {
    return (
      <div className="rounded-[16px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  }

  if (!hub || !topic) {
    return (
      <div className="rounded-[18px] border border-[var(--border)] bg-white/[0.03] p-4 text-sm text-[var(--text-dim)]">
        Загружаем тему...
      </div>
    );
  }

  const canReply =
    Boolean(hub.membershipRole) &&
    !hub.isViewerMuted &&
    !topic.locked &&
    !topic.archived;

  return (
    <div className="grid gap-3">
      <div className="social-shell rounded-[20px] p-3">
        <div className="compact-toolbar">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {topic.pinned ? (
                <span className="eyebrow-pill">
                  <Pin className="h-3.5 w-3.5" />
                  Pinned
                </span>
              ) : null}
              {topic.locked ? (
                <span className="status-pill">
                  <Lock className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Locked
                </span>
              ) : null}
              {topic.archived ? (
                <span className="status-pill">
                  <Archive className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Archived
                </span>
              ) : null}
            </div>
            <h1 className="mt-1.5 font-[var(--font-heading)] text-[1.15rem] font-semibold tracking-[-0.04em] text-white">
              {topic.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Автор: {topic.author.profile.displayName} · активность{" "}
              {new Date(topic.lastActivityAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="premium-panel rounded-[20px] p-3.5">
        <div className="flex flex-wrap gap-2">
          {topic.tags.map((tag) => (
            <span key={tag.id} className="glass-badge">
              <Tags className="h-3 w-3" />
              {tag.name}
            </span>
          ))}
        </div>

        <div className="mt-3 whitespace-pre-wrap rounded-[16px] border border-[var(--border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--text-soft)]">
          {topic.content}
        </div>

        {hub.permissions.canModerateForum ? (
          <div className="mt-3 flex flex-wrap gap-2">
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
      </div>

      <div className="premium-panel rounded-[20px] p-3.5">
        <div className="compact-toolbar">
          <div>
            <p className="section-kicker">Replies</p>
            <p className="mt-1.5 text-sm text-[var(--text-dim)]">
              {topic.replies.length} ответов в этой теме.
            </p>
          </div>
        </div>

        {canReply ? (
          <form className="mt-3 grid gap-2.5" onSubmit={handleReply}>
            <textarea
              value={replyContent}
              onChange={(event) => setReplyContent(event.target.value)}
              placeholder="Ваш ответ"
              className="field-textarea"
            />
            <Button type="submit" disabled={actionKey === "reply"} className="w-full sm:w-auto">
              {actionKey === "reply" ? "Отправляем..." : "Ответить"}
            </Button>
          </form>
        ) : (
          <div className="mt-3 surface-subtle rounded-[16px] px-3 py-3 text-sm text-[var(--text-dim)]">
            {hub.isViewerMuted
              ? "Вы ограничены в этом хабе."
              : topic.locked || topic.archived
                ? "Ответы отключены для этой темы."
                : "Вступите в хаб, чтобы отвечать."}
          </div>
        )}

        <div className="mt-3 grid gap-2">
          {topic.replies.length === 0 ? (
            <EmptyState
              title="Пока нет ответов"
              description="Будьте первым, кто добавит полезный контекст к этой теме."
            />
          ) : (
            topic.replies.map((reply) => (
              <div key={reply.id} className="list-row rounded-[16px] px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <UserAvatar user={reply.author} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">
                        {reply.author.profile.displayName}
                      </p>
                      <span className="text-xs text-[var(--text-muted)]">
                        <MessageSquareQuote className="mr-1 inline h-3.5 w-3.5" />
                        {new Date(reply.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-soft)]">
                      {reply.content}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
