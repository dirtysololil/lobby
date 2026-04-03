"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  LockKeyhole,
  ShieldBan,
  UserRoundPlus,
  UsersRound,
  Waves,
} from "lucide-react";
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

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
  MEMBER: "Member",
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

function CountBadge({ value }: { value: number | string }) {
  return (
    <span className="inline-flex min-h-5 items-center rounded-full bg-[var(--bg-panel-soft)] px-2 text-[11px] font-medium text-[var(--text-dim)]">
      {value}
    </span>
  );
}

function SectionTitle({
  title,
  meta,
}: {
  title: string;
  meta?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium tracking-tight text-white">{title}</p>
      {meta}
    </div>
  );
}

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
        error instanceof Error ? error.message : "Unable to load this hub.",
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
        error instanceof Error ? error.message : "Unable to update the hub.",
      );
    } finally {
      setActionKey(null);
    }
  }

  if (errorMessage) {
    return (
      <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="premium-panel rounded-[24px] p-5 text-sm text-[var(--text-dim)]">
        Loading hub...
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="premium-panel rounded-[24px] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <Waves {...iconProps} />
                Hub
              </span>
              <span className="status-pill">
                {hub.membershipRole
                  ? roleLabels[hub.membershipRole] ?? hub.membershipRole
                  : "Guest"}
              </span>
              <span className="status-pill">
                <UsersRound {...iconProps} />
                {hub.members.length} members
              </span>
              {hub.isPrivate ? (
                <span className="status-pill">
                  <LockKeyhole {...iconProps} />
                  Private
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">
              {hub.name}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
              {hub.description ??
                "A shared communication space for channels, calls and member context."}
            </p>
          </div>

          <div className="grid min-w-[240px] grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            <div className="surface-subtle rounded-[18px] px-4 py-3">
              <p className="text-xs text-[var(--text-muted)]">Channels</p>
              <p className="mt-1 text-lg font-semibold text-white">{hub.lobbies.length}</p>
            </div>
            <div className="surface-subtle rounded-[18px] px-4 py-3">
              <p className="text-xs text-[var(--text-muted)]">Pending invites</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {hub.pendingInvites.length}
              </p>
            </div>
            <div className="surface-subtle rounded-[18px] px-4 py-3">
              <p className="text-xs text-[var(--text-muted)]">Active mutes</p>
              <p className="mt-1 text-lg font-semibold text-white">{hub.activeMutes.length}</p>
            </div>
            <div className="surface-subtle rounded-[18px] px-4 py-3">
              <p className="text-xs text-[var(--text-muted)]">Active bans</p>
              <p className="mt-1 text-lg font-semibold text-white">{hub.activeBans.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4">
          <section className="premium-panel rounded-[24px] p-4">
            <SectionTitle
              title="Channels and spaces"
              meta={<CountBadge value={hub.lobbies.length} />}
            />
            <div className="mt-4 grid gap-2">
              {hub.lobbies.length === 0 ? (
                <EmptyState
                  title="No accessible spaces yet"
                  description="Create the first lobby to give this hub a place to talk."
                />
              ) : (
                hub.lobbies.map((lobby) => (
                  <Link
                    key={lobby.id}
                    href={buildHubLobbyHref(hub.id, lobby.id, lobby.type)}
                    className="flex min-h-14 items-start gap-3 rounded-[18px] border border-transparent px-3 py-3 transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-hover)]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--bg-panel-soft)] text-[11px] font-semibold text-white">
                      {lobby.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{lobby.name}</p>
                        <span className="glass-badge">
                          {lobbyTypeLabels[lobby.type] ?? lobby.type}
                        </span>
                        {lobby.isPrivate ? <span className="glass-badge">Private</span> : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                        {lobby.description ?? "Ready for conversation."}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          {hub.permissions.canCreateLobby ? (
            <section className="premium-panel rounded-[24px] p-4">
              <SectionTitle title="Create lobby" />
              <form
                className="mt-4 grid gap-3"
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
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                  <Input
                    value={lobbyName}
                    onChange={(event) => setLobbyName(event.target.value)}
                    placeholder="Lobby name"
                  />
                  <select
                    value={lobbyType}
                    onChange={(event) =>
                      setLobbyType(event.target.value as "TEXT" | "VOICE" | "FORUM")
                    }
                    className="field-select text-sm"
                  >
                    <option value="TEXT">Text</option>
                    <option value="VOICE">Voice</option>
                    <option value="FORUM">Forum</option>
                  </select>
                </div>

                <Input
                  value={lobbyDescription}
                  onChange={(event) => setLobbyDescription(event.target.value)}
                  placeholder="Short description"
                />

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
                    placeholder="Allowed usernames, comma-separated"
                  />
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={actionKey === "create-lobby"}>
                    {actionKey === "create-lobby" ? "Creating..." : "Create lobby"}
                  </Button>
                  <p className="self-center text-xs text-[var(--text-muted)]">
                    Keep creation compact and lightweight. You can refine permissions later.
                  </p>
                </div>
              </form>
            </section>
          ) : null}
        </div>

        <div className="grid gap-4">
          {hub.permissions.canInviteMembers ? (
            <section className="premium-panel rounded-[24px] p-4">
              <SectionTitle
                title="Invite member"
                meta={<CountBadge value={`${hub.pendingInvites.length} pending`} />}
              />
              <form
                className="mt-4 flex flex-col gap-2 sm:flex-row"
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
                  <UserRoundPlus {...iconProps} />
                  {actionKey === "invite-member" ? "Inviting..." : "Invite"}
                </Button>
              </form>

              <div className="mt-4 grid gap-2">
                {hub.pendingInvites.length === 0 ? (
                  <EmptyState
                    title="No pending invites"
                    description="Invites will appear here while members have not accepted them yet."
                  />
                ) : (
                  hub.pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-3 py-3"
                    >
                      <p className="text-sm font-medium text-white">
                        {invite.invitee.profile.displayName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-dim)]">
                        @{invite.invitee.username}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          <section className="premium-panel rounded-[24px] p-4">
            <SectionTitle title="Members" meta={<CountBadge value={hub.members.length} />} />
            <div className="mt-4 grid gap-2">
              {hub.members.map((member) => {
                const roleDraft = roleDrafts[member.user.username] ?? member.role;

                return (
                  <div
                    key={member.id}
                    className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-3 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar user={member.user} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">
                            {member.user.profile.displayName}
                          </p>
                          <span className="glass-badge">
                            {roleLabels[member.role] ?? member.role}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                          @{member.user.username}
                        </p>
                      </div>
                    </div>

                    {(hub.permissions.canManageHub || hub.permissions.canManageMembers) &&
                    member.canManage ? (
                      <div className="mt-3 grid gap-2">
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
                              <ShieldBan {...iconProps} />
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
          </section>

          {(hub.activeMutes.length > 0 || hub.activeBans.length > 0) &&
          hub.permissions.canManageMembers ? (
            <section className="premium-panel rounded-[24px] p-4">
              <SectionTitle
                title="Restrictions"
                meta={<CountBadge value={hub.activeMutes.length + hub.activeBans.length} />}
              />
              <div className="mt-4 grid gap-2">
                {hub.activeMutes.map((mute) => (
                  <div
                    key={mute.id}
                    className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-3 py-3"
                  >
                    <p className="text-sm font-medium text-white">
                      {mute.user.profile.displayName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-dim)]">
                      @{mute.user.username}
                    </p>
                    <Button
                      className="mt-3"
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
                  <div
                    key={ban.id}
                    className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-panel-soft)] px-3 py-3"
                  >
                    <p className="text-sm font-medium text-white">
                      {ban.user.profile.displayName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-dim)]">
                      @{ban.user.username}
                    </p>
                    <Button
                      className="mt-3"
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
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
