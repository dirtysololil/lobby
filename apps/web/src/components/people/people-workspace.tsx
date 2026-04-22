"use client";

import Link from "next/link";
import {
  blocksResponseSchema,
  directConversationSummaryResponseSchema,
  friendshipsResponseSchema,
  userSearchResponseSchema,
  type BlockRecord,
  type FriendshipRecord,
  type PublicUser,
  type UserSearchResult,
} from "@lobby/shared";
import {
  Ban,
  ChevronDown,
  ContactRound,
  Ellipsis,
  Grid2x2,
  Inbox,
  Lightbulb,
  List,
  MessageSquareMore,
  Search,
  Send,
  Share2,
  ShieldBan,
  UserPlus2,
  Users2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppMobileTopNav } from "@/components/app/app-mobile-top-nav";
import { useOptionalRealtimePresence } from "@/components/realtime/realtime-provider";
import {
  CompactList,
  CompactListCount,
  CompactListHeader,
  CompactListRow,
} from "@/components/ui/compact-list";
import { Button } from "@/components/ui/button";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { getAvailabilityLabel } from "@/lib/last-seen";
import { buildUserProfileHref } from "@/lib/profile-routes";
import { cn } from "@/lib/utils";

type PeopleView =
  | "friends"
  | "requests"
  | "discover"
  | "suggested"
  | "blocked";
type FriendSortMode = "name" | "status";
type FriendDisplayMode = "list" | "grid";

interface PeopleWorkspaceProps {
  viewer: PublicUser;
}

interface RelationshipRowProps {
  user: PublicUser;
  subtitle: string;
  meta?: ReactNode;
  busy: boolean;
  actions: ReactNode;
}

const peopleViews: Array<{ id: PeopleView; label: string }> = [
  { id: "friends", label: "Друзья" },
  { id: "requests", label: "Заявки" },
  { id: "discover", label: "Поиск" },
  { id: "suggested", label: "Возможные друзья" },
  { id: "blocked", label: "Блокировки" },
] as const;

const peopleViewCopy: Record<
  PeopleView,
  { title: string; description: string; countLabel: string }
> = {
  friends: {
    title: "Контакты",
    description: "Быстрый доступ к друзьям, чату и действиям без лишних панелей.",
    countLabel: "друзей",
  },
  requests: {
    title: "Заявки",
    description: "Все входящие и исходящие запросы в одном рабочем экране.",
    countLabel: "заявок",
  },
  discover: {
    title: "Поиск",
    description: "Ищите по имени или никнейму и сразу переходите к действиям.",
    countLabel: "результатов",
  },
  suggested: {
    title: "Возможные друзья",
    description: "Новые связи, которые стоит добавить в круг общения.",
    countLabel: "рекомендаций",
  },
  blocked: {
    title: "Блокировки",
    description: "Управление заблокированными аккаунтами без дополнительных переходов.",
    countLabel: "блокировок",
  },
};

const sortLabels: Record<FriendSortMode, string> = {
  name: "По имени",
  status: "Сначала онлайн",
};

function formatRussianCount(
  value: number,
  singular: string,
  paucal: string,
  plural: string,
) {
  const absoluteValue = Math.abs(value);
  const lastTwoDigits = absoluteValue % 100;
  const lastDigit = absoluteValue % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${value} ${plural}`;
  }

  if (lastDigit === 1) {
    return `${value} ${singular}`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${value} ${paucal}`;
  }

  return `${value} ${plural}`;
}

function getCompactFriendStatus(user: PublicUser) {
  return user.isOnline ? "В сети" : "Не в сети";
}

function getActivityStatus(user: PublicUser) {
  const availabilityLabel = getAvailabilityLabel(user);

  if (!availabilityLabel) {
    return "не в сети";
  }

  if (availabilityLabel === "В сети") {
    return "в сети";
  }

  return availabilityLabel.replace("был в сети ", "был(а) ");
}

