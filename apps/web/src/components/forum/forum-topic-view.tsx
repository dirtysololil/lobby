"use client";

import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  Lock,
  MessageSquareQuote,
  Pin,
  Tags,
} from "lucide-react";
import {
  forumReplyResponseSchema,
  forumTopicDetailSchema,
  forumTopicResponseSchema,
  type HubShell,
} from "@lobby/shared";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { HubShellBootstrap } from "@/components/hubs/hub-shell-bootstrap";
import { apiClientFetch } from "@/lib/api-client";
import {
  notificationSettingAllowsSound,
  requestMessageNotificationSound,
} from "@/lib/message-notification-sound";
import { buildUserProfileHref } from "@/lib/profile-routes";

interface ForumTopicViewProps {
  hub: HubShell["hub"];
  hubId: string;
  lobbyId: string;
  topicId: string;
  initialTopic: ReturnType<typeof forumTopicDetailSchema.parse>["topic"];
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ForumTopicView({
  hub,
  hubId,
  lobbyId,
  topicId,
  initialTopic,
}: ForumTopicViewProps) {
  const lobby = hub.lobbies.find((item) => item.id === lobbyId) ?? null;
  const knownReplyIdsRef = useRef(new Set(initialTopic.replies.map((reply) => reply.id)));
  const [topic, setTopic] = useState<
    ReturnType<typeof forumTopicDetailSchema.parse>["topic"] | null
  >(initialTopic);
  const [replyContent, setReplyContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const loadTopic = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const topicPayload = await apiClientFetch(
        `/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics/${topicId}`,
      );
      const nextTopic = forumTopicDetailSchema.parse(topicPayload).topic;
      const previousReplyIds = knownReplyIdsRef.current;
      const hasNewReplies =
        options?.silent &&
        notificationSettingAllowsSound(lobby?.notificationSetting ?? hub.notificationSetting) &&
        nextTopic.replies.some((reply) => !previousReplyIds.has(reply.id));

      setTopic(nextTopic);
      knownReplyIdsRef.current = new Set(nextTopic.replies.map((reply) => reply.id));
      setErrorMessage(null);

      if (hasNewReplies) {
        requestMessageNotificationSound({ source: "forum-topic" });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить тему.",
      );
    }
  }, [hub.notificationSetting, hubId, lobby?.notificationSetting, lobbyId, topicId]);

  useEffect(() => {
    setTopic(initialTopic);
    knownReplyIdsRef.current = new Set(initialTopic.replies.map((reply) => reply.id));
  }, [initialTopic, topicId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadTopic({ silent: true });
    }, 10_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadTopic]);

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
      await loadTopic({ silent: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось отправить ответ.",
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
      await loadTopic({ silent: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось обновить состояние темы.",
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

  if (!topic) {
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
    <div className="h-full min-h-0 overflow-y-auto px-3 py-3">
      <HubShellBootstrap hub={hub} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-3">
          <section className="premium-panel rounded-[24px] px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {topic.pinned ? (
                <span className="eyebrow-pill">
                  <Pin className="h-3.5 w-3.5" />
                  Закреплена
                </span>
              ) : null}
              {topic.locked ? (
                <span className="status-pill">
                  <Lock className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Закрыта
                </span>
              ) : null}
              {topic.archived ? (
                <span className="status-pill">
                  <Archive className="h-3.5 w-3.5 text-[var(--accent)]" />
                  В архиве
                </span>
              ) : null}
            </div>

            <h1 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">
              {topic.title}
            </h1>

            <div className="mt-3 flex items-start gap-3">
              <UserAvatar user={topic.author} size="sm" />
              <div className="min-w-0">
                <Link
                  href={buildUserProfileHref(topic.author.username)}
                  className="identity-link rounded-[12px]"
                >
                  <span className="text-sm font-medium text-white">
                    {topic.author.profile.displayName}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    @{topic.author.username}
                  </span>
                </Link>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Активность {formatDateTime(topic.lastActivityAt)}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-4 text-sm leading-7 text-[var(--text-soft)]">
              {topic.content}
            </div>
          </section>

          <section className="premium-panel rounded-[24px] p-4">
            <div className="compact-toolbar">
              <div>
                <p className="section-kicker">Ответы</p>
                <p className="mt-2 text-sm text-[var(--text-dim)]">
                  {topic.replies.length} ответов в этой теме.
                </p>
              </div>
            </div>

            {canReply ? (
              <form className="mt-4 grid gap-2.5" onSubmit={handleReply}>
                <textarea
                  value={replyContent}
                  onChange={(event) => setReplyContent(event.target.value)}
                  placeholder="Добавьте короткий, полезный ответ"
                  className="field-textarea min-h-[110px]"
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={actionKey === "reply"} className="h-10">
                    {actionKey === "reply" ? "Отправляем..." : "Ответить"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-4 rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-[var(--text-soft)]">
                {hub.isViewerMuted
                  ? "Вы ограничены в этом хабе."
                  : topic.locked || topic.archived
                    ? "Ответы отключены для этой темы."
                    : "Вступите в хаб, чтобы отвечать."}
              </div>
            )}

            <div className="mt-4 grid gap-2">
              {topic.replies.length === 0 ? (
                <EmptyState
                  title="Пока нет ответов"
                  description="Будьте первым, кто добавит полезный контекст к этой теме."
                />
              ) : (
                topic.replies.map((reply) => (
                  <div
                    key={reply.id}
                    className="rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar user={reply.author} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={buildUserProfileHref(reply.author.username)}
                            className="identity-link rounded-[12px]"
                          >
                            <span className="text-sm font-medium text-white">
                              {reply.author.profile.displayName}
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">
                              @{reply.author.username}
                            </span>
                          </Link>
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <MessageSquareQuote className="h-3.5 w-3.5" />
                            {formatDateTime(reply.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--text-soft)]">
                          {reply.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="grid content-start gap-3">
          <section className="premium-panel rounded-[24px] p-4">
            <Link
              href={`/app/hubs/${hubId}/forum/${lobbyId}`}
              className="status-pill transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              К списку тем
            </Link>

            {topic.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {topic.tags.map((tag) => (
                  <span key={tag.id} className="glass-badge">
                    <Tags className="h-3 w-3" />
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {hub.permissions.canModerateForum ? (
            <section className="premium-panel rounded-[24px] p-4">
              <p className="section-kicker">Инструменты модерации</p>
              <div className="mt-3 grid gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void toggleState("pinned", !topic.pinned)}
                  disabled={actionKey === "pinned"}
                  className="h-10 justify-start"
                >
                  {topic.pinned ? "Снять закреп" : "Закрепить"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void toggleState("locked", !topic.locked)}
                  disabled={actionKey === "locked"}
                  className="h-10 justify-start"
                >
                  {topic.locked ? "Открыть тему" : "Закрыть тему"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void toggleState("archived", !topic.archived)}
                  disabled={actionKey === "archived"}
                  className="h-10 justify-start"
                >
                  {topic.archived ? "Разархивировать" : "Отправить в архив"}
                </Button>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
