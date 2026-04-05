"use client";

import Link from "next/link";
import { Archive, ArrowLeft, Lock, MessageSquareQuote, Pin, Tags } from "lucide-react";
import {
  forumReplyResponseSchema,
  forumTopicDetailSchema,
  forumTopicResponseSchema,
  type HubShell,
} from "@lobby/shared";
import { useCallback, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { HubShellBootstrap } from "@/components/hubs/hub-shell-bootstrap";
import { apiClientFetch } from "@/lib/api-client";
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
  const [topic, setTopic] = useState<
    ReturnType<typeof forumTopicDetailSchema.parse>["topic"] | null
  >(initialTopic);
  const [replyContent, setReplyContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const loadTopic = useCallback(async () => {
    try {
      const topicPayload = await apiClientFetch(
        `/v1/forum/hubs/${hubId}/lobbies/${lobbyId}/topics/${topicId}`,
      );
      setTopic(forumTopicDetailSchema.parse(topicPayload).topic);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ С‚РµРјСѓ",
      );
    }
  }, [hubId, lobbyId, topicId]);

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
      await loadTopic();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РѕС‚РІРµС‚",
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
      await loadTopic();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "РќРµ СѓРґР°Р»РѕСЃСЊ РѕР±РЅРѕРІРёС‚СЊ СЃРѕСЃС‚РѕСЏРЅРёРµ С‚РµРјС‹",
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
        Р—Р°РіСЂСѓР¶Р°РµРј С‚РµРјСѓ...
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
      <div className="mx-auto grid max-w-[1040px] gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3">
          <section className="social-shell rounded-[24px] p-4 sm:p-5">
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

            <h1 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-white">
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
                  РђРєС‚РёРІРЅРѕСЃС‚СЊ {formatDateTime(topic.lastActivityAt)}
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
                <p className="section-kicker">Replies</p>
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
                    {actionKey === "reply" ? "РћС‚РїСЂР°РІР»СЏРµРј..." : "РћС‚РІРµС‚РёС‚СЊ"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-4 rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-[var(--text-soft)]">
                {hub.isViewerMuted
                  ? "Р’С‹ РѕРіСЂР°РЅРёС‡РµРЅС‹ РІ СЌС‚РѕРј С…Р°Р±Рµ."
                  : topic.locked || topic.archived
                    ? "РћС‚РІРµС‚С‹ РѕС‚РєР»СЋС‡РµРЅС‹ РґР»СЏ СЌС‚РѕР№ С‚РµРјС‹."
                    : "Р’СЃС‚СѓРїРёС‚Рµ РІ С…Р°Р±, С‡С‚РѕР±С‹ РѕС‚РІРµС‡Р°С‚СЊ."}
              </div>
            )}

            <div className="mt-4 grid gap-2">
              {topic.replies.length === 0 ? (
                <EmptyState
                  title="РџРѕРєР° РЅРµС‚ РѕС‚РІРµС‚РѕРІ"
                  description="Р‘СѓРґСЊС‚Рµ РїРµСЂРІС‹Рј, РєС‚Рѕ РґРѕР±Р°РІРёС‚ РїРѕР»РµР·РЅС‹Р№ РєРѕРЅС‚РµРєСЃС‚ Рє СЌС‚РѕР№ С‚РµРјРµ."
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

        <aside className="grid gap-3">
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
              <p className="section-kicker">Moderator tools</p>
              <div className="mt-3 grid gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void toggleState("pinned", !topic.pinned)}
                  disabled={actionKey === "pinned"}
                  className="h-10 justify-start"
                >
                  {topic.pinned ? "РЎРЅСЏС‚СЊ Р·Р°РєСЂРµРї" : "Р—Р°РєСЂРµРїРёС‚СЊ"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void toggleState("locked", !topic.locked)}
                  disabled={actionKey === "locked"}
                  className="h-10 justify-start"
                >
                  {topic.locked ? "РћС‚РєСЂС‹С‚СЊ С‚РµРјСѓ" : "Р—Р°РєСЂС‹С‚СЊ С‚РµРјСѓ"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void toggleState("archived", !topic.archived)}
                  disabled={actionKey === "archived"}
                  className="h-10 justify-start"
                >
                  {topic.archived ? "Р Р°Р·Р°СЂС…РёРІРёСЂРѕРІР°С‚СЊ" : "РћС‚РїСЂР°РІРёС‚СЊ РІ Р°СЂС…РёРІ"}
                </Button>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