function ViewTabs({
  activeView,
  onSelect,
  pendingCount,
}: {
  activeView: PeopleView;
  onSelect: (view: PeopleView) => void;
  pendingCount: number;
}) {
  return (
    <div className="flex items-center gap-5 overflow-x-auto border-b border-white/5 pb-0.5 text-[13px] font-medium text-[#7f8a9c]">
      {peopleViews.map((item) => {
        const active = activeView === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap pb-3 transition-colors",
              active ? "text-[#4a84ff]" : "hover:text-white",
            )}
          >
            <span>{item.label}</span>
            {item.id === "requests" && pendingCount > 0 ? (
              <span className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white/[0.08] px-1.5 text-[11px] font-medium text-white">
                {pendingCount}
              </span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-0 bottom-[-2px] h-[2px] rounded-full bg-[#4a84ff]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function EmptyView({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users2;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state-minimal">
      <Icon className="h-5 w-5 text-[var(--text-muted)]" />
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-xs text-[var(--text-dim)]">{description}</p>
      </div>
    </div>
  );
}

function CompactEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users2;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[144px] flex-col items-center justify-center gap-2 px-4 py-5 text-center">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--border-soft)] bg-white/[0.04] text-[var(--text-muted)]">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs leading-5 text-[var(--text-dim)]">{description}</p>
      </div>
    </div>
  );
}

function SectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[20px] border border-white/6 bg-[#141d28]/78 shadow-[0_18px_38px_rgba(4,10,18,0.18)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function SidebarCard({
  children,
  title,
  icon: Icon,
}: {
  children: ReactNode;
  title: string;
  icon: typeof Users2;
}) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-white/6 bg-[#141d28]/82 shadow-[0_16px_30px_rgba(4,10,18,0.16)]">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <Icon className="h-4 w-4 text-[#9ca9bb]" />
        <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-white">
          {title}
        </h3>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function MetricCard({
  description,
  icon: Icon,
  iconClassName,
  label,
  value,
}: {
  description: string;
  icon: typeof Users2;
  iconClassName: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[16px] border border-white/6 bg-[#141d28]/76 px-4 py-4 shadow-[0_14px_28px_rgba(4,10,18,0.14)]">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/6",
            iconClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#94a0b3]">{label}</p>
          <p className="mt-1 text-[36px] font-semibold leading-none tracking-[-0.05em] text-white">
            {value}
          </p>
          <p className="mt-2 text-[13px] text-[#7f8a9c]">{description}</p>
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({
  description,
  icon: Icon,
  label,
  onClick,
}: {
  description: string;
  icon: typeof Search;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-[14px] border border-white/6 bg-[#151f2a]/84 px-4 py-3 text-left transition-colors hover:bg-[#1a2431]"
    >
      <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#9ca9bb]" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-[#7f8a9c]">{description}</p>
      </div>
    </button>
  );
}

function RequestPanel({
  title,
  description,
  count,
  icon: Icon,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string;
  description: string;
  count: number;
  icon: typeof Users2;
  emptyTitle: string;
  emptyDescription: string;
  children: ReactNode;
}) {
  return (
    <SectionCard className="rounded-[18px] bg-[#141d28]/78">
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/6 bg-white/[0.04] text-[#9fbfff]">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium tracking-tight text-white">{title}</p>
            <p className="mt-1 text-sm text-[#8d98aa]">{description}</p>
          </div>
        </div>

        <CompactListCount>{count}</CompactListCount>
      </div>

      <div className="overflow-hidden border-t border-white/5 bg-[#0f1823]/82">
        {count === 0 ? (
          <CompactEmptyState
            icon={Icon}
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          children
        )}
      </div>
    </SectionCard>
  );
}

function RelationshipRow({
  user,
  subtitle,
  meta,
  busy,
  actions,
}: RelationshipRowProps) {
  return (
    <CompactListRow
      className={cn(
        "flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:justify-between",
        busy && "opacity-70",
      )}
    >
      <Link
        href={buildUserProfileHref(user.username)}
        className="identity-link rounded-[16px] sm:max-w-[min(100%,420px)]"
      >
        <UserAvatar user={user} size="sm" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium leading-tight text-white">
              {user.profile.displayName}
            </p>
            <PresenceIndicator user={user} compact />
            {meta}
          </div>
          <p className="mt-0.5 truncate text-xs leading-tight text-[var(--text-muted)]">
            @{user.username}
          </p>
          <p className="mt-1 truncate text-xs leading-tight text-[var(--text-dim)]">
            {subtitle}
          </p>
        </div>
      </Link>

      <div className="flex flex-wrap gap-1.5">{actions}</div>
    </CompactListRow>
  );
}

function FriendRow({
  item,
  onOpenDm,
}: {
  item: FriendshipRecord;
  onOpenDm: (username: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/5 px-4 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between md:px-5">
      <Link
        href={buildUserProfileHref(item.otherUser.username)}
        className="identity-link rounded-[16px]"
      >
        <UserAvatar user={item.otherUser} size="sm" className="h-12 w-12 text-[13px]" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">
            {item.otherUser.profile.displayName}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-[#8a95a8]">
            @{item.otherUser.username}
          </p>
          <p
            className={cn(
              "mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium",
              item.otherUser.isOnline ? "text-[#31c878]" : "text-[#7f8a9c]",
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                item.otherUser.isOnline ? "bg-[#31c878]" : "bg-[#7d8798]",
              )}
            />
            {getCompactFriendStatus(item.otherUser)}
          </p>
        </div>
      </Link>

      <div className="flex items-center gap-2 md:shrink-0">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onOpenDm(item.otherUser.username)}
          className="h-9 rounded-[12px] border-white/6 bg-white/[0.04] px-3.5 text-[13px] hover:bg-white/[0.06]"
        >
          <MessageSquareMore className="h-[16px] w-[16px]" />
          Написать
        </Button>
        <Link
          href={buildUserProfileHref(item.otherUser.username)}
          aria-label={`Открыть профиль ${item.otherUser.profile.displayName}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/6 bg-white/[0.04] text-[#9ca9bb] transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <Ellipsis className="h-4.5 w-4.5" />
        </Link>
      </div>
    </div>
  );
}

function FriendGridCard({
  item,
  onOpenDm,
}: {
  item: FriendshipRecord;
  onOpenDm: (username: string) => void;
}) {
  return (
    <div className="rounded-[16px] border border-white/6 bg-white/[0.03] p-4">
      <Link
        href={buildUserProfileHref(item.otherUser.username)}
        className="identity-link flex-col items-start rounded-[14px]"
      >
        <UserAvatar
          user={item.otherUser}
          size="sm"
          className="h-[52px] w-[52px] text-[13px]"
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">
            {item.otherUser.profile.displayName}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-[#8a95a8]">
            @{item.otherUser.username}
          </p>
          <p
            className={cn(
              "mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium",
              item.otherUser.isOnline ? "text-[#31c878]" : "text-[#7f8a9c]",
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                item.otherUser.isOnline ? "bg-[#31c878]" : "bg-[#7d8798]",
              )}
            />
            {getCompactFriendStatus(item.otherUser)}
          </p>
        </div>
      </Link>

      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onOpenDm(item.otherUser.username)}
          className="h-9 flex-1 rounded-[12px] border-white/6 bg-white/[0.04] px-3.5 text-[13px] hover:bg-white/[0.06]"
        >
          <MessageSquareMore className="h-[16px] w-[16px]" />
          Написать
        </Button>
        <Link
          href={buildUserProfileHref(item.otherUser.username)}
          aria-label={`Открыть профиль ${item.otherUser.profile.displayName}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-white/6 bg-white/[0.04] text-[#9ca9bb] transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <Ellipsis className="h-4.5 w-4.5" />
        </Link>
      </div>
    </div>
  );
}

export function PeopleWorkspace({ viewer }: PeopleWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const realtimePresence = useOptionalRealtimePresence();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [friendships, setFriendships] = useState<FriendshipRecord[]>([]);
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [quickActionNotice, setQuickActionNotice] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [friendSortMode, setFriendSortMode] = useState<FriendSortMode>("name");
  const [friendDisplayMode, setFriendDisplayMode] =
    useState<FriendDisplayMode>("list");

  const rawView = searchParams.get("view");
  const activeView = peopleViews.some((item) => item.id === rawView)
    ? (rawView as PeopleView)
    : "friends";

  useEffect(() => {
    void refreshPanels();
  }, []);

  useEffect(() => {
    if (!quickActionNotice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setQuickActionNotice(null);
    }, 2800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [quickActionNotice]);

  const toLiveUser = useCallback(
    (user: PublicUser) => {
      if (realtimePresence === null) {
        return user;
      }

      return {
        ...user,
        isOnline: Boolean(realtimePresence[user.id]),
      };
    },
    [realtimePresence],
  );

  async function refreshPanels() {
    try {
      const [friendshipsPayload, blocksPayload] = await Promise.all([
        apiClientFetch("/v1/relationships/friends"),
        apiClientFetch("/v1/relationships/blocks"),
      ]);

      setFriendships(friendshipsResponseSchema.parse(friendshipsPayload).items);
      setBlocks(blocksResponseSchema.parse(blocksPayload).items);
      setPanelError(null);
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Не удалось загрузить людей.");
    }
  }

  async function refreshSearch(nextQuery = query) {
    const normalizedQuery = nextQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      setResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);

    try {
      const payload = await apiClientFetch(
        `/v1/users/search?query=${encodeURIComponent(normalizedQuery)}`,
      );
      setResults(userSearchResponseSchema.parse(payload).items);
      setSearchError(null);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Не удалось выполнить поиск.");
    } finally {
      setIsSearching(false);
    }
  }

  async function withAction(key: string, action: () => Promise<void>) {
    setActionKey(key);

    try {
      await action();
      await refreshPanels();
      await refreshSearch();
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Не удалось выполнить это действие.",
      );
    } finally {
      setActionKey(null);
    }
  }

  async function openDm(username: string) {
    setActionKey(`DM:${username}`);
    setSearchError(null);

    try {
      const payload = await apiClientFetch("/v1/direct-messages/open", {
        method: "POST",
        body: JSON.stringify({ username }),
      });

      const conversation =
        directConversationSummaryResponseSchema.parse(payload).conversation;
      router.push(`/app/messages/${conversation.id}`);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Не удалось открыть диалог.");
    } finally {
      setActionKey(null);
    }
  }

  function setView(nextView: PeopleView) {
    router.replace(`${pathname}?view=${nextView}`);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setView("discover");
    void refreshSearch();
  }

  function handleOpenDiscover() {
    setView("discover");
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 80);
  }

  async function handleCopyProfileLink() {
    const profileLink = `${window.location.origin}${buildUserProfileHref(viewer.username)}`;

    try {
      await navigator.clipboard.writeText(profileLink);
      setQuickActionNotice("Ссылка на профиль скопирована.");
    } catch {
      setQuickActionNotice("Не удалось скопировать ссылку.");
    }
  }

  function handleContactSync() {
    setQuickActionNotice("Синхронизация контактов появится в следующем обновлении.");
  }

  const friends = useMemo(
    () =>
      friendships
        .filter((item) => item.state === "ACCEPTED")
        .map((item) => ({
          ...item,
          otherUser: toLiveUser(item.otherUser),
        }))
        .sort((left, right) =>
          left.otherUser.profile.displayName.localeCompare(
            right.otherUser.profile.displayName,
            "ru",
          ),
        ),
    [friendships, toLiveUser],
  );

  const incoming = friendships
    .filter((item) => item.state === "INCOMING_REQUEST")
    .map((item) => ({
      ...item,
      otherUser: toLiveUser(item.otherUser),
    }));
  const outgoing = friendships
    .filter((item) => item.state === "OUTGOING_REQUEST")
    .map((item) => ({
      ...item,
      otherUser: toLiveUser(item.otherUser),
    }));

  const onlineFriendCount = friends.filter((item) => item.otherUser.isOnline).length;
  const pendingCount = incoming.length + outgoing.length;
  const activeViewMeta = peopleViewCopy[activeView];
  const suggestedResults = useMemo(
    () =>
      results.filter(
        (item) =>
          item.relationship.friendshipState !== "ACCEPTED" &&
          !item.relationship.isBlockedByViewer &&
          !item.relationship.hasBlockedViewer,
      ),
    [results],
  );
  const sortedFriends = useMemo(() => {
    const items = [...friends];

    items.sort((left, right) => {
      if (friendSortMode === "status" && left.otherUser.isOnline !== right.otherUser.isOnline) {
        return left.otherUser.isOnline ? -1 : 1;
      }

      return left.otherUser.profile.displayName.localeCompare(
        right.otherUser.profile.displayName,
        "ru",
      );
    });

    return items;
  }, [friends, friendSortMode]);

  const activityFriends = useMemo(
    () =>
      [...friends]
        .sort((left, right) => {
          if (left.otherUser.isOnline !== right.otherUser.isOnline) {
            return left.otherUser.isOnline ? -1 : 1;
          }

          return left.otherUser.profile.displayName.localeCompare(
            right.otherUser.profile.displayName,
            "ru",
          );
        })
        .slice(0, 4),
    [friends],
  );

  const activeCount =
    activeView === "friends"
      ? sortedFriends.length
      : activeView === "requests"
        ? pendingCount
        : activeView === "discover"
          ? results.length
          : activeView === "suggested"
            ? suggestedResults.length
            : blocks.length;
  const friendsGoal = 10;
  const friendGoalProgress = Math.min(
    100,
    Math.round((sortedFriends.length / friendsGoal) * 100),
  );

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0d151f] md:bg-[linear-gradient(180deg,rgba(255,255,255,0.012),transparent_14%),#0f1721]">
      <div className="absolute inset-0 hidden bg-[radial-gradient(circle_at_50%_15%,rgba(69,110,185,0.14),transparent_0%,transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.01),transparent_18%)] md:block" />

      <div className="relative flex h-full min-h-0 flex-col">
        <div className="border-b border-white/5 px-4 pb-0 pt-5 md:px-6 md:pt-6">
          <div className="md:hidden">
            <AppMobileTopNav active="people" />
          </div>

          <div className="mt-4 md:mt-0">
            <h1 className="text-[30px] font-semibold tracking-[-0.045em] text-white">
              {activeViewMeta.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#8d98aa]">
              {activeViewMeta.description}
            </p>
          </div>

          <div className="mt-5">
            <ViewTabs
              activeView={activeView}
              onSelect={setView}
              pendingCount={pendingCount}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1180px] px-4 py-4 md:px-6 md:py-5 xl:grid xl:grid-cols-[minmax(0,1fr)_278px] xl:gap-5">
            <div className="min-w-0">
              {panelError ? (
                <div className="mb-4 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {panelError}
                </div>
              ) : null}

              {searchError ? (
                <div className="mb-4 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {searchError}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={Users2}
                  iconClassName="bg-[#162235] text-[#6ea5ff]"
                  label="Друзья"
                  value={sortedFriends.length}
                  description={formatRussianCount(sortedFriends.length, "ваш друг", "ваших друга", "ваших друзей")}
                />
                <MetricCard
                  icon={ContactRound}
                  iconClassName="bg-[#13261f] text-[#32c978]"
                  label="В сети"
                  value={onlineFriendCount}
                  description="сейчас онлайн"
                />
                <MetricCard
                  icon={UserPlus2}
                  iconClassName="bg-[#2a2113] text-[#f3b35d]"
                  label="Заявки"
                  value={pendingCount}
                  description="ожидают ответа"
                />
                <MetricCard
                  icon={Ban}
                  iconClassName="bg-[#28161d] text-[#ff6a84]"
                  label="Блокировки"
                  value={blocks.length}
                  description="заблокировано"
                />
              </div>

              {activeView === "friends" ? (
                <div className="mt-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">
                        Ваши друзья
                      </h2>
                      <span className="text-[24px] font-semibold tracking-[-0.04em] text-[#9aa7b9]">
                        {sortedFriends.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFriendSortMode((current) =>
                            current === "name" ? "status" : "name",
                          )
                        }
                        className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-white/6 bg-white/[0.03] px-3 text-sm font-medium text-[#cfd8e4] transition-colors hover:bg-white/[0.05]"
                      >
                        <span>{sortLabels[friendSortMode]}</span>
                        <ChevronDown className="h-4 w-4 text-[#8a96a8]" />
                      </button>

                      <div className="inline-flex h-10 items-center rounded-[12px] border border-white/6 bg-white/[0.03] p-1">
                        <button
                          type="button"
                          onClick={() => setFriendDisplayMode("list")}
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-[9px] text-[#8a96a8] transition-colors",
                            friendDisplayMode === "list" &&
                              "bg-white/[0.06] text-white",
                          )}
                          aria-label="Список"
                          title="Список"
                        >
                          <List className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setFriendDisplayMode("grid")}
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-[9px] text-[#8a96a8] transition-colors",
                            friendDisplayMode === "grid" &&
                              "bg-white/[0.06] text-white",
                          )}
                          aria-label="Сетка"
                          title="Сетка"
                        >
                          <Grid2x2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <SectionCard className="mt-4">
                    {sortedFriends.length === 0 ? (
                      <EmptyView
                        icon={Users2}
                        title="Друзей пока нет"
                        description="Найдите кого-нибудь и отправьте заявку."
                      />
                    ) : friendDisplayMode === "list" ? (
                      <div>
                        {sortedFriends.map((item) => (
                          <FriendRow
                            key={item.id}
                            item={item}
                            onOpenDm={(username) => void openDm(username)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-3 p-4 sm:grid-cols-2">
                        {sortedFriends.map((item) => (
                          <FriendGridCard
                            key={item.id}
                            item={item}
                            onOpenDm={(username) => void openDm(username)}
                          />
                        ))}
                      </div>
                    )}
                  </SectionCard>

                  <div className="pt-5 text-center text-[12px] text-[#7b8697]">
                    {formatRussianCount(sortedFriends.length, "друг", "друга", "друзей")}
                  </div>
                </div>
              ) : null}

              {activeView === "requests" ? (
                <div className="mt-6 grid gap-3 xl:grid-cols-2">
                  <RequestPanel
                    title="Входящие заявки"
                    description="Новые люди, которые хотят добавить вас в контакты."
                    count={incoming.length}
                    icon={Inbox}
                    emptyTitle="Пока ничего нового"
                    emptyDescription="Новые входящие заявки появятся здесь, когда кто-то запросит контакт."
                  >
                    <CompactList>
                      {incoming.map((item) => {
                        const busyKey = `INCOMING_REQUEST:${item.otherUser.username}`;

                        return (
                          <RelationshipRow
                            key={item.id}
                            user={item.otherUser}
                            subtitle="Хочет добавить вас в контакты."
                            busy={actionKey === busyKey}
                            actions={
                              <>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    void withAction(busyKey, async () => {
                                      await apiClientFetch("/v1/relationships/friends/accept", {
                                        method: "POST",
                                        body: JSON.stringify({
                                          username: item.otherUser.username,
                                        }),
                                      });
                                    })
                                  }
                                  disabled={actionKey === busyKey}
                                  className="h-8 px-2.5"
                                >
                                  Принять
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    void withAction(busyKey, async () => {
                                      await apiClientFetch("/v1/relationships/friends/remove", {
                                        method: "POST",
                                        body: JSON.stringify({
                                          username: item.otherUser.username,
                                        }),
                                      });
                                    })
                                  }
                                  disabled={actionKey === busyKey}
                                  className="h-8 px-2.5"
                                >
                                  Отклонить
                                </Button>
                              </>
                            }
                          />
                        );
                      })}
                    </CompactList>
                  </RequestPanel>

                  <RequestPanel
                    title="Исходящие заявки"
                    description="Запросы, которые уже отправлены и ждут ответа."
                    count={outgoing.length}
                    icon={Send}
                    emptyTitle="Нет ожидающих запросов"
                    emptyDescription="Когда вы отправите новую заявку, она появится здесь до ответа."
                  >
                    <CompactList>
                      {outgoing.map((item) => {
                        const busyKey = `OUTGOING_REQUEST:${item.otherUser.username}`;

                        return (
                          <RelationshipRow
                            key={item.id}
                            user={item.otherUser}
                            subtitle="Ожидает ответа."
                            busy={actionKey === busyKey}
                            actions={
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  void withAction(busyKey, async () => {
                                    await apiClientFetch("/v1/relationships/friends/remove", {
                                      method: "POST",
                                      body: JSON.stringify({
                                        username: item.otherUser.username,
                                      }),
                                    });
                                  })
                                }
                                disabled={actionKey === busyKey}
                                className="h-8 px-2.5"
                              >
                                Отменить
                              </Button>
                            }
                          />
                        );
                      })}
                    </CompactList>
                  </RequestPanel>
                </div>
              ) : null}

              {activeView === "discover" ? (
                <div className="mt-6">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">
                        Поиск людей
                      </h2>
                      <p className="mt-1 text-sm text-[#8d98aa]">
                        Ищите по имени или никнейму и сразу переходите к действиям.
                      </p>
                    </div>

                    <form
                      className="flex w-full gap-2 md:max-w-[440px]"
                      onSubmit={handleSearchSubmit}
                    >
                      <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-white/6 bg-white/[0.04] px-3 text-[#9ca9bb] focus-within:border-[#3b6ed8]/32">
                        <Search size={17} strokeWidth={1.75} className="shrink-0" />
                        <input
                          ref={searchInputRef}
                          className="w-full border-0 bg-transparent p-0 text-[14px] text-white outline-none placeholder:text-[#7b8697]"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Поиск по имени или никнейму"
                          aria-label="Поиск по людям"
                          autoComplete="off"
                        />
                      </label>
                      <Button
                        type="submit"
                        disabled={isSearching}
                        className="h-11 rounded-[14px] px-4"
                      >
                        {isSearching ? "Ищем..." : "Найти"}
                      </Button>
                    </form>
                  </div>

                  <SectionCard>
                    <CompactListHeader className="px-4 py-3">
                      <span>Результаты</span>
                      <CompactListCount>{results.length}</CompactListCount>
                    </CompactListHeader>
                    {query.trim().length === 0 ? (
                      <EmptyView
                        icon={Search}
                        title="Поиск по нику"
                        description="Введите ник, чтобы найти людей."
                      />
                    ) : results.length === 0 ? (
                      <EmptyView
                        icon={Search}
                        title="Ничего не найдено"
                        description="Попробуйте другой ник."
                      />
                    ) : (
                      <CompactList>
                        {results.map((item) => {
                          const busyKey = `SEARCH:${item.user.username}`;
                          const friendshipState = item.relationship.friendshipState;
                          const liveUser = toLiveUser(item.user);

                          return (
                            <RelationshipRow
                              key={item.user.id}
                              user={liveUser}
                              subtitle={liveUser.profile.bio ?? "Описания пока нет."}
                              busy={actionKey === busyKey}
                              meta={
                                friendshipState === "ACCEPTED" ? (
                                  <CompactListCount>Друг</CompactListCount>
                                ) : item.relationship.isBlockedByViewer ? (
                                  <CompactListCount>Заблокирован</CompactListCount>
                                ) : null
                              }
                              actions={
                                item.relationship.isBlockedByViewer ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                      void withAction(busyKey, async () => {
                                        await apiClientFetch(
                                          "/v1/relationships/blocks/unblock",
                                          {
                                            method: "POST",
                                            body: JSON.stringify({
                                              username: item.user.username,
                                            }),
                                          },
                                        );
                                      })
                                    }
                                    disabled={actionKey === busyKey}
                                    className="h-8 px-2.5"
                                  >
                                    Разблокировать
                                  </Button>
                                ) : (
                                  <>
                                    {(friendshipState === "NONE" ||
                                      friendshipState === "REMOVED") && (
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          void withAction(busyKey, async () => {
                                            await apiClientFetch(
                                              "/v1/relationships/friends/request",
                                              {
                                                method: "POST",
                                                body: JSON.stringify({
                                                  username: item.user.username,
                                                }),
                                              },
                                            );
                                          })
                                        }
                                        disabled={
                                          actionKey === busyKey ||
                                          item.relationship.hasBlockedViewer
                                        }
                                        className="h-8 px-2.5"
                                      >
                                        <UserPlus2 className="h-[18px] w-[18px]" />
                                        Добавить
                                      </Button>
                                    )}
                                    {friendshipState === "INCOMING_REQUEST" && (
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          void withAction(busyKey, async () => {
                                            await apiClientFetch(
                                              "/v1/relationships/friends/accept",
                                              {
                                                method: "POST",
                                                body: JSON.stringify({
                                                  username: item.user.username,
                                                }),
                                              },
                                            );
                                          })
                                        }
                                        disabled={actionKey === busyKey}
                                        className="h-8 px-2.5"
                                      >
                                        Принять
                                      </Button>
                                    )}
                                    {(friendshipState === "OUTGOING_REQUEST" ||
                                      friendshipState === "ACCEPTED") && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() =>
                                          void withAction(busyKey, async () => {
                                            await apiClientFetch(
                                              "/v1/relationships/friends/remove",
                                              {
                                                method: "POST",
                                                body: JSON.stringify({
                                                  username: item.user.username,
                                                }),
                                              },
                                            );
                                          })
                                        }
                                        disabled={actionKey === busyKey}
                                        className="h-8 px-2.5"
                                      >
                                        Удалить
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => void openDm(item.user.username)}
                                      disabled={
                                        actionKey === busyKey ||
                                        item.relationship.hasBlockedViewer ||
                                        (!item.relationship.dmConversationId &&
                                          item.relationship.friendshipState !== "ACCEPTED")
                                      }
                                      className="h-8 px-2.5"
                                    >
                                      <MessageSquareMore className="h-[18px] w-[18px]" />
                                      {item.relationship.dmConversationId
                                        ? "Открыть чат"
                                        : "Написать"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() =>
                                        void withAction(busyKey, async () => {
                                          await apiClientFetch("/v1/relationships/blocks", {
                                            method: "POST",
                                            body: JSON.stringify({
                                              username: item.user.username,
                                            }),
                                          });
                                        })
                                      }
                                      disabled={actionKey === busyKey}
                                      className="h-8 px-2.5"
                                    >
                                      <ShieldBan className="h-[18px] w-[18px]" />
                                      Заблокировать
                                    </Button>
                                  </>
                                )
                              }
                            />
                          );
                        })}
                      </CompactList>
                    )}
                  </SectionCard>
                </div>
              ) : null}

              {activeView === "suggested" ? (
                <div className="mt-6">
                  <div className="mb-4">
                    <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">
                      Возможные друзья
                    </h2>
                    <p className="mt-1 text-sm text-[#8d98aa]">
                      Пока рекомендации строятся вокруг поиска и уже найденных людей.
                    </p>
                  </div>

                  <SectionCard>
                    <CompactListHeader className="px-4 py-3">
                      <span>Рекомендации</span>
                      <CompactListCount>{suggestedResults.length}</CompactListCount>
                    </CompactListHeader>
                    {suggestedResults.length === 0 ? (
                      <EmptyView
                        icon={UserPlus2}
                        title="Рекомендаций пока нет"
                        description="Попробуйте поиск по нику или откройте профиль интересующего человека."
                      />
                    ) : (
                      <CompactList>
                        {suggestedResults.map((item) => {
                          const busyKey = `SUGGESTED:${item.user.username}`;
                          const liveUser = toLiveUser(item.user);

                          return (
                            <RelationshipRow
                              key={item.user.id}
                              user={liveUser}
                              subtitle={liveUser.profile.bio ?? "Описания пока нет."}
                              busy={actionKey === busyKey}
                              actions={
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      void withAction(busyKey, async () => {
                                        await apiClientFetch(
                                          "/v1/relationships/friends/request",
                                          {
                                            method: "POST",
                                            body: JSON.stringify({
                                              username: item.user.username,
                                            }),
                                          },
                                        );
                                      })
                                    }
                                    disabled={
                                      actionKey === busyKey ||
                                      item.relationship.hasBlockedViewer
                                    }
                                    className="h-8 px-2.5"
                                  >
                                    <UserPlus2 className="h-[18px] w-[18px]" />
                                    Добавить
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => void openDm(item.user.username)}
                                    disabled={
                                      actionKey === busyKey ||
                                      item.relationship.hasBlockedViewer
                                    }
                                    className="h-8 px-2.5"
                                  >
                                    <MessageSquareMore className="h-[18px] w-[18px]" />
                                    Написать
                                  </Button>
                                </>
                              }
                            />
                          );
                        })}
                      </CompactList>
                    )}
                  </SectionCard>
                </div>
              ) : null}

              {activeView === "blocked" ? (
                <div className="mt-6">
                  <div className="mb-4">
                    <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">
                      Блокировки
                    </h2>
                    <p className="mt-1 text-sm text-[#8d98aa]">
                      Управление заблокированными аккаунтами и быстрый возврат доступа.
                    </p>
                  </div>

                  <SectionCard>
                    <CompactListHeader className="px-4 py-3">
                      <span>Заблокированные аккаунты</span>
                      <CompactListCount>{blocks.length}</CompactListCount>
                    </CompactListHeader>
                    {blocks.length === 0 ? (
                      <EmptyView
                        icon={ShieldBan}
                        title="Никто не заблокирован"
                        description="Заблокированные аккаунты появятся здесь."
                      />
                    ) : (
                      <CompactList>
                        {blocks.map((block) => {
                          const busyKey = `UNBLOCK:${block.blockedUser.username}`;
                          const liveUser = toLiveUser(block.blockedUser);

                          return (
                            <RelationshipRow
                              key={block.id}
                              user={liveUser}
                              subtitle="Сообщения и звонки заблокированы."
                              busy={actionKey === busyKey}
                              actions={
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    void withAction(busyKey, async () => {
                                      await apiClientFetch("/v1/relationships/blocks/unblock", {
                                        method: "POST",
                                        body: JSON.stringify({
                                          username: block.blockedUser.username,
                                        }),
                                      });
                                    })
                                  }
                                  disabled={actionKey === busyKey}
                                  className="h-8 px-2.5"
                                >
                                  Разблокировать
                                </Button>
                              }
                            />
                          );
                        })}
                      </CompactList>
                    )}
                  </SectionCard>
                </div>
              ) : null}

              {activeView !== "friends" ? (
                <div className="pb-2 pt-5 text-center text-[12px] text-[#7b8697]">
                  {activeCount} {activeViewMeta.countLabel}
                </div>
              ) : null}
            </div>

            <aside className="mt-6 grid gap-4 xl:mt-0 xl:content-start">
              <SidebarCard title="Быстрые действия" icon={Users2}>
                <div className="grid gap-2">
                  <QuickActionButton
                    icon={Search}
                    label="Найти людей"
                    description="Поиск по имени или никнейму"
                    onClick={handleOpenDiscover}
                  />
                  <QuickActionButton
                    icon={Share2}
                    label="Пригласить друзей"
                    description="Поделитесь ссылкой на профиль"
                    onClick={() => void handleCopyProfileLink()}
                  />
                  <QuickActionButton
                    icon={ContactRound}
                    label="Синхронизация контактов"
                    description="Найдите друзей из контактов"
                    onClick={handleContactSync}
                  />
                </div>
                {quickActionNotice ? (
                  <p className="mt-3 text-xs leading-5 text-[#8fa5c3]">
                    {quickActionNotice}
                  </p>
                ) : null}
              </SidebarCard>

              <SidebarCard title="Активность друзей" icon={Users2}>
                {activityFriends.length === 0 ? (
                  <div className="px-1 py-1 text-sm text-[#8d98aa]">
                    Друзья появятся здесь, когда вы добавите первые контакты.
                  </div>
                ) : (
                  <div className="grid gap-1">
                    {activityFriends.map((item) => (
                      <Link
                        key={item.id}
                        href={buildUserProfileHref(item.otherUser.username)}
                        className="flex items-center gap-3 rounded-[14px] px-2.5 py-2 transition-colors hover:bg-white/[0.04]"
                      >
                        <UserAvatar
                          user={item.otherUser}
                          size="sm"
                          className="h-9 w-9 text-[11px]"
                          showPresenceIndicator={false}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-white">
                            {item.otherUser.profile.displayName}
                          </p>
                          <p className="mt-0.5 truncate text-[12px] text-[#7f8a9c]">
                            {getActivityStatus(item.otherUser)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            item.otherUser.isOnline ? "bg-[#31c878]" : "bg-[#7d8798]",
                          )}
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </SidebarCard>

              <SidebarCard title="Советы" icon={Lightbulb}>
                <p className="text-sm leading-6 text-[#8d98aa]">
                  Добавляйте больше друзей, чтобы лента была интереснее и доступ к
                  перепискам был быстрее.
                </p>
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-[#cfd8e4]">
                    <span>{sortedFriends.length}/{friendsGoal} друзей</span>
                    <span>{friendGoalProgress}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-[#4a84ff] transition-[width] duration-300"
                      style={{ width: `${friendGoalProgress}%` }}
                    />
                  </div>
                </div>
              </SidebarCard>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
