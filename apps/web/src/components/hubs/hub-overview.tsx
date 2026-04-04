"use client";

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
import { EmptyState } from "@/components/ui/empty-state";
import {
  CompactList,
  CompactListCount,
  CompactListLink,
  CompactListMeta,
  CompactListRow,
} from "@/components/ui/compact-list";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
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
  const [lobbyType, setLobbyType] = useState<"TEXT" | "VOICE" | "FORUM">("TEXT");
  const [privateLobby, setPrivateLobby] = useState(false);
  const [allowedUsernames, setAllowedUsernames] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, HubMemberRole>>({});

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
      setErrorMessage(error instanceof Error ? error.message : "Unable to load this hub.");
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to update the hub.");
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
      <div className="premium-panel rounded-[22px] p-4 text-sm text-[var(--text-dim)]">
        Loading hub...
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-3 py-3">
      <div className="grid gap-3">
        <section className="premium-panel rounded-[22px] p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CompactListMeta>
                  <Waves {...iconProps} />
                  Hub
                </CompactListMeta>
                <CompactListMeta>
                  {hub.membershipRole ? roleLabels[hub.membershipRole] ?? hub.membershipRole : "Guest"}
                </CompactListMeta>
                <CompactListMeta>
                  <UsersRound {...iconProps} />
                  {hub.members.length} members
                </CompactListMeta>
                {hub.isPrivate ? (
                  <CompactListMeta>
                    <LockKeyhole {...iconProps} />
                    Private
                  </CompactListMeta>
                ) : null}
              </div>
              <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">{hub.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
                {hub.description ??
                  "A shared communication space for channels, calls, and member context."}
              </p>
            </div>

            <div className="grid min-w-[240px] grid-cols-2 gap-2 xl:w-[280px]">
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-white/[0.03] px-3 py-3">
                <p className="text-xs text-[var(--text-muted)]">Channels</p>
                <p className="mt-1 text-lg font-semibold text-white">{hub.lobbies.length}</p>
              </div>
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-white/[0.03] px-3 py-3">
                <p className="text-xs text-[var(--text-muted)]">Pending invites</p>
                <p className="mt-1 text-lg font-semibold text-white">{hub.pendingInvites.length}</p>
              </div>
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-white/[0.03] px-3 py-3">
                <p className="text-xs text-[var(--text-muted)]">Active mutes</p>
                <p className="mt-1 text-lg font-semibold text-white">{hub.activeMutes.length}</p>
              </div>
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-white/[0.03] px-3 py-3">
                <p className="text-xs text-[var(--text-muted)]">Active bans</p>
                <p className="mt-1 text-lg font-semibold text-white">{hub.activeBans.length}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3">
            <section className="premium-panel overflow-hidden rounded-[22px]">
              <div className="px-4 py-4">
                <SectionTitle
                  title="Channels and spaces"
                  meta={<CompactListCount>{hub.lobbies.length}</CompactListCount>}
                />
              </div>
              {hub.lobbies.length === 0 ? (
                <EmptyState
                  title="No accessible spaces yet"
                  description="Create the first lobby to give this hub a place to talk."
                  className="min-h-[180px]"
                />
              ) : (
                <CompactList>
                  {hub.lobbies.map((lobby) => (
                    <CompactListLink
                      key={lobby.id}
                      href={buildHubLobbyHref(hub.id, lobby.id, lobby.type)}
                      className="gap-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[var(--bg-panel-soft)] text-[10px] font-semibold text-white">
                        {lobby.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">{lobby.name}</p>
                          <CompactListCount>
                            {lobbyTypeLabels[lobby.type] ?? lobby.type}
                          </CompactListCount>
                          {lobby.isPrivate ? <CompactListCount>Private</CompactListCount> : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                          {lobby.description ?? "Ready for conversation."}
                        </p>
                      </div>
                    </CompactListLink>
                  ))}
                </CompactList>
              )}
            </section>

            {hub.permissions.canCreateLobby ? (
              <section className="premium-panel rounded-[22px] p-4">
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
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
                    <Input
                      value={lobbyName}
                      onChange={(event) => setLobbyName(event.target.value)}
                      placeholder="Lobby name"
                      className="h-10"
                    />
                    <SelectField
                      value={lobbyType}
                      onChange={(event) =>
                        setLobbyType(event.target.value as "TEXT" | "VOICE" | "FORUM")
                      }
                    >
                      <option value="TEXT">Text</option>
                      <option value="VOICE">Voice</option>
                      <option value="FORUM">Forum</option>
                    </SelectField>
                  </div>

                  <Input
                    value={lobbyDescription}
                    onChange={(event) => setLobbyDescription(event.target.value)}
                    placeholder="Short description"
                    className="h-10"
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
                      className="h-10"
                    />
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={actionKey === "create-lobby"} className="h-10">
                      {actionKey === "create-lobby" ? "Creating..." : "Create lobby"}
                    </Button>
                    <p className="self-center text-xs text-[var(--text-muted)]">
                      Keep creation compact. You can refine permissions later.
                    </p>
                  </div>
                </form>
              </section>
            ) : null}
          </div>

          <div className="grid gap-3">
            {hub.permissions.canInviteMembers ? (
              <section className="premium-panel rounded-[22px] p-4">
                <SectionTitle
                  title="Invite member"
                  meta={<CompactListCount>{hub.pendingInvites.length} pending</CompactListCount>}
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
                    className="h-10"
                  />
                  <Button type="submit" disabled={actionKey === "invite-member"} className="h-10">
                    <UserRoundPlus {...iconProps} />
                    {actionKey === "invite-member" ? "Inviting..." : "Invite"}
                  </Button>
                </form>

                <div className="mt-4 overflow-hidden rounded-[18px] border border-[var(--border-soft)]">
                  {hub.pendingInvites.length === 0 ? (
                    <EmptyState
                      title="No pending invites"
                      description="Invites will appear here until members accept them."
                      className="min-h-[160px]"
                    />
                  ) : (
                    <CompactList>
                      {hub.pendingInvites.map((invite) => (
                        <CompactListRow key={invite.id} compact className="gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">
                              {invite.invitee.profile.displayName}
                            </p>
                            <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                              @{invite.invitee.username}
                            </p>
                          </div>
                          <CompactListCount>Pending</CompactListCount>
                        </CompactListRow>
                      ))}
                    </CompactList>
                  )}
                </div>
              </section>
            ) : null}

            <section className="premium-panel overflow-hidden rounded-[22px]">
              <div className="px-4 py-4">
                <SectionTitle
                  title="Members"
                  meta={<CompactListCount>{hub.members.length}</CompactListCount>}
                />
              </div>
              <CompactList>
                {hub.members.map((member) => {
                  const roleDraft = roleDrafts[member.user.username] ?? member.role;

                  return (
                    <CompactListRow
                      key={member.id}
                      className="flex-col items-stretch gap-3 lg:flex-col lg:items-stretch"
                    >
                      <div className="flex items-start gap-3">
                        <UserAvatar user={member.user} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-white">
                              {member.user.profile.displayName}
                            </p>
                            <CompactListCount>{roleLabels[member.role] ?? member.role}</CompactListCount>
                          </div>
                          <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                            @{member.user.username}
                          </p>
                        </div>
                      </div>

                      {(hub.permissions.canManageHub || hub.permissions.canManageMembers) &&
                      member.canManage ? (
                        <div className="grid gap-2">
                          {hub.permissions.canManageHub ? (
                            <div className="flex flex-wrap gap-2">
                              <SelectField
                                value={roleDraft}
                                onChange={(event) =>
                                  setRoleDrafts((current) => ({
                                    ...current,
                                    [member.user.username]: event.target.value as HubMemberRole,
                                  }))
                                }
                                className="text-sm"
                                shellClassName="min-w-[180px] flex-1"
                              >
                                {assignableRoles.map((role) => (
                                  <option key={role} value={role}>
                                    {roleLabels[role] ?? role}
                                  </option>
                                ))}
                              </SelectField>
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
                                className="h-10"
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
                                className="h-8 px-2.5"
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
                                className="h-8 px-2.5"
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
                                className="h-8 px-2.5"
                              >
                                <ShieldBan {...iconProps} />
                                Ban
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </CompactListRow>
                  );
                })}
              </CompactList>
            </section>

            {(hub.activeMutes.length > 0 || hub.activeBans.length > 0) &&
            hub.permissions.canManageMembers ? (
              <section className="premium-panel overflow-hidden rounded-[22px]">
                <div className="px-4 py-4">
                  <SectionTitle
                    title="Restrictions"
                    meta={
                      <CompactListCount>
                        {hub.activeMutes.length + hub.activeBans.length}
                      </CompactListCount>
                    }
                  />
                </div>
                <CompactList>
                  {hub.activeMutes.map((mute) => (
                    <CompactListRow
                      key={mute.id}
                      compact
                      className="flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">
                          {mute.user.profile.displayName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-dim)]">
                          @{mute.user.username}
                        </p>
                      </div>
                      <Button
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
                        className="h-8 px-2.5"
                      >
                        Revoke mute
                      </Button>
                    </CompactListRow>
                  ))}

                  {hub.activeBans.map((ban) => (
                    <CompactListRow
                      key={ban.id}
                      compact
                      className="flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">
                          {ban.user.profile.displayName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-dim)]">
                          @{ban.user.username}
                        </p>
                      </div>
                      <Button
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
                        className="h-8 px-2.5"
                      >
                        Revoke ban
                      </Button>
                    </CompactListRow>
                  ))}
                </CompactList>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
