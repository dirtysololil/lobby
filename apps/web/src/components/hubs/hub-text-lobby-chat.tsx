"use client";

import Link from "next/link";
import {
  forumTopicListResponseSchema,
  forumTopicResponseSchema,
  type ForumTopic,
  type HubShell,
  type ReactionEmoji,
} from "@lobby/shared";
import {
  Image,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  SendHorizontal,
  Smile,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import {
  notificationSettingAllowsSound,
  requestMessageNotificationSound,
} from "@/lib/message-notification-sound";
import { buildUserProfileHref } from "@/lib/profile-routes";
import { HubMemberRoleBadge } from "./hub-member-role-badge";

interface HubTextLobbyChatProps {
  hub: HubShell["hub"];
  lobby: HubShell["hub"]["lobbies"][number];
  initialTopics: ForumTopic[];
}

const textReactionOptions: ReactionEmoji[] = ["❤️", "🔥", "✨", "👀"];

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

function extractFirstUrl(content: string) {
  return content.match(/https?:\/\/\S+/i)?.[0] ?? null;
}

function resolveChannelMedia(url: string | null) {
  if (!url) {
    return null;
  }

  const cleanUrl = url.replace(/[),.]+$/, "");
  const normalized = cleanUrl.split("?")[0]?.toLowerCase() ?? "";

  if (/youtube\.com|youtu\.be/.test(cleanUrl)) {
    return { kind: "youtube" as const, url: cleanUrl };
  }

  if (/\.(mp4|webm|mov|m4v)$/i.test(normalized)) {
    return { kind: "video" as const, url: cleanUrl };
  }

  if (/\.(png|jpe?g|webp|gif|avif)$/i.test(normalized)) {
    return { kind: "image" as const, url: cleanUrl };
  }

  return null;
}

function getYouTubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const videoId =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : url.searchParams.get("v") ??
          url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1] ??
          null;

    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

