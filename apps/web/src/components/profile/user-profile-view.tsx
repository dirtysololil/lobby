"use client";

import Link from "next/link";
import {
  directConversationSummaryResponseSchema,
  feedPostListResponseSchema,
  feedPostResponseSchema,
  userResponseSchema,
  userSearchResponseSchema,
  type FeedPost,
  type FeedPostKind,
  type PublicUser,
  type ReactionEmoji,
  type UserRelationshipSummary,
} from "@lobby/shared";
import {
  ArrowUpRight,
  ArrowLeft,
  Clock3,
  MessageSquareMore,
  ShieldAlert,
  ShieldBan,
  UserPlus2,
  UserRoundCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppMobileTopNav } from "@/components/app/app-mobile-top-nav";
import { AvatarPreviewModal } from "@/components/ui/avatar-preview-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { CompactListCount } from "@/components/ui/compact-list";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { resolveApiBaseUrlForBrowser } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";

interface UserProfileViewProps {
  viewer: PublicUser;
  initialUser: PublicUser;
  initialRelationship: UserRelationshipSummary;
}

const reactionOptions: ReactionEmoji[] = ["❤️", "🔥", "✨", "👀"];

function formatJoinedDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "только что";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} мин`;
  }

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function isYouTubeUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname === "youtu.be" ||
      url.hostname === "www.youtube.com" ||
      url.hostname === "youtube.com"
    );
  } catch {
    return false;
  }
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

function resolveMediaKind(mediaUrl: string | null, postKind?: FeedPostKind) {
  if (!mediaUrl) {
    return "none" as const;
  }

  const normalized = mediaUrl.split("?")[0]?.toLowerCase() ?? "";

  if (isYouTubeUrl(mediaUrl)) {
    return "youtube" as const;
  }

  if (postKind === "VIDEO" || /\.(mp4|webm|mov|m4v)$/i.test(normalized)) {
    return "video" as const;
  }

  if (/\.(png|jpe?g|webp|gif|avif)$/i.test(normalized)) {
    return "image" as const;
  }

  return "link" as const;
}

function getMediaLabel(mediaUrl: string | null, postKind?: FeedPostKind) {
  switch (resolveMediaKind(mediaUrl, postKind)) {
    case "video":
      return "Видео";
    case "youtube":
      return "YouTube";
    case "image":
      return mediaUrl?.split("?")[0]?.toLowerCase().endsWith(".gif")
        ? "GIF"
        : "Фото";
    case "link":
      return "Ссылка";
    default:
      return "Пост";
  }
}

function resolveFeedMediaSrc(mediaUrl: string | null) {
  if (!mediaUrl) {
    return null;
  }

  if (/^(https?:|blob:|data:)/i.test(mediaUrl)) {
    return mediaUrl;
  }

  const apiBaseUrl = resolveApiBaseUrlForBrowser();

  return apiBaseUrl ? new URL(mediaUrl, apiBaseUrl).toString() : mediaUrl;
}

function getRelationshipLabel(
  relationship: UserRelationshipSummary,
  isSelf: boolean,
) {
  if (isSelf) {
    return "Ваш профиль";
  }

  if (relationship.isBlockedByViewer) {
    return "Контакт скрыт";
  }

  if (relationship.hasBlockedViewer) {
    return "Контакт ограничен";
  }

  switch (relationship.friendshipState) {
    case "ACCEPTED":
      return "Вы в друзьях";
    case "INCOMING_REQUEST":
      return "Ждёт подтверждения";
    case "OUTGOING_REQUEST":
      return "Запрос отправлен";
    default:
      return "Новый контакт";
  }
}

function getRelationshipNote(
  relationship: UserRelationshipSummary,
  isSelf: boolean,
) {
  if (isSelf) {
    return "Так профиль выглядит в списках людей, диалогах и других рабочих экранах.";
  }

  if (relationship.isBlockedByViewer) {
    return "Вы скрыли этот контакт. Сообщения, звонки и новые социальные действия сейчас ограничены.";
  }

  if (relationship.hasBlockedViewer) {
    return "Этот пользователь ограничил прямой контакт, поэтому часть быстрых действий может быть недоступна.";
  }

  switch (relationship.friendshipState) {
    case "ACCEPTED":
      return "Контакт уже в вашем круге общения. Отсюда можно быстро открыть диалог или убрать его из друзей.";
    case "INCOMING_REQUEST":
      return "Заявка уже у вас. Её можно принять прямо с этой страницы.";
    case "OUTGOING_REQUEST":
      return "Запрос уже отправлен. Здесь его можно отменить или позже продолжить общение.";
    default:
      return "Отсюда можно начать знакомство, отправить заявку и быстро открыть профиль для общения.";
  }
}

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[22px] border border-white/8 bg-black",
        className,
      )}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  action,
  count,
  title,
}: {
  action?: ReactNode;
  count?: number;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3.5">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">
          {title}
        </h2>
        {typeof count === "number" ? <CompactListCount>{count}</CompactListCount> : null}
      </div>
      {action}
    </div>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/8 bg-black px-3 text-[12px] text-[var(--text-soft)]">
      {children}
    </span>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-white/8 bg-white/[0.02] px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </p>
      <div className="mt-1.5 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function FeedPostCard({
  onReact,
  pendingReaction,
  post,
}: {
  onReact: (postId: string, reaction: ReactionEmoji) => Promise<void>;
  pendingReaction: ReactionEmoji | null;
  post: FeedPost;
}) {
  const mediaKind = resolveMediaKind(post.mediaUrl, post.kind);
  const mediaSrc = resolveFeedMediaSrc(post.mediaUrl);
  const youtubeEmbedUrl = post.mediaUrl ? getYouTubeEmbedUrl(post.mediaUrl) : null;

  return (
    <article className="rounded-[22px] border border-white/8 bg-black p-4 transition-colors hover:border-white/14">
      <div className="flex items-start gap-3">
        <UserAvatar user={post.author} size="sm" className="h-11 w-11 text-[12px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold tracking-[-0.02em] text-white">
              {post.author.profile.displayName}
            </p>
            <CompactListCount>{getMediaLabel(post.mediaUrl, post.kind)}</CompactListCount>
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <Clock3 className="h-3 w-3" />
              {formatShortTime(post.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            @{post.author.username}
          </p>
        </div>
      </div>

      {post.title ? (
        <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.03em] text-white">
          {post.title}
        </h2>
      ) : null}

      {post.body ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-soft)]">
          {post.body}
        </p>
      ) : null}

      {mediaKind === "video" && mediaSrc ? (
        <div className="mt-4 overflow-hidden rounded-[18px] border border-white/8 bg-black">
          <video
            src={mediaSrc}
            className="aspect-video h-full w-full bg-black object-contain"
            controls
            loop
            playsInline
            preload="metadata"
          />
        </div>
      ) : mediaKind === "youtube" && youtubeEmbedUrl ? (
        <div className="mt-4 overflow-hidden rounded-[18px] border border-white/8 bg-black">
          <iframe
            src={youtubeEmbedUrl}
            title={post.title ?? "YouTube"}
            className="aspect-video h-full w-full bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : mediaKind === "image" && mediaSrc ? (
        <div className="mt-4 overflow-hidden rounded-[18px] border border-white/8 bg-black">
          <img
            src={mediaSrc}
            alt={post.title ?? "Медиа поста"}
            className="max-h-[620px] w-full object-contain"
            loading="lazy"
          />
        </div>
      ) : post.mediaUrl ? (
        <a
          href={post.mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[12px] border border-white/8 bg-black px-3 text-sm font-medium text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-hover)] hover:text-white"
        >
          <ArrowUpRight size={15} strokeWidth={1.75} />
          Открыть ссылку
        </a>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/8 pt-3">
        {reactionOptions.map((reaction) => {
          const reactionStats = post.reactions.find(
            (item) => item.emoji === reaction,
          );
          const isActive = Boolean(reactionStats?.reactedByViewer);

          return (
            <button
              key={reaction}
              type="button"
              onClick={() => void onReact(post.id, reaction)}
              disabled={pendingReaction === reaction}
              className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full border px-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                isActive
                  ? "border-white/30 bg-white/12 text-white"
                  : "border-white/8 bg-black hover:border-white/16 hover:bg-[var(--bg-hover)]",
              )}
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
    </article>
  );
}

export function UserProfileView({
  viewer,
  initialUser,
  initialRelationship,
}: UserProfileViewProps) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [relationship, setRelationship] = useState(initialRelationship);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [feedErrorMessage, setFeedErrorMessage] = useState<string | null>(null);
  const [reactingPostKey, setReactingPostKey] = useState<{
    postId: string;
    reaction: ReactionEmoji;
  } | null>(null);
  const isSelf = viewer.id === user.id;
  const canBypassFriendshipForDm = viewer.role === "OWNER";
  const relationshipLabel = getRelationshipLabel(relationship, isSelf);
  const hasContactLimit =
    relationship.isBlockedByViewer || relationship.hasBlockedViewer;
  const accessLabel = hasContactLimit ? "Ограничен" : "Открыт";
  const dmStateLabel = relationship.dmConversationId ? "Открыт" : "Нет";
  const bioText =
    user.profile.bio?.trim() ||
    "Короткого описания пока нет, но профиль уже готов для быстрого перехода к общению.";

  useEffect(() => {
    let active = true;

    void (async () => {
      setIsFeedLoading(true);
      setFeedErrorMessage(null);

      try {
        const payload = await apiClientFetch("/v1/feed");
        const posts = feedPostListResponseSchema.parse(payload).items;

        if (!active) {
          return;
        }

        setFeedPosts(posts.filter((post) => post.author.id === user.id));
      } catch (error) {
        if (!active) {
          return;
        }

        setFeedPosts([]);
        setFeedErrorMessage(
          error instanceof Error ? error.message : "Не удалось загрузить ленту.",
        );
      } finally {
        if (active) {
          setIsFeedLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [user.id]);

  async function refreshProfile() {
    if (isSelf) {
      const payload = await apiClientFetch("/v1/users/me");
      setUser(userResponseSchema.parse(payload).user);
      return;
    }

    const payload = await apiClientFetch(
      `/v1/users/search?query=${encodeURIComponent(user.username)}`,
    );
    const items = userSearchResponseSchema.parse(payload).items;
    const exactMatch =
      items.find((item) => item.user.username === user.username) ?? null;

    if (!exactMatch) {
      throw new Error("Профиль больше недоступен.");
    }

    setUser(exactMatch.user);
    setRelationship(exactMatch.relationship);
  }

  async function withAction(key: string, action: () => Promise<void>) {
    setActionKey(key);
    setErrorMessage(null);

    try {
      await action();
      await refreshProfile();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось обновить профиль.",
      );
    } finally {
      setActionKey(null);
    }
  }

  async function openDm() {
    setActionKey("dm");
    setErrorMessage(null);

    try {
      const payload = await apiClientFetch("/v1/direct-messages/open", {
        method: "POST",
        body: JSON.stringify({ username: user.username }),
      });
      const conversation =
        directConversationSummaryResponseSchema.parse(payload).conversation;
      router.push(`/app/messages/${conversation.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось открыть диалог.",
      );
      setActionKey(null);
    }
  }

  async function handlePostReaction(postId: string, reaction: ReactionEmoji) {
    if (reactingPostKey) {
      return;
    }

    setReactingPostKey({ postId, reaction });

    try {
      const payload = await apiClientFetch(`/v1/feed/${postId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji: reaction }),
      });
      const updatedPost = feedPostResponseSchema.parse(payload).post;

      setFeedPosts((current) =>
        current.map((post) => (post.id === updatedPost.id ? updatedPost : post)),
      );
      setFeedErrorMessage(null);
    } catch (error) {
      setFeedErrorMessage(
        error instanceof Error ? error.message : "Не удалось сохранить реакцию.",
      );
    } finally {
      setReactingPostKey(null);
    }
  }

  function renderFriendAction() {
    if (isSelf || relationship.isBlockedByViewer) {
      return null;
    }

    if (relationship.friendshipState === "INCOMING_REQUEST") {
      return (
        <Button
          onClick={() =>
            void withAction("friend", async () => {
              await apiClientFetch("/v1/relationships/friends/accept", {
                method: "POST",
                body: JSON.stringify({ username: user.username }),
              });
            })
          }
          disabled={actionKey !== null}
          className="h-10 w-full rounded-[12px]"
        >
          <UserRoundCheck className="h-4 w-4" />
          Принять заявку
        </Button>
      );
    }

    if (
      relationship.friendshipState === "OUTGOING_REQUEST" ||
      relationship.friendshipState === "ACCEPTED"
    ) {
      return (
        <Button
          variant="secondary"
          onClick={() =>
            void withAction("friend", async () => {
              await apiClientFetch("/v1/relationships/friends/remove", {
                method: "POST",
                body: JSON.stringify({ username: user.username }),
              });
            })
          }
          disabled={actionKey !== null}
          className="h-10 w-full rounded-[12px] border-[var(--border)] bg-black"
        >
          {relationship.friendshipState === "ACCEPTED"
            ? "Убрать из друзей"
            : "Отменить заявку"}
        </Button>
      );
    }

    return (
      <Button
        onClick={() =>
          void withAction("friend", async () => {
            await apiClientFetch("/v1/relationships/friends/request", {
              method: "POST",
              body: JSON.stringify({ username: user.username }),
            });
          })
        }
        disabled={actionKey !== null || relationship.hasBlockedViewer}
        className="h-10 w-full rounded-[12px]"
      >
        <UserPlus2 className="h-4 w-4" />
        Добавить в друзья
      </Button>
    );
  }

  return (
    <>
      <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-black">
        <div className="border-b border-white/5 px-4 pb-3 pt-5 md:hidden">
          <AppMobileTopNav active="people" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid min-h-full w-full gap-3 px-3 py-3 md:px-5 md:py-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <main className="grid min-w-0 content-start gap-3">
              <Panel>
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <Link
                    href="/app/people?view=discover"
                    className="inline-flex min-h-9 items-center gap-2 rounded-[12px] border border-white/8 bg-black px-3 text-sm text-[var(--text-soft)] transition-colors hover:border-white/14 hover:bg-[var(--bg-hover)] hover:text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Люди
                  </Link>

                  <MetaPill>{relationshipLabel}</MetaPill>
                </div>
              </Panel>

              <Panel>
                <PanelHeader
                  title="Контекст"
                  action={<CompactListCount>Общение</CompactListCount>}
                />
                <div className="p-4">
                  <p className="text-sm leading-6 text-[var(--text-soft)]">
                    {getRelationshipNote(relationship, isSelf)}
                  </p>

                  {hasContactLimit && !isSelf ? (
                    <div className="mt-4 rounded-[16px] border border-amber-300/20 bg-amber-300/10 px-3.5 py-3 text-sm text-amber-50">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          {relationship.isBlockedByViewer
                            ? "Пока блокировка активна, писать и получать новые социальные действия здесь нельзя."
                            : "Пользователь ограничил прямой контакт, поэтому часть действий сейчас недоступна."}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Panel>

              {feedErrorMessage ? (
                <div className="rounded-[18px] border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                  {feedErrorMessage}
                </div>
              ) : null}

              <div className="grid gap-3">
                {isFeedLoading ? (
                  <Panel>
                    <div className="flex min-h-[220px] items-center justify-center px-6 text-center text-sm text-[var(--text-muted)]">
                      Загружаем ленту...
                    </div>
                  </Panel>
                ) : feedPosts.length === 0 ? (
                  <Panel>
                    <div className="empty-state-minimal min-h-[220px]">
                      <p className="text-sm font-medium text-white">
                        Публикаций пока нет
                      </p>
                    </div>
                  </Panel>
                ) : (
                  feedPosts.map((post) => (
                    <FeedPostCard
                      key={post.id}
                      post={post}
                      onReact={handlePostReaction}
                      pendingReaction={
                        reactingPostKey?.postId === post.id
                          ? reactingPostKey.reaction
                          : null
                      }
                    />
                  ))
                )}
              </div>
            </main>

            <aside className="order-first grid content-start gap-3 lg:order-none">
              <Panel>
                <div className="grid grid-cols-2 gap-2.5 p-4">
                  <div className="col-span-2 mb-2 text-center">
                    <button
                      type="button"
                      onClick={() => setIsAvatarPreviewOpen(true)}
                      className="group mx-auto block w-fit rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      aria-label="Открыть фото профиля"
                    >
                      <span className="block rounded-full border border-white/12 p-1 transition-colors group-hover:border-white/24">
                        <UserAvatar
                          user={user}
                          size="lg"
                          className="h-[72px] w-[72px] text-[18px]"
                        />
                      </span>
                    </button>
                    <h1 className="mt-3 truncate text-[18px] font-semibold tracking-[-0.03em] text-white">
                      {user.profile.displayName}
                    </h1>
                    <p className="mt-1 truncate text-sm text-[var(--text-muted)]">
                      @{user.username}
                    </p>
                    <p className="mx-auto mt-3 line-clamp-3 max-w-[220px] text-xs leading-5 text-[var(--text-dim)]">
                      {bioText}
                    </p>
                  </div>

                  <SummaryRow
                    label="Статус"
                    value={
                      <div className="inline-flex items-center gap-2">
                        <PresenceIndicator user={user} compact />
                      </div>
                    }
                  />
                  <SummaryRow
                    label="На платформе"
                    value={formatJoinedDate(user.createdAt)}
                  />
                  <SummaryRow label="Контакт" value={relationshipLabel} />
                  <SummaryRow label="Личные сообщения" value={dmStateLabel} />
                  <SummaryRow label="Доступ" value={accessLabel} />
                </div>
              </Panel>

              <Panel>
                <PanelHeader
                  title="Действия"
                  action={<CompactListCount>Управление</CompactListCount>}
                />
                <div className="grid gap-2.5 p-4">
                  {errorMessage ? (
                    <div className="rounded-[16px] border border-red-400/20 bg-red-400/10 px-3.5 py-3 text-sm text-red-100">
                      {errorMessage}
                    </div>
                  ) : null}

                  {isSelf ? (
                    <Link
                      href="/app/settings/profile"
                      className={buttonVariants({
                        className: "h-10 w-full rounded-[12px]",
                      })}
                    >
                      Редактировать профиль
                    </Link>
                  ) : (
                    <>
                      <Button
                        onClick={() => void openDm()}
                        disabled={
                          actionKey !== null ||
                          relationship.hasBlockedViewer ||
                          (!canBypassFriendshipForDm &&
                            !relationship.dmConversationId &&
                            relationship.friendshipState !== "ACCEPTED")
                        }
                        className="h-10 w-full rounded-[12px]"
                      >
                        <MessageSquareMore className="h-4 w-4" />
                        {relationship.dmConversationId ? "Открыть ЛС" : "Написать"}
                      </Button>

                      {renderFriendAction()}

                      <Button
                        variant={
                          relationship.isBlockedByViewer ? "secondary" : "destructive"
                        }
                        onClick={() =>
                          void withAction("block", async () => {
                            await apiClientFetch(
                              relationship.isBlockedByViewer
                                ? "/v1/relationships/blocks/unblock"
                                : "/v1/relationships/blocks",
                              {
                                method: "POST",
                                body: JSON.stringify({ username: user.username }),
                              },
                            );
                          })
                        }
                        disabled={actionKey !== null}
                        className={cn(
                          "h-10 w-full rounded-[12px]",
                          relationship.isBlockedByViewer &&
                            "border-[var(--border)] bg-black",
                        )}
                      >
                        <ShieldBan className="h-4 w-4" />
                        {relationship.isBlockedByViewer
                          ? "Снять блок"
                          : "Заблокировать"}
                      </Button>
                    </>
                  )}
                </div>
              </Panel>
            </aside>
          </div>
        </div>
      </section>

      <AvatarPreviewModal
        user={user}
        open={isAvatarPreviewOpen}
        onClose={() => setIsAvatarPreviewOpen(false)}
      />
    </>
  );
}
