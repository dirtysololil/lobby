"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldBan, UserRoundPlus } from "lucide-react";
import {
  hubShellResponseSchema,
  type HubMemberRole,
  type HubShell,
} from "@lobby/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CompactList,
  CompactListCount,
  CompactListRow,
} from "@/components/ui/compact-list";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { getCachedHubShell, primeHubShellCache } from "@/lib/hub-shell-cache";
import { buildUserProfileHref } from "@/lib/profile-routes";
import { HubMemberRoleBadge, hubRoleLabels } from "./hub-member-role-badge";

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

interface HubOverviewProps {
  hubId: string;
}

const assignableRoles: HubMemberRole[] = ["ADMIN", "MODERATOR", "MEMBER"];
const INITIAL_VISIBLE_MEMBERS = 40;
const MEMBERS_PAGE_SIZE = 40;
const INITIAL_VISIBLE_RESTRICTIONS = 20;

function buildRoleDrafts(hub: HubShell["hub"] | null) {
  if (!hub) {
    return {};
  }

  return Object.fromEntries(
    hub.members.map((member) => [member.user.username, member.role]),
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
  const [hub, setHub] = useState<HubShell["hub"] | null>(() => getCachedHubShell(hubId));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const [lobbyName, setLobbyName] = useState("");
  const [lobbyDescription, setLobbyDescription] = useState("");
  const [lobbyType, setLobbyType] = useState<"TEXT" | "VOICE" | "FORUM">("TEXT");
  const [privateLobby, setPrivateLobby] = useState(false);
  const [allowedUsernames, setAllowedUsernames] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, HubMemberRole>>(() =>
    buildRoleDrafts(getCachedHubShell(hubId)),
  );
  const [visibleMembersCount, setVisibleMembersCount] = useState(INITIAL_VISIBLE_MEMBERS);
  const [visibleRestrictionsCount, setVisibleRestrictionsCount] = useState(
    INITIAL_VISIBLE_RESTRICTIONS,
  );

  const loadHub = useCallback(async () => {
    try {
      const payload = await apiClientFetch(`/v1/hubs/${hubId}`);
      const parsed = hubShellResponseSchema.parse(payload);
      setHub(parsed.hub);
      primeHubShellCache(parsed.hub);
      setRoleDrafts(buildRoleDrafts(parsed.hub));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить этот хаб.");
    }
  }, [hubId]);

  useEffect(() => {
    const cachedHub = getCachedHubShell(hubId);
    setHub(cachedHub);
    setRoleDrafts(buildRoleDrafts(cachedHub));

    if (!cachedHub) {
      void loadHub();
    }
  }, [hubId, loadHub]);

  async function withAction(key: string, action: () => Promise<void>) {
    setActionKey(key);

    try {
      await action();
      await loadHub();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить хаб.");
    } finally {
      setActionKey(null);
    }
  }

  const visibleMembers = useMemo(
    () => hub?.members.slice(0, visibleMembersCount) ?? [],
    [hub?.members, visibleMembersCount],
  );
  const visibleMutes = useMemo(
    () => hub?.activeMutes.slice(0, visibleRestrictionsCount) ?? [],
    [hub?.activeMutes, visibleRestrictionsCount],
  );
  const visibleBans = useMemo(
    () => hub?.activeBans.slice(0, visibleRestrictionsCount) ?? [],
    [hub?.activeBans, visibleRestrictionsCount],
  );

  if (errorMessage) {
    return (
      <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        {errorMessage}
      </div>
    );
  }

  if (!hub) {
    return (
      <div className="rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-4 text-sm text-[var(--text-dim)]">
        Загружаем инструменты хаба...
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {hub.permissions.canCreateLobby ? (
        <section className="premium-panel rounded-[22px] p-4">
          <SectionTitle title="Создать канал" />
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
                placeholder="Название канала"
                className="h-10"
              />
              <SelectField
                value={lobbyType}
                onChange={(event) =>
                  setLobbyType(event.target.value as "TEXT" | "VOICE" | "FORUM")
                }
              >
                <option value="TEXT">Текст</option>
                <option value="VOICE">Голос</option>
                <option value="FORUM">Форум</option>
              </SelectField>
            </div>

            <Input
              value={lobbyDescription}
              onChange={(event) => setLobbyDescription(event.target.value)}
              placeholder="Короткое описание"
              className="h-10"
            />

            <label className="field-checkbox text-sm">
              <input
                type="checkbox"
                checked={privateLobby}
                onChange={(event) => setPrivateLobby(event.target.checked)}
              />
              Приватный канал
            </label>

            {privateLobby ? (
              <Input
                value={allowedUsernames}
                onChange={(event) => setAllowedUsernames(event.target.value)}
                placeholder="Разрешённые ники через запятую"
                className="h-10"
              />
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={actionKey === "create-lobby"} className="h-10">
                {actionKey === "create-lobby" ? "Создаём..." : "Создать канал"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {hub.permissions.canInviteMembers ? (
        <section className="premium-panel rounded-[22px] p-4">
          <SectionTitle
            title="Пригласить участника"
            meta={<CompactListCount>{hub.pendingInvites.length} ожидают</CompactListCount>}
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
              placeholder="Ник пользователя"
              className="h-10"
            />
            <Button type="submit" disabled={actionKey === "invite-member"} className="h-10">
              <UserRoundPlus {...iconProps} />
              {actionKey === "invite-member" ? "Приглашаем..." : "Пригласить"}
            </Button>
          </form>

          <div className="mt-4 overflow-hidden rounded-[18px] border border-[var(--border-soft)]">
            {hub.pendingInvites.length === 0 ? (
              <EmptyState
                title="Ожидающих инвайтов нет"
                description="Инвайты появятся здесь, пока участники их не примут."
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
                    <CompactListCount>Ожидает</CompactListCount>
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
            title="Участники"
            meta={<CompactListCount>{hub.members.length}</CompactListCount>}
          />
        </div>
        <CompactList>
          {visibleMembers.map((member) => {
            const roleDraft = roleDrafts[member.user.username] ?? member.role;

            return (
              <CompactListRow
                key={member.id}
                className="flex-col items-stretch gap-3 lg:flex-col lg:items-stretch"
              >
                <Link
                  href={buildUserProfileHref(member.user.username)}
                  className="identity-link items-start rounded-[16px]"
                >
                  <UserAvatar user={member.user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {member.user.profile.displayName}
                        </p>
                        <HubMemberRoleBadge role={member.role} />
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                        @{member.user.username}
                      </p>
                    </div>
                </Link>

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
                              {hubRoleLabels[role] ?? role}
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
                          Сохранить роль
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
                          Исключить
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
                          Замутить
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
                          Забанить
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CompactListRow>
            );
          })}
        </CompactList>
        {hub.members.length > visibleMembersCount ? (
          <div className="border-t border-[var(--border-soft)] px-4 py-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisibleMembersCount((current) => current + MEMBERS_PAGE_SIZE)}
              className="h-9"
            >
              Показать ещё {Math.min(MEMBERS_PAGE_SIZE, hub.members.length - visibleMembersCount)}
            </Button>
          </div>
        ) : null}
      </section>

      {(hub.activeMutes.length > 0 || hub.activeBans.length > 0) &&
      hub.permissions.canManageMembers ? (
        <section className="premium-panel overflow-hidden rounded-[22px]">
          <div className="px-4 py-4">
            <SectionTitle
              title="Ограничения"
              meta={
                <CompactListCount>
                  {hub.activeMutes.length + hub.activeBans.length}
                </CompactListCount>
              }
            />
          </div>
          <CompactList>
            {visibleMutes.map((mute) => (
              <CompactListRow
                key={mute.id}
                compact
                className="flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{mute.user.profile.displayName}</p>
                  <p className="mt-1 text-xs text-[var(--text-dim)]">@{mute.user.username}</p>
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
                  Снять мут
                </Button>
              </CompactListRow>
            ))}

            {visibleBans.map((ban) => (
              <CompactListRow
                key={ban.id}
                compact
                className="flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{ban.user.profile.displayName}</p>
                  <p className="mt-1 text-xs text-[var(--text-dim)]">@{ban.user.username}</p>
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
                  Снять бан
                </Button>
              </CompactListRow>
            ))}
          </CompactList>
          {hub.activeMutes.length > visibleRestrictionsCount ||
          hub.activeBans.length > visibleRestrictionsCount ? (
            <div className="border-t border-[var(--border-soft)] px-4 py-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setVisibleRestrictionsCount((current) => current + INITIAL_VISIBLE_RESTRICTIONS)
                }
                className="h-9"
              >
                Показать больше ограничений
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