export function HubTextLobbyChat({
  hub,
  lobby,
  initialTopics,
}: HubTextLobbyChatProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const knownTopicIdsRef = useRef(new Set(initialTopics.map((topic) => topic.id)));
  const [topics, setTopics] = useState<ForumTopic[]>(initialTopics);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reactingTopicKey, setReactingTopicKey] = useState<{
    topicId: string;
    reaction: ReactionEmoji;
  } | null>(null);
  const canSendMessages = Boolean(hub.membershipRole) && !hub.isViewerMuted;
  const memberRolesByUserId = useMemo(
    () => new Map(hub.members.map((member) => [member.user.id, member.role])),
    [hub.members],
  );
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
    setReactingTopicKey(null);
    shouldStickToBottomRef.current = true;
    knownTopicIdsRef.current = new Set(initialTopics.map((topic) => topic.id));
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
        const nextTopics = forumTopicListResponseSchema.parse(payload).items;
        const previousTopicIds = knownTopicIdsRef.current;
        const hasNewTopics =
          options?.silent &&
          notificationSettingAllowsSound(lobby.notificationSetting) &&
          nextTopics.some((topic) => !previousTopicIds.has(topic.id));

        setTopics(nextTopics);
        knownTopicIdsRef.current = new Set(nextTopics.map((topic) => topic.id));
        setErrorMessage(null);

        if (hasNewTopics) {
          requestMessageNotificationSound({ source: "hub-text" });
        }
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
    [hub.id, lobby.id, lobby.notificationSetting],
  );

  useEffect(() => {
    const list = listRef.current;

    if (!list) {
      return;
    }

    const activeList = list;

    function handleScroll() {
      shouldStickToBottomRef.current =
        activeList.scrollHeight - activeList.scrollTop - activeList.clientHeight < 64;
    }

    handleScroll();
    activeList.addEventListener("scroll", handleScroll);

    return () => {
      activeList.removeEventListener("scroll", handleScroll);
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

  async function handleTopicReaction(topicId: string, reaction: ReactionEmoji) {
    if (reactingTopicKey) {
      return;
    }

    setReactingTopicKey({ topicId, reaction });

    try {
      const payload = await apiClientFetch(
        `/v1/forum/hubs/${hub.id}/lobbies/${lobby.id}/topics/${topicId}/reactions`,
        {
          method: "POST",
          body: JSON.stringify({ emoji: reaction }),
        },
      );
      const updatedTopic = forumTopicResponseSchema.parse(payload).topic;

      setTopics((current) =>
        current.map((topic) =>
          topic.id === updatedTopic.id ? updatedTopic : topic,
        ),
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось сохранить реакцию.",
      );
    } finally {
      setReactingTopicKey(null);
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
            {orderedTopics.map((topic) => {
              const memberRole = memberRolesByUserId.get(topic.author.id);
              const media = resolveChannelMedia(extractFirstUrl(topic.content));
              const youtubeEmbedUrl =
                media?.kind === "youtube" ? getYouTubeEmbedUrl(media.url) : null;

              return (
                <article
                  key={topic.id}
                  className="rounded-[20px] border border-[var(--border-soft)] bg-black px-4 py-4"
                >
                  <div className="flex items-start gap-3">
                    <Link href={buildUserProfileHref(topic.author.username)}>
                      <UserAvatar user={topic.author} size="sm" />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={buildUserProfileHref(topic.author.username)}
                              className="truncate text-sm font-semibold text-white transition-colors hover:text-[var(--text-soft)]"
                            >
                              {topic.author.profile.displayName}
                            </Link>
                            {memberRole ? <HubMemberRoleBadge role={memberRole} /> : null}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                            @{topic.author.username}
                          </p>
                        </div>

                        <span className="inline-flex w-fit items-center rounded-full border border-[var(--border-soft)] bg-black px-2.5 py-1 text-[11px] font-medium text-[var(--text-dim)]">
                          {formatMessageDate(topic.createdAt)}
                        </span>
                      </div>

                      <div className="mt-3 rounded-[16px] border border-white/5 bg-[var(--bg-panel-soft)] px-3.5 py-3">
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-soft)]">
                          {topic.content}
                        </p>
                      </div>
                      {media?.kind === "image" ? (
                        <div className="mt-3 overflow-hidden rounded-[18px] border border-white/8 bg-black">
                          <img
                            src={media.url}
                            alt=""
                            className="max-h-[520px] w-full object-contain"
                            loading="lazy"
                          />
                        </div>
                      ) : media?.kind === "video" ? (
                        <div className="mt-3 overflow-hidden rounded-[18px] border border-white/8 bg-black">
                          <video
                            src={media.url}
                            className="aspect-video w-full bg-black object-contain"
                            controls
                            loop
                            playsInline
                            preload="metadata"
                          />
                        </div>
                      ) : youtubeEmbedUrl ? (
                        <div className="mt-3 overflow-hidden rounded-[18px] border border-white/8 bg-black">
                          <iframe
                            src={youtubeEmbedUrl}
                            title={topic.title}
                            className="aspect-video w-full bg-black"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {textReactionOptions.map((reaction) => {
                          const reactionStats = topic.reactions.find(
                            (item) => item.emoji === reaction,
                          );
                          const isActive = Boolean(reactionStats?.reactedByViewer);

                          return (
                            <button
                              key={reaction}
                              type="button"
                              onClick={() =>
                                void handleTopicReaction(topic.id, reaction)
                              }
                              disabled={
                                reactingTopicKey?.topicId === topic.id &&
                                reactingTopicKey.reaction === reaction
                              }
                              className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full border px-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                                isActive
                                  ? "border-[#0070F3]/70 bg-[#0070F3]/15 text-white hover:border-[#0070F3]"
                                  : "border-white/8 bg-black hover:border-white/16 hover:bg-[var(--bg-hover)]"
                              }`}
                              aria-label={`Реакция ${reaction}`}
                            >
                              <span>{reaction}</span>
                              {reactionStats?.count ? (
                                <span className="text-[11px] font-medium text-[var(--text-dim)]">
                                  {reactionStats.count}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-white/5 bg-black px-3 py-3 sm:px-4"
      >
        <div className="rounded-[18px] border border-white/8 bg-[#050505] p-2.5 transition-colors focus-within:border-[#0070F3]/70 focus-within:ring-2 focus-within:ring-[#0070F3]/20">
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
            className="min-h-[76px] w-full resize-none border-0 bg-transparent px-1 py-1 text-sm leading-6 text-white outline-none placeholder:text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[84px]"
          />

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {[
                { label: "Фото", icon: Image },
                { label: "Видео", icon: Video },
                { label: "GIF", icon: Smile },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <span
                    key={item.label}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/8 bg-black px-2.5 text-[11px] text-[var(--text-dim)]"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                );
              })}
            </div>
            {!canSendMessages ? (
              <p className="min-w-[180px] flex-1 text-xs text-[var(--text-dim)]">
                Читать можно, отправка сейчас недоступна.
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={!canSendMessages || isSubmitting || draft.trim().length === 0}
              className="h-10 min-w-[132px] rounded-[14px] border-[#0070F3] bg-[#0070F3] px-4 text-white hover:border-[#1A7FFF] hover:bg-[#1A7FFF] disabled:border-white/10 disabled:bg-white/12 disabled:text-[var(--text-muted)]"
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
