"use client";

import Link from "next/link";
import {
  directConversationSummaryResponseSchema,
  userResponseSchema,
  userSearchResponseSchema,
  type PublicUser,
  type UserRelationshipSummary,
} from "@lobby/shared";
import {
  ArrowLeft,
  CalendarDays,
  House,
  Layers3,
  MessageSquareMore,
  Settings2,
  ShieldAlert,
  ShieldBan,
  UserPlus2,
  UserRoundCheck,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { AppMobileTopNav } from "@/components/app/app-mobile-top-nav";
import { AvatarPreviewModal } from "@/components/ui/avatar-preview-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { CompactListCount } from "@/components/ui/compact-list";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { getAvailabilityLabel } from "@/lib/last-seen";
import { cn } from "@/lib/utils";

interface UserProfileViewProps {
  viewer: PublicUser;
  initialUser: PublicUser;
  initialRelationship: UserRelationshipSummary;
}

const navIconProps = { size: 17, strokeWidth: 1.75 } as const;

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

function formatJoinedDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-2.5 text-center">
      <p className="truncate text-[15px] font-semibold leading-none tracking-[-0.04em] text-white">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  meta,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 rounded-[16px] px-2.5 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/8 bg-white/[0.03] text-white">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{label}</span>
        {meta ? (
          <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
            {meta}
          </span>
        ) : null}
      </span>
    </Link>
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
  const isSelf = viewer.id === user.id;
  const availabilityLabel = useMemo(
    () => getAvailabilityLabel(user) ?? "Не в сети",
    [user],
  );
  const relationshipLabel = getRelationshipLabel(relationship, isSelf);
  const profileModeLabel = isSelf
    ? "Ваш профиль"
    : relationship.friendshipState === "ACCEPTED"
      ? "Активный контакт"
      : "Просмотр профиля";
  const contactStatLabel = isSelf
    ? "Вы"
    : relationship.friendshipState === "ACCEPTED"
      ? "Друг"
      : relationship.friendshipState === "INCOMING_REQUEST" ||
          relationship.friendshipState === "OUTGOING_REQUEST"
        ? "Заявка"
        : "Новый";
  const hasContactLimit =
    relationship.isBlockedByViewer || relationship.hasBlockedViewer;
  const accessLabel = hasContactLimit ? "Ограничен" : "Открыт";
  const dmStateLabel = relationship.dmConversationId ? "Открыт" : "Нет";
  const bioText =
    user.profile.bio?.trim() ||
    "Короткого описания пока нет, но профиль уже готов для быстрого перехода к общению.";

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
          <div className="grid min-h-full w-full gap-3 px-3 py-3 md:px-5 md:py-5 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
            <aside className="grid content-start gap-3">
              <Panel className="px-4 py-5 text-center">
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
                <PresenceIndicator
                  user={user}
                  compact
                  className="mx-auto mt-3 w-fit justify-center"
                />
                <p className="mx-auto mt-3 line-clamp-3 max-w-[220px] text-xs leading-5 text-[var(--text-dim)]">
                  {bioText}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <StatTile label="Контакт" value={contactStatLabel} />
                  <StatTile label="ЛС" value={dmStateLabel} />
                  <StatTile label="Доступ" value={accessLabel} />
                </div>
              </Panel>

              <Panel>
                <div className="grid gap-1 p-2">
                  {quickLinks.map((item) => {
                    const Icon = item.icon;
                    const active = item.href === "/app/people";

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex min-h-10 items-center gap-3 rounded-[14px] px-3 text-sm font-medium transition-colors",
                          active
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
                <PanelHeader title="Переходы" />
                <div className="grid gap-1 p-2">
                  <SidebarLink
                    href="/app/people?view=discover"
                    icon={ArrowLeft}
                    label="К списку людей"
                    meta="Поиск и контакты"
                  />
                  <SidebarLink
                    href="/app/messages"
                    icon={MessageSquareMore}
                    label="Диалоги"
                    meta="Личные сообщения"
                  />
                  <SidebarLink
                    href="/app/settings/profile"
                    icon={Settings2}
                    label="Мой профиль"
                    meta={`@${viewer.username}`}
                  />
                </div>
              </Panel>
            </aside>

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

              <Panel className="p-4 md:p-5">
                <div className="grid gap-4 lg:grid-cols-[112px_minmax(0,1fr)]">
                  <div className="relative mx-auto lg:mx-0">
                    <button
                      type="button"
                      onClick={() => setIsAvatarPreviewOpen(true)}
                      className="group relative inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      aria-label="Открыть фото профиля"
                    >
                      <UserAvatar
                        user={user}
                        size="lg"
                        showPresenceIndicator={false}
                        className="h-24 w-24 text-[1.35rem]"
                      />
                      <span className="pointer-events-none absolute inset-x-1/2 bottom-1.5 -translate-x-1/2 rounded-full border border-white/10 bg-black px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        Просмотр
                      </span>
                    </button>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="truncate text-[1.55rem] font-semibold tracking-[-0.04em] text-white md:text-[1.75rem]">
                        {user.profile.displayName}
                      </h1>
                      <PresenceIndicator user={user} compact />
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--text-dim)]">
                      <span>@{user.username}</span>
                      <span className="text-[var(--text-muted)]">/</span>
                      <span>{availabilityLabel}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <MetaPill>
                        <CalendarDays className="h-3.5 w-3.5" />
                        С {formatJoinedDate(user.createdAt)}
                      </MetaPill>
                      {!isSelf && relationship.dmConversationId ? (
                        <MetaPill>ЛС уже открыт</MetaPill>
                      ) : null}
                      {!isSelf && relationship.friendshipState === "ACCEPTED" ? (
                        <MetaPill>В друзьях</MetaPill>
                      ) : null}
                      {relationship.isBlockedByViewer ? (
                        <MetaPill>Заблокирован вами</MetaPill>
                      ) : null}
                      {relationship.hasBlockedViewer ? (
                        <MetaPill>Ограничил контакт</MetaPill>
                      ) : null}
                    </div>

                    <p className="mt-3 max-w-[64ch] text-sm leading-6 text-[var(--text-soft)]">
                      {bioText}
                    </p>

                    {errorMessage ? (
                      <div className="mt-4 rounded-[16px] border border-red-400/20 bg-red-400/10 px-3.5 py-3 text-sm text-red-100">
                        {errorMessage}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Panel>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
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

                <Panel>
                  <PanelHeader
                    title="Сводка"
                    action={<CompactListCount>Профиль</CompactListCount>}
                  />
                  <div className="grid gap-2.5 p-4">
                    <SummaryRow label="Ник" value={`@${user.username}`} />
                    <SummaryRow
                      label="Статус"
                      value={
                        <div className="inline-flex items-center gap-2">
                          <PresenceIndicator user={user} compact />
                          <span>{availabilityLabel}</span>
                        </div>
                      }
                    />
                    <SummaryRow
                      label="На платформе"
                      value={formatJoinedDate(user.createdAt)}
                    />
                    <SummaryRow label="Контакт" value={relationshipLabel} />
                  </div>
                </Panel>
              </div>
            </main>

            <aside className="grid content-start gap-3">
              <Panel>
                <PanelHeader
                  title="Действия"
                  action={<CompactListCount>Управление</CompactListCount>}
                />
                <div className="grid gap-2.5 p-4">
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
                          (!relationship.dmConversationId &&
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

              <Panel>
                <PanelHeader
                  title="Сейчас"
                  action={<CompactListCount>Статус</CompactListCount>}
                />
                <div className="grid gap-2.5 p-4">
                  <SummaryRow label="Присутствие" value={availabilityLabel} />
                  <SummaryRow label="Режим" value={profileModeLabel} />
                </div>
              </Panel>

              <Panel>
                <PanelHeader
                  title="Связь"
                  action={<CompactListCount>Контакт</CompactListCount>}
                />
                <div className="grid gap-2.5 p-4">
                  <SummaryRow label="Личные сообщения" value={dmStateLabel} />
                  <SummaryRow label="Доступ" value={accessLabel} />
                  <SummaryRow label="Состояние" value={relationshipLabel} />
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
