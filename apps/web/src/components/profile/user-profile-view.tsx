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
  MessageSquareMore,
  ShieldAlert,
  ShieldBan,
  UserPlus2,
  UserRoundCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";

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
    return "Ваш публичный профиль";
  }

  if (relationship.isBlockedByViewer) {
    return "Вы скрыли контакт";
  }

  if (relationship.hasBlockedViewer) {
    return "Контакт ограничен";
  }

  switch (relationship.friendshipState) {
    case "ACCEPTED":
      return "У вас есть контакт";
    case "INCOMING_REQUEST":
      return "Ждёт подтверждения";
    case "OUTGOING_REQUEST":
      return "Запрос уже отправлен";
    default:
      return "Можно начать диалог";
  }
}

function getRelationshipNote(
  relationship: UserRelationshipSummary,
  isSelf: boolean,
) {
  if (isSelf) {
    return "Именно так ваш профиль выглядит в списках людей, ЛС и участниках хабов.";
  }

  if (relationship.isBlockedByViewer) {
    return "Сообщения, звонки и новые социальные действия отключены, пока вы не снимете блокировку.";
  }

  if (relationship.hasBlockedViewer) {
    return "Пользователь ограничил прямой контакт, поэтому переписка и заявки могут быть недоступны.";
  }

  switch (relationship.friendshipState) {
    case "ACCEPTED":
      return "Можно быстро открыть ЛС, продолжить общение или убрать контакт из списка друзей.";
    case "INCOMING_REQUEST":
      return "Вы уже получили заявку и можете принять её прямо из профиля.";
    case "OUTGOING_REQUEST":
      return "Запрос отправлен. Здесь можно отменить его и продолжить через личные сообщения.";
    default:
      return "Отсюда можно открыть ЛС, отправить заявку и быстро решить, нужен ли этот контакт дальше.";
  }
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
  const isSelf = viewer.id === user.id;

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
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить профиль.");
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
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть диалог.");
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
          className="h-10 w-full"
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
          className="h-10 w-full"
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
        className="h-10 w-full"
      >
        <UserPlus2 className="h-4 w-4" />
        Добавить в друзья
      </Button>
    );
  }

  return (
    <section className="h-full min-h-0 overflow-y-auto px-3 py-3">
      <div className="mx-auto grid max-w-[1040px] gap-3 xl:grid-cols-[minmax(0,1fr)_288px]">
        <div className="grid gap-3">
          <div className="social-shell rounded-[24px] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href="/app/people?view=discover"
                className="status-pill transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Люди
              </Link>
              <span className="status-pill">{getRelationshipLabel(relationship, isSelf)}</span>
            </div>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
              <UserAvatar user={user} size="lg" className="h-18 w-18 text-base" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[1.25rem] font-semibold tracking-[-0.04em] text-white">
                    {user.profile.displayName}
                  </h1>
                  <PresenceIndicator user={user} compact />
                </div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">@{user.username}</p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
                  {user.profile.bio?.trim() || "Пока без био, но профиль уже можно открыть и использовать как точку входа в общение."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="glass-badge">На платформе с {formatJoinedDate(user.createdAt)}</span>
                  {!isSelf && relationship.dmConversationId ? (
                    <span className="glass-badge">ЛС уже открыт</span>
                  ) : null}
                  {!isSelf && relationship.friendshipState === "ACCEPTED" ? (
                    <span className="glass-badge">В друзьях</span>
                  ) : null}
                  {relationship.isBlockedByViewer ? (
                    <span className="glass-badge">Заблокирован вами</span>
                  ) : null}
                  {relationship.hasBlockedViewer ? (
                    <span className="glass-badge">Ограничил контакт</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="premium-panel rounded-[24px] p-4 sm:p-5">
            <p className="section-kicker">Контекст</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
              {getRelationshipNote(relationship, isSelf)}
            </p>

            {(relationship.hasBlockedViewer || relationship.isBlockedByViewer) && !isSelf ? (
              <div className="mt-4 rounded-[16px] border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-sm text-amber-50">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {relationship.isBlockedByViewer
                      ? "Сейчас это скрытый контакт. Снимите блокировку, если хотите вернуть сообщения и заявки."
                      : "Этот пользователь ограничил прямой контакт, поэтому часть быстрых действий может быть недоступна."}
                  </span>
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-4 rounded-[16px] border border-rose-400/20 bg-rose-400/10 px-3 py-3 text-sm text-rose-100">
                {errorMessage}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="grid gap-3">
          <div className="premium-panel rounded-[24px] p-4">
            <p className="section-kicker">Быстрые действия</p>
            <div className="mt-3 grid gap-2">
              {isSelf ? (
                <Link
                  href="/app/settings/profile"
                  className={buttonVariants({ className: "h-10 w-full" })}
                >
                  Редактировать профиль
                </Link>
              ) : (
                <>
                  <Button
                    onClick={() => void openDm()}
                    disabled={actionKey !== null || relationship.hasBlockedViewer}
                    className="h-10 w-full"
                  >
                    <MessageSquareMore className="h-4 w-4" />
                    {relationship.dmConversationId ? "Открыть ЛС" : "Написать"}
                  </Button>
                  {renderFriendAction()}
                  <Button
                    variant={relationship.isBlockedByViewer ? "secondary" : "destructive"}
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
                    className="h-10 w-full"
                  >
                    <ShieldBan className="h-4 w-4" />
                    {relationship.isBlockedByViewer ? "Снять блок" : "Заблокировать"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
