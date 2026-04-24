"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  Clock3,
  Link2,
  House,
  Layers3,
  LockKeyhole,
  MessageSquareMore,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings2,
  X,
  Users2,
  type LucideIcon,
} from "lucide-react";
import {
  directConversationListResponseSchema,
  feedPostListResponseSchema,
  feedPostResponseSchema,
  friendshipsResponseSchema,
  hubListResponseSchema,
  viewerHubInvitesResponseSchema,
  type DirectConversationSummary,
  type FeedPost,
  type FeedPostKind,
  type FriendshipRecord,
  type HubInvite,
  type HubSummary,
  type PublicUser,
} from "@lobby/shared";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { AppMobileTopNav } from "@/components/app/app-mobile-top-nav";
import { useOptionalRealtimePresence, useRealtime } from "@/components/realtime/realtime-provider";
import { CompactListCount } from "@/components/ui/compact-list";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { applyDmSignalToConversationSummaries } from "@/lib/direct-message-state";
import { buildUserProfileHref } from "@/lib/profile-routes";
import { resolveApiBaseUrlForBrowser } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";

interface HomeWorkspaceProps {
  viewer: PublicUser;
}

const emptyLabel = "Сейчас тут пусто";
const navIconProps = { size: 17, strokeWidth: 1.75 } as const;
const reactionOptions = ["❤️", "🔥", "✨", "👀"];

const quickLinks: Array<{
  href: string;
  icon: LucideIcon;
  label: string;
}> = [
  { href: "/app/home", icon: House, label: "Главная" },
  { href: "/app/messages", icon: MessageSquareMore, label: "Сообщения" },
  { href: "/app/people", icon: Users2, label: "Люди" },
  { href: "/app/hubs", icon: Layers3, label: "Хабы" },
  { href: "/app/settings/profile", icon: Settings2, label: "Настройки" },
];

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

