import type { HubShell } from "@lobby/shared";
import { LockKeyhole, UsersRound, Waves } from "lucide-react";
import {
  CompactList,
  CompactListCount,
  CompactListLink,
  CompactListMeta,
} from "@/components/ui/compact-list";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { buildHubLobbyHref } from "@/lib/hub-routes";
import { buildUserProfileHref } from "@/lib/profile-routes";
import { HubMemberRoleBadge } from "./hub-member-role-badge";
import { HubOverviewLauncher } from "./hub-overview-launcher";
import { HubShellBootstrap } from "./hub-shell-bootstrap";

const lobbyTypeLabels: Record<string, string> = {
  TEXT: "Текст",
  VOICE: "Голос",
  FORUM: "Форум",
};

interface HubOverviewShellProps {
  hub: HubShell["hub"];
}

export function HubOverviewShell({ hub }: HubOverviewShellProps) {
  const memberPreview = hub.members.slice(0, 6);
  const canOpenHubTools = hub.permissions.canManageHub;
  const summaryMetrics = canOpenHubTools
    ? [
        { label: "Каналы", value: hub.lobbies.length },
        { label: "Инвайты", value: hub.pendingInvites.length },
        { label: "Муты", value: hub.activeMutes.length },
        { label: "Баны", value: hub.activeBans.length },
      ]
    : [
        { label: "Каналы", value: hub.lobbies.length },
        {
          label: "Форумы",
          value: hub.lobbies.filter((item) => item.type === "FORUM").length,
        },
        {
          label: "Голос",
          value: hub.lobbies.filter((item) => item.type === "VOICE").length,
        },
        { label: "Участники", value: hub.members.length },
      ];

  return (
    <div className="h-full min-h-0 overflow-y-auto px-3 py-3">
      <HubShellBootstrap hub={hub} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 gap-3">
          <section className="premium-panel rounded-[22px] px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(106,168,248,0.2)] bg-[rgba(106,168,248,0.1)] text-[var(--accent-strong)]">
                <Waves className="h-4.5 w-4.5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-base font-semibold tracking-tight text-white">
                    {hub.name}
                  </h1>
                  {hub.membershipRole ? (
                    <HubMemberRoleBadge role={hub.membershipRole} />
                  ) : (
                    <CompactListMeta>Гость</CompactListMeta>
                  )}
                  <CompactListMeta>
                    <UsersRound className="h-3.5 w-3.5" />
                    {hub.members.length}
                  </CompactListMeta>
                  {hub.isPrivate ? (
                    <CompactListMeta>
                      <LockKeyhole className="h-3.5 w-3.5" />
                      Приватный
                    </CompactListMeta>
                  ) : null}
                </div>

                {hub.description?.trim() ? (
                  <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                    {hub.description.trim()}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="premium-panel overflow-hidden rounded-[22px]">
            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium tracking-tight text-white">
                  Каналы и пространства
                </p>
                <CompactListCount>{hub.lobbies.length}</CompactListCount>
              </div>
            </div>

            {hub.lobbies.length === 0 ? (
              <div className="px-4 pb-4 text-sm text-[var(--text-dim)]">
                Пока нет доступных пространств.
              </div>
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
                        <p className="truncate text-sm font-medium text-white">
                          {lobby.name}
                        </p>
                        <CompactListCount>
                          {lobbyTypeLabels[lobby.type] ?? lobby.type}
                        </CompactListCount>
                        {lobby.isPrivate ? (
                          <CompactListCount>Приватный</CompactListCount>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                        {lobby.description?.trim() || "Готово к работе."}
                      </p>
                    </div>
                  </CompactListLink>
                ))}
              </CompactList>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-3">
          <section className="premium-panel rounded-[22px] p-3.5">
            <div className="grid grid-cols-2 gap-2">
              {summaryMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="surface-subtle rounded-[16px] px-3 py-2.5"
                >
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="premium-panel overflow-hidden rounded-[22px]">
            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium tracking-tight text-white">
                  Участники
                </p>
                <CompactListCount>{hub.members.length}</CompactListCount>
              </div>
            </div>

            {memberPreview.length === 0 ? (
              <div className="px-4 pb-4 text-sm text-[var(--text-dim)]">
                {hub.membershipRole
                  ? "Список участников появится здесь, когда в хабе будет активность."
                  : "Состав хаба доступен после вступления."}
              </div>
            ) : (
              <CompactList>
                {memberPreview.map((member) => (
                  <CompactListLink
                    key={member.id}
                    href={buildUserProfileHref(member.user.username)}
                    compact
                    className="gap-3"
                  >
                    <UserAvatar user={member.user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm text-white">
                          {member.user.profile.displayName}
                        </p>
                        <HubMemberRoleBadge role={member.role} />
                        <PresenceIndicator user={member.user} compact />
                      </div>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        @{member.user.username}
                      </p>
                    </div>
                  </CompactListLink>
                ))}
              </CompactList>
            )}
          </section>

          {canOpenHubTools ? (
            <HubOverviewLauncher
              hubId={hub.id}
              membersCount={hub.members.length}
              lobbiesCount={hub.lobbies.length}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
