"use client";

import Link from "next/link";
import { Crown, LockKeyhole, Sparkles, UsersRound, Waves } from "lucide-react";
import {
  hubShellResponseSchema,
  type HubMemberRole,
  type HubShell,
} from "@lobby/shared";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";
import { buildHubLobbyHref } from "@/lib/hub-routes";

const roleLabels: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MODERATOR: "Модератор",
  MEMBER: "Участник",
};

const lobbyTypeLabels: Record<string, string> = {
  TEXT: "Текст",
  VOICE: "Голос",
  FORUM: "Форум",
};

interface HubOverviewProps {
  hubId: string;
}
const assignableRoles: HubMemberRole[] = ["ADMIN", "MODERATOR", "MEMBER"];

export function HubOverview({ hubId }: HubOverviewProps) {
  const [hub, setHub] = useState<HubShell["hub"] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const [lobbyName, setLobbyName] = useState("");
  const [lobbyDescription, setLobbyDescription] = useState("");
  const [lobbyType, setLobbyType] = useState<"TEXT" | "VOICE" | "FORUM">(
    "TEXT",
  );
  const [privateLobby, setPrivateLobby] = useState(false);
  const [allowedUsernames, setAllowedUsernames] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, HubMemberRole>>(
    {},
  );

  const loadHub = useCallback(async () => {
    try {
      const payload = await apiClientFetch(`/v1/hubs/${hubId}`);
      const parsed = hubShellResponseSchema.parse(payload);
      setHub(parsed.hub);
      setRoleDrafts(
        Object.fromEntries(
          parsed.hub.members.map((member) => [
            member.user.username,
            member.role,
          ]),
        ),
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить хаб",
      );
    }
  }, [hubId]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  async function withAction(key: string, action: () => Promise<void>) {
    setActionKey(key);
    try {
      await action();
      await loadHub();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка действия в хабе",
      );
    } finally {
      setActionKey(null);
    }
  }

  if (errorMessage)
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  if (!hub)
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[#0b1322]/70 p-4 text-sm text-[var(--text-dim)]">
        Загружаем хаб...
      </div>
    );

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <span className="eyebrow-pill">
            <Sparkles className="h-3.5 w-3.5" /> Пространство хаба
          </span>
          <CardTitle>{hub.name}</CardTitle>
          <CardDescription>
            {hub.description ?? "Описание хаба пока не заполнено."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="metric-tile rounded-[24px] p-4">
            <p className="section-kicker">Роль</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-medium text-white">
              <Crown className="h-4 w-4 text-[var(--accent)]" />
              {hub.membershipRole
                ? (roleLabels[hub.membershipRole] ?? hub.membershipRole)
                : "Гость"}
            </p>
          </div>
          <div className="metric-tile rounded-[24px] p-4">
            <p className="section-kicker">Приватность</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-medium text-white">
              <LockKeyhole className="h-4 w-4 text-[var(--accent)]" />
              {hub.isPrivate ? "Приватный" : "Обычный"}
            </p>
          </div>
          <div className="metric-tile rounded-[24px] p-4">
            <p className="section-kicker">Участники</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-medium text-white">
              <UsersRound className="h-4 w-4 text-[var(--accent)]" />
              {hub.members.length}
            </p>
          </div>
          <div className="metric-tile rounded-[24px] p-4">
            <p className="section-kicker">Ограничение</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-medium text-white">
              <Waves className="h-4 w-4 text-[var(--accent)]" />
              {hub.isViewerMuted ? "Да" : "Нет"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Лобби</CardTitle>
            <CardDescription>
              Текстовые, голосовые и форумные пространства внутри хаба.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hub.lobbies.length === 0 ? (
              <div className="surface-subtle rounded-[24px] p-4 text-sm text-[var(--text-muted)]">
                Пока нет доступных лобби.
              </div>
            ) : (
              hub.lobbies.map((lobby) => (
                <Link
                  key={lobby.id}
                  href={buildHubLobbyHref(hub.id, lobby.id, lobby.type)}
                  className="list-row block rounded-[26px] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-medium text-white">
                        {lobby.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-dim)]">
                        {lobby.description ?? "Описание не задано"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="glass-badge">
                        {lobbyTypeLabels[lobby.type] ?? lobby.type}
                      </span>
                      {lobby.isPrivate ? (
                        <span className="glass-badge">Приватное</span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))
            )}

            {hub.permissions.canCreateLobby ? (
              <form
                className="surface-subtle space-y-3 rounded-[26px] p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void withAction("create-lobby", async () => {
                    await apiClientFetch(`/v1/hubs/${hub.id}/lobbies`, {
                      method: "POST",
                      body: JSON.stringify({
                        name: lobbyName,
                        description: lobbyDescription || null,
                        type: lobbyType,
                        isPrivate: privateLobby,
                        allowedUsernames: allowedUsernames
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      }),
                    });
                    setLobbyName("");
                    setLobbyDescription("");
                    setLobbyType("TEXT");
                    setPrivateLobby(false);
                    setAllowedUsernames("");
                  });
                }}
              >
                <p className="text-sm font-medium text-white">Создать лобби</p>
                <Input
                  value={lobbyName}
                  onChange={(event) => setLobbyName(event.target.value)}
                  placeholder="Название лобби"
                />
                <Input
                  value={lobbyDescription}
                  onChange={(event) => setLobbyDescription(event.target.value)}
                  placeholder="Описание лобби"
                />
                <select
                  value={lobbyType}
                  onChange={(event) =>
                    setLobbyType(
                      event.target.value as "TEXT" | "VOICE" | "FORUM",
                    )
                  }
                  className="field-select text-sm"
                >
                  <option value="TEXT">Текстовое</option>
                  <option value="VOICE">Голосовое</option>
                  <option value="FORUM">Форум</option>
                </select>
                <label className="surface-card flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    checked={privateLobby}
                    onChange={(event) => setPrivateLobby(event.target.checked)}
                  />
                  Приватное лобби
                </label>
                {privateLobby ? (
                  <Input
                    value={allowedUsernames}
                    onChange={(event) =>
                      setAllowedUsernames(event.target.value)
                    }
                    placeholder="разрешённые username через запятую"
                  />
                ) : null}
                <Button type="submit" disabled={actionKey === "create-lobby"}>
                  {actionKey === "create-lobby" ? "Создаём..." : "Создать"}
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          {hub.permissions.canInviteMembers ? (
            <Card>
              <CardHeader>
                <CardTitle>Приглашения</CardTitle>
                <CardDescription>
                  Приглашайте участников с учётом правил блокировок.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void withAction("invite-member", async () => {
                      await apiClientFetch(`/v1/hubs/${hub.id}/invites`, {
                        method: "POST",
                        body: JSON.stringify({
                          username: inviteUsername,
                          expiresAt: null,
                        }),
                      });
                      setInviteUsername("");
                    });
                  }}
                >
                  <Input
                    value={inviteUsername}
                    onChange={(event) => setInviteUsername(event.target.value)}
                    placeholder="username"
                  />
                  <Button
                    type="submit"
                    disabled={actionKey === "invite-member"}
                  >
                    Пригласить
                  </Button>
                </form>
                {hub.pendingInvites.length === 0 ? (
                  <p className="surface-subtle rounded-[22px] p-3 text-sm text-[var(--text-muted)]">
                    Нет ожидающих приглашений.
                  </p>
                ) : (
                  hub.pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="list-row rounded-[22px] p-3"
                    >
                      <p className="text-sm font-medium text-white">
                        {invite.invitee.profile.displayName}
                      </p>
                      <p className="font-mono text-xs text-[var(--text-soft)]">
                        @{invite.invitee.username}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Участники</CardTitle>
              <CardDescription>
                Роли и действия модерации с проверками на backend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {hub.members.map((member) => {
                const roleDraft =
                  roleDrafts[member.user.username] ?? member.role;
                return (
                  <div key={member.id} className="list-row rounded-[24px] p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-base font-medium text-white">
                          {member.user.profile.displayName}
                        </p>
                        <p className="font-mono text-xs text-[var(--text-soft)]">
                          @{member.user.username}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="glass-badge">{member.role}</span>
                        {hub.permissions.canManageHub && member.canManage ? (
                          <>
                            <select
                              value={roleDraft}
                              onChange={(event) =>
                                setRoleDrafts((current) => ({
                                  ...current,
                                  [member.user.username]: event.target
                                    .value as HubMemberRole,
                                }))
                              }
                              className="field-select min-h-[38px] px-3 text-xs"
                            >
                              {assignableRoles.map((role) => (
                                <option key={role} value={role}>
                                  {roleLabels[role] ?? role}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void withAction(
                                  `role:${member.user.username}`,
                                  async () => {
                                    await apiClientFetch(
                                      `/v1/hubs/${hub.id}/members/role`,
                                      {
                                        method: "PATCH",
                                        body: JSON.stringify({
                                          username: member.user.username,
                                          role: roleDraft,
                                        }),
                                      },
                                    );
                                  },
                                )
                              }
                              disabled={
                                actionKey === `role:${member.user.username}`
                              }
                            >
                              Сохранить роль
                            </Button>
                          </>
                        ) : null}
                        {hub.permissions.canManageMembers &&
                        member.canManage ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void withAction(
                                  `kick:${member.user.username}`,
                                  async () => {
                                    await apiClientFetch(
                                      `/v1/hubs/${hub.id}/members/kick`,
                                      {
                                        method: "POST",
                                        body: JSON.stringify({
                                          username: member.user.username,
                                        }),
                                      },
                                    );
                                  },
                                )
                              }
                            >
                              Исключить
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void withAction(
                                  `mute:${member.user.username}`,
                                  async () => {
                                    await apiClientFetch(
                                      `/v1/hubs/${hub.id}/mutes`,
                                      {
                                        method: "POST",
                                        body: JSON.stringify({
                                          username: member.user.username,
                                          expiresAt: null,
                                        }),
                                      },
                                    );
                                  },
                                )
                              }
                            >
                              Ограничить
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                void withAction(
                                  `ban:${member.user.username}`,
                                  async () => {
                                    await apiClientFetch(
                                      `/v1/hubs/${hub.id}/bans`,
                                      {
                                        method: "POST",
                                        body: JSON.stringify({
                                          username: member.user.username,
                                          reason: null,
                                        }),
                                      },
                                    );
                                  },
                                )
                              }
                            >
                              Заблокировать
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {(hub.activeMutes.length > 0 || hub.activeBans.length > 0) &&
          hub.permissions.canManageMembers ? (
            <Card>
              <CardHeader>
                <CardTitle>Ограничения</CardTitle>
                <CardDescription>
                  Активные мьюты и блокировки в текущем хабе.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white">
                    Активные ограничения
                  </p>
                  {hub.activeMutes.length === 0 ? (
                    <p className="surface-subtle rounded-[22px] p-3 text-sm text-[var(--text-muted)]">
                      Нет ограничений.
                    </p>
                  ) : (
                    hub.activeMutes.map((mute) => (
                      <div
                        key={mute.id}
                        className="list-row rounded-[22px] p-3"
                      >
                        <p className="text-sm font-medium text-white">
                          {mute.user.profile.displayName}
                        </p>
                        <p className="font-mono text-xs text-[var(--text-soft)]">
                          @{mute.user.username}
                        </p>
                        <Button
                          className="mt-2"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void withAction(
                              `unmute:${mute.user.username}`,
                              async () => {
                                await apiClientFetch(
                                  `/v1/hubs/${hub.id}/mutes/revoke`,
                                  {
                                    method: "POST",
                                    body: JSON.stringify({
                                      username: mute.user.username,
                                    }),
                                  },
                                );
                              },
                            )
                          }
                        >
                          Снять ограничение
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-white">
                    Активные блокировки
                  </p>
                  {hub.activeBans.length === 0 ? (
                    <p className="surface-subtle rounded-[22px] p-3 text-sm text-[var(--text-muted)]">
                      Нет блокировок.
                    </p>
                  ) : (
                    hub.activeBans.map((ban) => (
                      <div key={ban.id} className="list-row rounded-[22px] p-3">
                        <p className="text-sm font-medium text-white">
                          {ban.user.profile.displayName}
                        </p>
                        <p className="font-mono text-xs text-[var(--text-soft)]">
                          @{ban.user.username}
                        </p>
                        <Button
                          className="mt-2"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void withAction(
                              `unban:${ban.user.username}`,
                              async () => {
                                await apiClientFetch(
                                  `/v1/hubs/${hub.id}/bans/revoke`,
                                  {
                                    method: "POST",
                                    body: JSON.stringify({
                                      username: ban.user.username,
                                    }),
                                  },
                                );
                              },
                            )
                          }
                        >
                          Разблокировать
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
