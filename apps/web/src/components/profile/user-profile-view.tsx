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
  MessageSquareMore,
  ShieldAlert,
  ShieldBan,
  UserPlus2,
  UserRoundCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { AvatarPreviewModal } from "@/components/ui/avatar-preview-modal";
import { Button, buttonVariants } from "@/components/ui/button";
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

function SurfaceCard({
  title,
  kicker,
  children,
  className,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[20px] border border-[var(--border)] bg-black",
        className,
      )}
    >
      <div className="border-b border-[var(--border-soft)] px-4 py-3.5">
        {kicker ? (
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {kicker}
          </p>
        ) : null}
        <h2 className={cn("text-[17px] font-semibold tracking-[-0.03em] text-white", kicker && "mt-1")}>
          {title}
        </h2>
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function MetaPill({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--border-soft)] bg-black px-3 text-[12px] text-[var(--text-soft)]">
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
    <div className="rounded-[14px] border border-[var(--border-soft)] bg-[var(--bg-panel-muted)] px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </p>
      <div className="mt-1.5 text-sm font-medium text-white">{value}</div>
    </div>
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
      <section className="h-full min-h-0 overflow-y-auto px-3 py-3 sm:px-4">
        <div className="mx-auto grid max-w-[1120px] gap-3 xl:grid-cols-[minmax(0,1fr)_296px]">
          <div className="grid gap-3">
            <section className="overflow-hidden rounded-[22px] border border-[var(--border)] bg-black">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3.5">
                <Link
                  href="/app/people?view=discover"
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--border-soft)] bg-black px-3 text-sm text-[var(--text-soft)] transition-colors hover:border-[var(--border-strong)] hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Люди
                </Link>

                <MetaPill>{getRelationshipLabel(relationship, isSelf)}</MetaPill>
              </div>

              <div className="grid gap-4 px-4 py-4 md:px-5 md:py-5 lg:grid-cols-[96px_minmax(0,1fr)]">
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
                      className="h-[88px] w-[88px] text-[1.25rem]"
                    />
                    <span className="pointer-events-none absolute inset-x-1/2 bottom-1.5 -translate-x-1/2 rounded-full border border-white/10 bg-black px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      Просмотр
                    </span>
                  </button>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="truncate text-[1.5rem] font-semibold tracking-[-0.04em] text-white md:text-[1.7rem]">
                      {user.profile.displayName}
                    </h1>
                    <PresenceIndicator user={user} compact />
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--text-dim)]">
                    <span>@{user.username}</span>
                    <span>•</span>
                    <span>{availabilityLabel}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <MetaPill>
                      <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
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
                    {user.profile.bio?.trim() ||
                      "Короткого описания пока нет, но профиль уже готов для быстрого перехода к общению."}
                  </p>

                  {errorMessage ? (
                    <div className="mt-4 rounded-[16px] border border-rose-400/20 bg-rose-400/10 px-3.5 py-3 text-sm text-rose-100">
                      {errorMessage}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
              <SurfaceCard title="Контекст" kicker="Общение">
                <p className="text-sm leading-6 text-[var(--text-soft)]">
                  {getRelationshipNote(relationship, isSelf)}
                </p>

                {(relationship.hasBlockedViewer || relationship.isBlockedByViewer) &&
                !isSelf ? (
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
              </SurfaceCard>

              <SurfaceCard title="Сводка" kicker="Профиль">
                <div className="grid gap-2.5">
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
                  <SummaryRow
                    label="Контакт"
                    value={getRelationshipLabel(relationship, isSelf)}
                  />
                </div>
              </SurfaceCard>
            </div>
          </div>

          <aside className="grid gap-3 xl:content-start">
            <SurfaceCard title="Действия" kicker="Управление">
              <div className="grid gap-2.5">
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
            </SurfaceCard>

            <SurfaceCard title="Сейчас" kicker="Статус">
              <div className="grid gap-2.5">
                <SummaryRow label="Присутствие" value={availabilityLabel} />
                <SummaryRow
                  label="Режим"
                  value={
                    isSelf
                      ? "Ваш профиль"
                      : relationship.friendshipState === "ACCEPTED"
                        ? "Активный контакт"
                        : "Просмотр профиля"
                  }
                />
              </div>
            </SurfaceCard>
          </aside>
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
