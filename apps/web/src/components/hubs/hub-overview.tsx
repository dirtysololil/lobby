"use client";

import Link from "next/link";
import { LockKeyhole, UsersRound, Waves } from "lucide-react";
import {
  hubShellResponseSchema,
  type HubMemberRole,
  type HubShell,
} from "@lobby/shared";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { buildHubLobbyHref } from "@/lib/hub-routes";

const roleLabels: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MODERATOR: "Модератор",
  MEMBER: "Участник",
};

const lobbyTypeLabels: Record<string, string> = {
  TEXT: "Text",
  VOICE: "Voice",
  FORUM: "Forum",
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
          parsed.hub.members.map((member) => [member.user.username, member.role]),
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

  if (errorMessage) {
    return (
      <div className="rounded-[16px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="rounded-[18px] border border-[var(--border)] bg-white/[0.03] p-4 text-sm text-[var(--text-dim)]">
        Загружаем хаб...
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="social-shell rounded-[20px] p-3">
        <div className="compact-toolbar">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <Waves className="h-3.5 w-3.5" />
                Hub
              </span>
              <span className="status-pill">
                {hub.membershipRole
                  ? roleLabels[hub.membershipRole] ?? hub.membershipRole
                  : "Гость"}
              </span>
              {hub.isPrivate ? (
                <span className="status-pill">
                  <LockKeyhole className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Private
                </span>
              ) : null}
              <span className="status-pill">
                <UsersRound className="h-3.5 w-3.5 text-[var(--accent)]" />
                {hub.members.length} members
              </span>
            </div>
            <h1 className="mt-1.5 font-[var(--font-heading)] text-[1.18rem] font-semibold tracking-[-0.04em] text-white">
              {hub.name}
            </h1>
            <p className="mt-1 truncate text-sm text-[var(--text-dim)]">
              {hub.description ?? "Без описания"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-3">
          <div className="premium-panel rounded-[20px] p-3">
            <div className="compact-toolbar px-1">
              <p className="section-kicker">Channels</p>
              <span className="glass-badge">{hub.lobbies.length}</span>
            </div>
            <div className="mt-2 grid gap-2">
              {hub.lobbies.length === 0 ? (
                <EmptyState
                  title="Нет доступных каналов"
                  description="Создайте первое лобби."
                />
              ) : (
                hub.lobbies.map((lobby) => (
                  <Link
                    key={lobby.id}
                    href={buildHubLobbyHref(hub.id, lobby.id, lobby.type)}
                    className="list-row rounded-[16px] px-3 py-2.5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="dock-icon flex h-9 w-9 items-center justify-center rounded-[12px] text-[10px] font-semibold text-white">
                        {lobby.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">
                            {lobby.name}
                          </p>
                          <span className="glass-badge">
                            {lobbyTypeLabels[lobby.type] ?? lobby.type}
                          </span>
                          {lobby.isPrivate ? (
                            <span className="glass-badge">Private</span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-[var(--text-dim)]">
                          {lobby.description ?? lobby.type}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {hub.permissions.canCreateLobby ? (
            <div className="premium-panel rounded-[20px] p-3.5">
              <div className="compact-toolbar">
                <div>
                  <p className="section-kicker">Create lobby</p>
                </div>
              </div>

              <form
                className="mt-3 grid gap-2.5"
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
                          .map((value) => value.trim())
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
                <Input
                  value={lobbyName}
                  onChange={(event) => setLobbyName(event.target.value)}
                  placeholder="Название лобби"
                />
                <Input
                  value={lobbyDescription}
                  onChange={(event) => setLobbyDescription(event.target.value)}
                  placeholder="Описание"
                />
                <select
                  value={lobbyType}
                  onChange={(event) =>
                    setLobbyType(event.target.value as "TEXT" | "VOICE" | "FORUM")
                  }
                  className="field-select text-sm"
                >
                  <option value="TEXT">Текстовое</option>
                  <option value="VOICE">Голосовое</option>
                  <option value="FORUM">Форум</option>
                </select>
                <label className="field-checkbox text-sm">
                  <input
                    type="checkbox"
                    checked={privateLobby}
                    onChange={(event) => setPrivateLobby(event.target.checked)}
                  />
                  Private lobby
                </label>
                {privateLobby ? (
                  <Input
                    value={allowedUsernames}
                    onChange={(event) => setAllowedUsernames(event.target.value)}
                    placeholder="разрешенные username через запятую"
                  />
                ) : null}
                <Button
                  type="submit"
                  disabled={actionKey === "create-lobby"}
                  className="w-full"
                >
                  {actionKey === "create-lobby" ? "Создаем..." : "Создать лобби"}
                </Button>
              </form>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          {hub.permissions.canInviteMembers ? (
            <div className="premium-panel rounded-[20px] p-3.5">
              <div className="compact-toolbar">
                <div>
                  <p className="section-kicker">Invite member</p>
                </div>
                <span className="glass-badge">{hub.pendingInvites.length} pending</span>
              </div>

              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
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
                <Button type="submit" disabled={actionKey === "invite-member"}>
                  Invite
                </Button>
              </form>

              <div className="mt-3 grid gap-2">
                {hub.pendingInvites.length === 0 ? (
                  <div className="surface-subtle rounded-[16px] px-3 py-3 text-sm text-[var(--text-muted)]">
                    Нет ожидающих приглашений.
                  </div>
                ) : (
                  hub.pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="list-row rounded-[16px] px-3 py-2.5 text-sm"
                    >
                      <p className="font-semibold text-white">
                        {invite.invitee.profile.displayName}
                      </p>
                      <p className="mt-1 text-[var(--text-dim)]">
                        @{invite.invitee.username}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div className="premium-panel rounded-[20px] p-3">
            <div className="compact-toolbar px-1">
              <p className="section-kicker">Members</p>
              <span className="glass-badge">{hub.members.length}</span>
            </div>

            <div className="mt-2 grid gap-2">
              {hub.members.map((member) => {
                const roleDraft = roleDrafts[member.user.username] ?? member.role;

                return (
                  <div key={member.id} className="list-row rounded-[16px] px-3 py-2.5">
                    <div className="flex items-start gap-3">
                      <UserAvatar user={member.user} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">
                            {member.user.profile.displayName}
                          </p>
                          <span className="glass-badge">{member.role}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                          @{member.user.username}
                        </p>
                      </div>
                    </div>

                    {(hub.permissions.canManageHub || hub.permissions.canManageMembers) &&
                    member.canManage ? (
                      <div className="mt-2.5 grid gap-2">
                        {hub.permissions.canManageHub ? (
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={roleDraft}
                              onChange={(event) =>
                                setRoleDrafts((current) => ({
                                  ...current,
                                  [member.user.username]: event.target.value as HubMemberRole,
                                }))
                              }
                              className="field-select min-h-[34px] flex-1 text-xs"
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
                                void withAction(`role:${member.user.username}`, async () => {
                                  await apiClientFetch(`/v1/hubs/${hub.id}/members/role`, {
                                    method: "PATCH",
                                    body: JSON.stringify({
                                      username: member.user.username,
                                      role: roleDraft,
                                    }),
                                  });
                                })
                              }
                              disabled={actionKey === `role:${member.user.username}`}
                            >
                              Save role
                            </Button>
                          </div>
                        ) : null}

                        {hub.permissions.canManageMembers ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void withAction(`kick:${member.user.username}`, async () => {
                                  await apiClientFetch(`/v1/hubs/${hub.id}/members/kick`, {
                                    method: "POST",
                                    body: JSON.stringify({
                                      username: member.user.username,
                                    }),
                                  });
                                })
                              }
                            >
                              Kick
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void withAction(`mute:${member.user.username}`, async () => {
                                  await apiClientFetch(`/v1/hubs/${hub.id}/mutes`, {
                                    method: "POST",
                                    body: JSON.stringify({
                                      username: member.user.username,
                                      expiresAt: null,
                                    }),
                                  });
                                })
                              }
                            >
                              Mute
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                void withAction(`ban:${member.user.username}`, async () => {
                                  await apiClientFetch(`/v1/hubs/${hub.id}/bans`, {
                                    method: "POST",
                                    body: JSON.stringify({
                                      username: member.user.username,
                                      reason: null,
                                    }),
                                  });
                                })
                              }
                            >
                              Ban
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {(hub.activeMutes.length > 0 || hub.activeBans.length > 0) &&
          hub.permissions.canManageMembers ? (
            <div className="premium-panel rounded-[20px] p-3">
              <div className="compact-toolbar px-1">
                <p className="section-kicker">Restrictions</p>
                <span className="glass-badge">
                  {hub.activeMutes.length + hub.activeBans.length}
                </span>
              </div>

              <div className="mt-2 grid gap-2">
                {hub.activeMutes.map((mute) => (
                  <div key={mute.id} className="list-row rounded-[16px] px-3 py-2.5">
                    <p className="text-sm font-semibold text-white">
                      {mute.user.profile.displayName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      @{mute.user.username}
                    </p>
                    <Button
                      className="mt-2.5"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void withAction(`unmute:${mute.user.username}`, async () => {
                          await apiClientFetch(`/v1/hubs/${hub.id}/mutes/revoke`, {
                            method: "POST",
                            body: JSON.stringify({ username: mute.user.username }),
                          });
                        })
                      }
                    >
                      Revoke mute
                    </Button>
                  </div>
                ))}

                {hub.activeBans.map((ban) => (
                  <div key={ban.id} className="list-row rounded-[16px] px-3 py-2.5">
                    <p className="text-sm font-semibold text-white">
                      {ban.user.profile.displayName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      @{ban.user.username}
                    </p>
                    <Button
                      className="mt-2.5"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void withAction(`unban:${ban.user.username}`, async () => {
                          await apiClientFetch(`/v1/hubs/${hub.id}/bans/revoke`, {
                            method: "POST",
                            body: JSON.stringify({ username: ban.user.username }),
                          });
                        })
                      }
                    >
                      Revoke ban
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