function formatRole(role: string | null | undefined) {
  switch (role) {
    case "OWNER":
      return "Владелец";
    case "ADMIN":
      return "Администратор";
    case "MODERATOR":
      return "Модератор";
    case "MEMBER":
      return "Участник";
    case "GUEST":
      return "Гость";
    default:
      return "Участник";
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

function getConversationPreview(conversation: DirectConversationSummary) {
  if (conversation.lastMessagePreview?.trim()) {
    return conversation.lastMessagePreview.trim();
  }

  switch (conversation.lastMessage?.type) {
    case "STICKER":
      return "Стикер";
    case "GIF":
      return "GIF";
    case "MEDIA":
      return "Медиа";
    case "FILE":
      return "Файл";
    default:
      return "Сообщений пока нет";
  }
}

function EmptyNow({ className }: { className?: string }) {
  return (
    <div className={cn("empty-state-minimal min-h-[112px]", className)}>
      <p className="text-sm font-medium text-white">{emptyLabel}</p>
    </div>
  );
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

function IconButtonLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/8 bg-black text-[var(--text-dim)] transition-colors hover:border-white/14 hover:bg-[var(--bg-hover)] hover:text-white"
    >
      <Icon size={16} strokeWidth={1.75} />
    </Link>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-2.5 text-center">
      <p className="text-[17px] font-semibold leading-none tracking-[-0.04em] text-white">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function FeedPostCard({ post }: { post: FeedPost }) {
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
        {reactionOptions.map((reaction) => (
          <button
            key={reaction}
            type="button"
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/8 bg-black px-2 text-sm transition-colors hover:border-white/16 hover:bg-[var(--bg-hover)]"
            aria-label={`Реакция ${reaction}`}
          >
            {reaction}
          </button>
        ))}
      </div>
    </article>
  );
}

function ContactRow({
  href,
  meta,
  user,
}: {
  href: string;
  meta: string;
  user: PublicUser;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 rounded-[16px] px-2.5 py-2 transition-colors hover:bg-[var(--bg-hover)]"
    >
      <UserAvatar user={user} size="sm" className="h-10 w-10 text-[11px]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {user.profile.displayName}
        </p>
        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{meta}</p>
      </div>
    </Link>
  );
}

function MessageRow({ conversation }: { conversation: DirectConversationSummary }) {
  return (
    <Link
      href={`/app/messages/${conversation.id}`}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 rounded-[16px] px-2.5 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
    >
      <UserAvatar
        user={conversation.counterpart}
        size="sm"
        className="h-10 w-10 text-[11px]"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">
          {conversation.counterpart.profile.displayName}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-xs",
            conversation.unreadCount > 0
              ? "text-[var(--text-soft)]"
              : "text-[var(--text-muted)]",
          )}
        >
          {getConversationPreview(conversation)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 text-[11px] text-[var(--text-muted)]">
        <span>{formatShortTime(conversation.lastMessageAt)}</span>
        {conversation.unreadCount > 0 ? (
          <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-white/12 bg-white px-1 text-[10px] font-semibold text-black">
            {conversation.unreadCount}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function StoryTile({ user }: { user: PublicUser }) {
  return (
    <Link
      href={buildUserProfileHref(user.username)}
      className="group grid w-[72px] shrink-0 justify-items-center gap-2 text-center"
    >
      <span className="rounded-full border border-white/12 p-1 transition-colors group-hover:border-white/24">
        <UserAvatar user={user} size="lg" className="h-12 w-12 text-[12px]" />
      </span>
      <span className="max-w-full truncate text-[11px] font-medium text-[var(--text-dim)] group-hover:text-white">
        {user.profile.displayName}
      </span>
    </Link>
  );
}

export function HomeWorkspace({ viewer }: HomeWorkspaceProps) {
  const { latestDmSignal } = useRealtime();
  const realtimePresence = useOptionalRealtimePresence();
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([]);
  const [friendships, setFriendships] = useState<FriendshipRecord[]>([]);
  const [hubs, setHubs] = useState<HubSummary[]>([]);
  const [invites, setInvites] = useState<HubInvite[]>([]);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [postKind, setPostKind] = useState<FeedPostKind>("ARTICLE");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postMediaUrl, setPostMediaUrl] = useState("");
  const [postMediaName, setPostMediaName] = useState<string | null>(null);
  const [postMediaPreviewUrl, setPostMediaPreviewUrl] = useState<string | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isUploadingPostMedia, setIsUploadingPostMedia] = useState(false);
  const [postErrorMessage, setPostErrorMessage] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const postFileInputRef = useRef<HTMLInputElement | null>(null);

  const toLiveUser = useCallback(
    (user: PublicUser): PublicUser =>
      realtimePresence === null
        ? user
        : {
            ...user,
            isOnline: Boolean(realtimePresence[user.id]),
          },
    [realtimePresence],
  );

  useEffect(() => {
    if (!latestDmSignal) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setConversations((current) =>
        applyDmSignalToConversationSummaries(current, latestDmSignal),
      );
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [latestDmSignal]);

  useEffect(
    () => () => {
      if (postMediaPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(postMediaPreviewUrl);
      }
    },
    [postMediaPreviewUrl],
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const [
        feedResult,
        conversationResult,
        friendshipsResult,
        hubsResult,
        invitesResult,
      ] =
        await Promise.allSettled([
          apiClientFetch("/v1/feed"),
          apiClientFetch("/v1/direct-messages"),
          apiClientFetch("/v1/relationships/friends"),
          apiClientFetch("/v1/hubs"),
          apiClientFetch("/v1/hubs/invites/me"),
        ]);

      if (!active) {
        return;
      }

      let failed = 0;

      if (feedResult.status === "fulfilled") {
        try {
          setFeedPosts(feedPostListResponseSchema.parse(feedResult.value).items);
        } catch {
          failed += 1;
          setFeedPosts([]);
        }
      } else {
        failed += 1;
        setFeedPosts([]);
      }

      if (conversationResult.status === "fulfilled") {
        try {
          setConversations(
            directConversationListResponseSchema.parse(conversationResult.value).items,
          );
        } catch {
          failed += 1;
          setConversations([]);
        }
      } else {
        failed += 1;
        setConversations([]);
      }

      if (friendshipsResult.status === "fulfilled") {
        try {
          setFriendships(friendshipsResponseSchema.parse(friendshipsResult.value).items);
        } catch {
          failed += 1;
          setFriendships([]);
        }
      } else {
        failed += 1;
        setFriendships([]);
      }

      if (hubsResult.status === "fulfilled") {
        try {
          setHubs(hubListResponseSchema.parse(hubsResult.value).items);
        } catch {
          failed += 1;
          setHubs([]);
        }
      } else {
        failed += 1;
        setHubs([]);
      }

      if (invitesResult.status === "fulfilled") {
        try {
          setInvites(viewerHubInvitesResponseSchema.parse(invitesResult.value).items);
        } catch {
          failed += 1;
          setInvites([]);
        }
      } else {
        failed += 1;
        setInvites([]);
      }

      if (failed === 5) {
        setErrorMessage("Не удалось загрузить данные главной.");
      }

      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const acceptedFriends = useMemo(
    () => friendships.filter((item) => item.state === "ACCEPTED"),
    [friendships],
  );
  const incomingRequests = useMemo(
    () => friendships.filter((item) => item.state === "INCOMING_REQUEST"),
    [friendships],
  );
  const liveViewer = toLiveUser(viewer);
  const liveFriends = useMemo(
    () =>
      acceptedFriends
        .map((item) => ({
          ...item,
          otherUser: toLiveUser(item.otherUser),
        }))
        .sort((left, right) => {
          if (left.otherUser.isOnline !== right.otherUser.isOnline) {
            return left.otherUser.isOnline ? -1 : 1;
          }

          return left.otherUser.profile.displayName.localeCompare(
            right.otherUser.profile.displayName,
            "ru",
          );
        }),
    [acceptedFriends, toLiveUser],
  );

  const orderedConversations = useMemo(
    () =>
      conversations
        .map((conversation) => ({
          ...conversation,
          counterpart: toLiveUser(conversation.counterpart),
        }))
        .sort(
          (left, right) =>
            new Date(right.lastMessageAt ?? 0).getTime() -
            new Date(left.lastMessageAt ?? 0).getTime(),
        ),
    [conversations, toLiveUser],
  );

  const totalUnread = conversations.reduce(
    (sum, conversation) => sum + conversation.unreadCount,
    0,
  );

  const filteredConversations = useMemo(() => {
    const query = messageSearchQuery.trim().toLowerCase();

    if (!query) {
      return orderedConversations;
    }

    return orderedConversations.filter((conversation) =>
      [
        conversation.counterpart.profile.displayName,
        conversation.counterpart.username,
        conversation.lastMessagePreview,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [messageSearchQuery, orderedConversations]);

  function resetPostMedia() {
    if (postMediaPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(postMediaPreviewUrl);
    }

    setPostMediaUrl("");
    setPostMediaName(null);
    setPostMediaPreviewUrl(null);
    setPostKind("ARTICLE");

    if (postFileInputRef.current) {
      postFileInputRef.current.value = "";
    }
  }

  async function uploadPostMedia(file: File) {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setPostErrorMessage("Можно загрузить фото, GIF или видео.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const formData = new FormData();
    formData.append("file", file);
    setIsUploadingPostMedia(true);
    setPostErrorMessage(null);

    try {
      const payload = await apiClientFetch<{
        kind: "IMAGE" | "VIDEO";
        mediaUrl: string;
      }>("/v1/feed/media", {
        method: "POST",
        body: formData,
      });

      if (postMediaPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(postMediaPreviewUrl);
      }

      setPostMediaUrl(payload.mediaUrl);
      setPostMediaName(file.name);
      setPostMediaPreviewUrl(previewUrl);
      setPostKind(payload.kind === "VIDEO" ? "VIDEO" : "ARTICLE");
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      setPostErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить медиа.",
      );
    } finally {
      setIsUploadingPostMedia(false);
    }
  }

  function handlePostFileChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);

    if (file) {
      void uploadPostMedia(file);
    }
  }

  function handlePostPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const [file] = Array.from(event.clipboardData.files).filter(
      (item) => item.type.startsWith("image/") || item.type.startsWith("video/"),
    );

    if (!file) {
      return;
    }

    event.preventDefault();
    void uploadPostMedia(file);
  }

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = postBody.trim();
    const trimmedTitle = postTitle.trim();
    const trimmedMediaUrl = postMediaUrl.trim();

    if (!trimmedBody && !trimmedMediaUrl) {
      setPostErrorMessage("Добавьте текст, фото, GIF, видео или ссылку.");
      return;
    }

    setIsPosting(true);
    setPostErrorMessage(null);

    try {
      const payload = await apiClientFetch("/v1/feed", {
        method: "POST",
        body: JSON.stringify({
          kind: postKind,
          title: trimmedTitle || null,
          body: trimmedBody,
          mediaUrl: trimmedMediaUrl || null,
        }),
      });
      const createdPost = feedPostResponseSchema.parse(payload).post;

      setFeedPosts((current) => [createdPost, ...current]);
      setPostTitle("");
      setPostBody("");
      setShowLinkInput(false);
      resetPostMedia();
    } catch (error) {
      setPostErrorMessage(
        error instanceof Error ? error.message : "Не удалось опубликовать пост.",
      );
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-black">
      <div className="border-b border-white/5 px-4 pb-3 pt-5 md:hidden">
        <AppMobileTopNav active="home" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid min-h-full w-full gap-3 px-3 py-3 md:px-5 md:py-5 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
          <aside className="grid content-start gap-3">
            <Panel className="px-4 py-5 text-center">
              <div className="mx-auto w-fit rounded-full border border-white/12 p-1">
                <UserAvatar
                  user={liveViewer}
                  size="lg"
                  className="h-[72px] w-[72px] text-[18px]"
                />
              </div>
              <h1 className="mt-3 truncate text-[18px] font-semibold tracking-[-0.03em] text-white">
                {viewer.profile.displayName}
              </h1>
              <p className="mt-1 truncate text-sm text-[var(--text-muted)]">
                @{viewer.username}
              </p>
              {viewer.profile.bio?.trim() ? (
                <p className="mx-auto mt-3 line-clamp-3 max-w-[220px] text-xs leading-5 text-[var(--text-dim)]">
                  {viewer.profile.bio.trim()}
                </p>
              ) : null}

              <div className="mt-5 grid grid-cols-3 gap-2">
                <StatTile label="Друзья" value={acceptedFriends.length} />
                <StatTile label="Непроч." value={totalUnread} />
                <StatTile label="Хабы" value={hubs.length} />
              </div>
            </Panel>

            <Panel>
              <div className="grid gap-1 p-2">
                {quickLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-[14px] px-3 text-sm font-medium transition-colors",
                        item.href === "/app/home"
                          ? "border border-white/10 bg-[var(--bg-active)] text-white"
                          : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-white",
                      )}
                    >
                      <Icon {...navIconProps} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                title="Контакты"
                count={acceptedFriends.length}
                action={
                  <Link
                    href="/app/people"
                    className="text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-white"
                  >
                    Все
                  </Link>
                }
              />
              <div className="p-2">
                {liveFriends.length === 0 ? (
                  <EmptyNow />
                ) : (
                  liveFriends.slice(0, 5).map((item) => (
                    <ContactRow
                      key={item.id}
                      href={buildUserProfileHref(item.otherUser.username)}
                      user={item.otherUser}
                      meta={item.otherUser.isOnline ? "В сети" : "Не в сети"}
                    />
                  ))
                )}
              </div>
            </Panel>
          </aside>

          <main className="grid min-w-0 content-start gap-3">
            <Panel>
              <div className="flex items-center gap-3 overflow-x-auto px-4 py-4">
                <Link
                  href="/app/settings/profile"
                  className="group grid w-[72px] shrink-0 justify-items-center gap-2 text-center"
                >
                  <span className="relative rounded-full border border-white/12 p-1 transition-colors group-hover:border-white/24">
                    <UserAvatar
                      user={liveViewer}
                      size="lg"
                      className="h-12 w-12 text-[12px]"
                    />
                    <span className="absolute bottom-0 right-0 inline-flex h-5 w-5 items-center justify-center rounded-full border border-black bg-white text-black">
                      <Plus size={13} strokeWidth={2} />
                    </span>
                  </span>
                  <span className="max-w-full truncate text-[11px] font-medium text-[var(--text-dim)] group-hover:text-white">
                    Вы
                  </span>
                </Link>

                {liveFriends.length === 0 ? (
                  <div className="flex min-h-[78px] flex-1 items-center justify-center rounded-[18px] border border-white/8 bg-white/[0.02] px-4 text-center text-sm font-medium text-white">
                    {emptyLabel}
                  </div>
                ) : (
                  liveFriends.slice(0, 8).map((item) => (
                    <StoryTile key={item.id} user={item.otherUser} />
                  ))
                )}
              </div>
            </Panel>

            <Panel className="p-4">
              <form onSubmit={(event) => void handleCreatePost(event)}>
                <div className="flex items-start gap-3">
                  <UserAvatar
                    user={liveViewer}
                    size="sm"
                    className="mt-0.5 h-10 w-10 text-[11px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex min-h-9 items-center gap-2 rounded-[12px] border border-white/16 bg-[var(--bg-active)] px-3 text-xs font-medium text-white">
                        <MessageSquareMore size={15} strokeWidth={1.75} />
                        Пост
                      </span>
                      <input
                        ref={postFileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={handlePostFileChange}
                        className="sr-only"
                      />
                      <button
                        type="button"
                        onClick={() => postFileInputRef.current?.click()}
                        disabled={isUploadingPostMedia}
                        className="inline-flex min-h-9 items-center gap-2 rounded-[12px] border border-white/8 bg-black px-3 text-xs font-medium text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-hover)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Paperclip size={15} strokeWidth={1.75} />
                        {isUploadingPostMedia ? "Загрузка..." : "Фото / видео / GIF"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLinkInput((current) => !current)}
                        className={cn(
                          "inline-flex min-h-9 items-center gap-2 rounded-[12px] border px-3 text-xs font-medium transition-colors",
                          showLinkInput
                            ? "border-white/16 bg-[var(--bg-active)] text-white"
                            : "border-white/8 bg-black text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-white",
                        )}
                      >
                        <Link2 size={15} strokeWidth={1.75} />
                        Ссылка
                      </button>
                    </div>

                    <input
                      value={postTitle}
                      onChange={(event) => setPostTitle(event.target.value)}
                      placeholder="Заголовок"
                      className="mt-3 h-11 w-full rounded-[14px] border border-white/8 bg-black px-3 text-sm font-medium text-white outline-none placeholder:text-[var(--text-muted)] focus:border-white/16"
                    />

                    <textarea
                      value={postBody}
                      onChange={(event) => setPostBody(event.target.value)}
                      onPaste={handlePostPaste}
                      placeholder="Напишите пост или вставьте фото из буфера"
                      rows={4}
                      className="mt-3 min-h-[112px] w-full rounded-[16px] border border-white/8 bg-black px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-[var(--text-muted)] focus:border-white/16"
                    />

                    {postMediaUrl ? (
                      <div className="mt-3 overflow-hidden rounded-[16px] border border-white/8 bg-black">
                        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2">
                          <span className="truncate text-xs text-[var(--text-dim)]">
                            {postMediaName ?? getMediaLabel(postMediaUrl, postKind)}
                          </span>
                          <button
                            type="button"
                            onClick={resetPostMedia}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-white"
                            aria-label="Убрать медиа"
                          >
                            <X size={14} strokeWidth={1.8} />
                          </button>
                        </div>
                        {resolveMediaKind(postMediaPreviewUrl ?? postMediaUrl, postKind) ===
                        "video" ? (
                          <video
                            src={postMediaPreviewUrl ?? postMediaUrl}
                            className="aspect-video w-full bg-black object-contain"
                            controls
                            loop
                            playsInline
                          />
                        ) : resolveMediaKind(
                            postMediaPreviewUrl ?? postMediaUrl,
                            postKind,
                          ) === "image" ? (
                          <img
                            src={postMediaPreviewUrl ?? postMediaUrl}
                            alt=""
                            className="max-h-72 w-full object-contain"
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {showLinkInput ? (
                      <input
                        value={postMediaUrl}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPostMediaUrl(value);
                          setPostMediaName(value ? "Внешняя ссылка" : null);
                          setPostMediaPreviewUrl(null);
                          setPostKind(resolveMediaKind(value) === "video" ? "VIDEO" : "ARTICLE");
                        }}
                        placeholder="Ссылка на фото, GIF, видео или YouTube"
                        className="mt-3 h-11 w-full rounded-[14px] border border-white/8 bg-black px-3 text-sm text-white outline-none placeholder:text-[var(--text-muted)] focus:border-white/16"
                      />
                    ) : null}

                    {postErrorMessage ? (
                      <p className="mt-3 text-sm text-red-200">
                        {postErrorMessage}
                      </p>
                    ) : null}

                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        disabled={isPosting}
                        className="inline-flex min-h-10 items-center justify-center rounded-[12px] border border-white bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-[var(--text-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPosting ? "Публикуем..." : "Опубликовать"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </Panel>

            {errorMessage ? (
              <div className="rounded-[18px] border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {errorMessage}
              </div>
            ) : null}

            <div className="grid gap-3">
              {isLoading ? (
                <Panel>
                  <div className="flex min-h-[220px] items-center justify-center px-6 text-center text-sm text-[var(--text-muted)]">
                    Загружаем главную...
                  </div>
                </Panel>
              ) : feedPosts.length === 0 ? (
                <Panel>
                  <EmptyNow className="min-h-[220px]" />
                </Panel>
              ) : (
                feedPosts.map((post) => <FeedPostCard key={post.id} post={post} />)
              )}
            </div>
          </main>

          <aside className="grid content-start gap-3">
            <Panel>
              <PanelHeader
                title="Сообщения"
                count={conversations.length}
                action={
                  <IconButtonLink
                    href="/app/messages"
                    icon={Send}
                    label="Открыть сообщения"
                  />
                }
              />
              <div className="border-b border-white/8 px-3 py-3">
                <label className="flex h-10 items-center gap-2 rounded-[14px] border border-white/8 bg-black px-3 text-[var(--text-dim)] focus-within:border-white/14">
                  <Search size={16} strokeWidth={1.75} />
                  <input
                    value={messageSearchQuery}
                    onChange={(event) => setMessageSearchQuery(event.target.value)}
                    placeholder="Поиск"
                    aria-label="Поиск по сообщениям"
                    className="w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-[var(--text-muted)]"
                  />
                </label>
              </div>
              <div className="p-2">
                {filteredConversations.length === 0 ? (
                  <EmptyNow />
                ) : (
                  filteredConversations
                    .slice(0, 5)
                    .map((conversation) => (
                      <MessageRow key={conversation.id} conversation={conversation} />
                    ))
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                title="Входящие"
                count={incomingRequests.length + invites.length}
                action={
                  <IconButtonLink
                    href="/app/people?view=requests"
                    icon={Bell}
                    label="Открыть входящие"
                  />
                }
              />
              <div className="grid gap-1 p-2">
                {incomingRequests.length + invites.length === 0 ? (
                  <EmptyNow />
                ) : (
                  <>
                    {incomingRequests.slice(0, 3).map((request) => {
                      const user = toLiveUser(request.otherUser);

                      return (
                        <ContactRow
                          key={request.id}
                          href="/app/people?view=requests"
                          user={user}
                          meta="Заявка в друзья"
                        />
                      );
                    })}
                    {invites.slice(0, 3).map((invite) => (
                      <Link
                        key={invite.id}
                        href="/app/hubs"
                        className="flex items-center gap-3 rounded-[16px] px-2.5 py-2 transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/8 bg-white/[0.03] text-white">
                          <Layers3 size={16} strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {invite.hub.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                            Пригласил {invite.invitedBy.profile.displayName}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                title="Хабы"
                count={hubs.length}
                action={
                  <IconButtonLink href="/app/hubs" icon={Layers3} label="Открыть хабы" />
                }
              />
              <div className="grid gap-1 p-2">
                {hubs.length === 0 ? (
                  <EmptyNow />
                ) : (
                  hubs.slice(0, 5).map((hub) => (
                    <Link
                      key={hub.id}
                      href={`/app/hubs/${hub.id}`}
                      className="flex items-center gap-3 rounded-[16px] px-2.5 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/8 bg-white/[0.03] text-[11px] font-semibold text-white">
                        {hub.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">
                            {hub.name}
                          </p>
                          {hub.isPrivate ? (
                            <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                          {formatRole(hub.membershipRole)}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </section>
  );
}
