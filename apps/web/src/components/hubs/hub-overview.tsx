"use client";

import Link from "next/link";
import { hubShellResponseSchema, type HubMemberRole, type HubShell } from "@lobby/shared";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClientFetch } from "@/lib/api-client";
import { buildHubLobbyHref } from "@/lib/hub-routes";

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
        Object.fromEntries(parsed.hub.members.map((member) => [member.user.username, member.role])),
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load hub");
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
      setErrorMessage(error instanceof Error ? error.message : "Hub action failed");
    } finally {
      setActionKey(null);
    }
  }

  if (errorMessage) {
    return (
      <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-400">
        Loading hub...
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{hub.name}</CardTitle>
          <CardDescription>{hub.description ?? "No hub description yet."}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <p className="text-sm text-slate-400">Role</p>
            <p className="mt-1 text-lg font-medium text-white">{hub.membershipRole ?? "guest"}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <p className="text-sm text-slate-400">Privacy</p>
            <p className="mt-1 text-lg font-medium text-white">{hub.isPrivate ? "Private" : "Standard"}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <p className="text-sm text-slate-400">Members</p>
            <p className="mt-1 text-lg font-medium text-white">{hub.members.length}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            <p className="text-sm text-slate-400">Muted</p>
            <p className="mt-1 text-lg font-medium text-white">{hub.isViewerMuted ? "Yes" : "No"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.48fr_0.52fr]">
        <Card>
          <CardHeader>
            <CardTitle>Lobbies</CardTitle>
            <CardDescription>Text, voice and forum lobbies live under the hub shell.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hub.lobbies.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 text-sm text-slate-500">
                No accessible lobbies yet.
              </div>
            ) : (
              hub.lobbies.map((lobby) => (
                <Link
                  key={lobby.id}
                  href={buildHubLobbyHref(hub.id, lobby.id, lobby.type)}
                  className="block rounded-3xl border border-white/10 bg-slate-950/35 p-5 transition hover:border-sky-300/20 hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-medium text-white">{lobby.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{lobby.description ?? "No description yet."}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-white/10 px-3 py-1 text-sky-200/70">
                        {lobby.type}
                      </span>
                      {lobby.isPrivate ? (
                        <span className="rounded-full border border-amber-300/20 px-3 py-1 text-amber-100/80">
                          private
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))
            )}

            {hub.permissions.canCreateLobby ? (
              <form
                className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/35 p-5"
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
                <p className="text-sm font-medium text-white">Create lobby</p>
                <Input value={lobbyName} onChange={(event) => setLobbyName(event.target.value)} placeholder="Lobby name" />
                <Input
                  value={lobbyDescription}
                  onChange={(event) => setLobbyDescription(event.target.value)}
                  placeholder="Lobby description"
                />
                <select
                  value={lobbyType}
                  onChange={(event) => setLobbyType(event.target.value as "TEXT" | "VOICE" | "FORUM")}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none"
                >
                  <option value="TEXT">TEXT</option>
                  <option value="VOICE">VOICE</option>
                  <option value="FORUM">FORUM</option>
                </select>
                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                  <input type="checkbox" checked={privateLobby} onChange={(event) => setPrivateLobby(event.target.checked)} />
                  Private lobby
                </label>
                {privateLobby ? (
                  <Input
                    value={allowedUsernames}
                    onChange={(event) => setAllowedUsernames(event.target.value)}
                    placeholder="allowed usernames, comma-separated"
                  />
                ) : null}
                <Button type="submit" disabled={actionKey === "create-lobby"}>
                  {actionKey === "create-lobby" ? "Creating..." : "Create lobby"}
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {hub.permissions.canInviteMembers ? (
            <Card>
              <CardHeader>
                <CardTitle>Invites</CardTitle>
                <CardDescription>Hub invites respect block rules from stage 2.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  className="flex flex-col gap-3 sm:flex-row"
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
                <div className="space-y-3">
                  {hub.pendingInvites.length === 0 ? (
                    <p className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-500">
                      No pending hub invites.
                    </p>
                  ) : (
                    hub.pendingInvites.map((invite) => (
                      <div key={invite.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                        <p className="text-sm font-medium text-white">{invite.invitee.profile.displayName}</p>
                        <p className="font-mono text-xs text-sky-200/75">@{invite.invitee.username}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>Role, kick, ban and mute actions are gated on both UI and backend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {hub.members.map((member) => {
                const roleDraft = roleDrafts[member.user.username] ?? member.role;

                return (
                  <div key={member.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-medium text-white">{member.user.profile.displayName}</p>
                        <p className="font-mono text-xs text-sky-200/75">@{member.user.username}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-sky-200/70">
                          {member.role}
                        </span>
                        {hub.permissions.canManageHub && member.canManage ? (
                          <>
                            <select
                              value={roleDraft}
                              onChange={(event) =>
                                setRoleDrafts((current) => ({
                                  ...current,
                                  [member.user.username]: event.target.value as HubMemberRole,
                                }))
                              }
                              className="h-9 rounded-2xl border border-white/10 bg-slate-950/50 px-3 text-xs text-white outline-none"
                            >
                              {assignableRoles.map((role) => (
                                <option key={role} value={role}>
                                  {role}
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
                          </>
                        ) : null}
                        {hub.permissions.canManageMembers && member.canManage ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void withAction(`kick:${member.user.username}`, async () => {
                                  await apiClientFetch(`/v1/hubs/${hub.id}/members/kick`, {
                                    method: "POST",
                                    body: JSON.stringify({ username: member.user.username }),
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
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {(hub.activeMutes.length > 0 || hub.activeBans.length > 0) && hub.permissions.canManageMembers ? (
            <Card>
              <CardHeader>
                <CardTitle>Restrictions</CardTitle>
                <CardDescription>Current active mutes and bans for this hub.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-white">Active mutes</p>
                  {hub.activeMutes.length === 0 ? (
                    <p className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-500">
                      No active mutes.
                    </p>
                  ) : (
                    hub.activeMutes.map((mute) => (
                      <div key={mute.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                        <p className="text-sm font-medium text-white">{mute.user.profile.displayName}</p>
                        <p className="font-mono text-xs text-sky-200/75">@{mute.user.username}</p>
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
                          Unmute
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-white">Active bans</p>
                  {hub.activeBans.length === 0 ? (
                    <p className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-500">
                      No active bans.
                    </p>
                  ) : (
                    hub.activeBans.map((ban) => (
                      <div key={ban.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                        <p className="text-sm font-medium text-white">{ban.user.profile.displayName}</p>
                        <p className="font-mono text-xs text-sky-200/75">@{ban.user.username}</p>
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
                          Unban
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
