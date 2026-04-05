import type { HubShell } from "@lobby/shared";
import {
  LockKeyhole,
  UsersRound,
  Waves,
} from "lucide-react";
import {
  CompactList,
  CompactListCount,
  CompactListLink,
  CompactListMeta,
  CompactListRow,
} from "@/components/ui/compact-list";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { buildHubLobbyHref } from "@/lib/hub-routes";
import { HubOverviewLauncher } from "./hub-overview-launcher";
import { HubShellBootstrap } from "./hub-shell-bootstrap";

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

interface HubOverviewShellProps {
  hub: HubShell["hub"];
}

export function HubOverviewShell({ hub }: HubOverviewShellProps) {
  const memberPreview = hub.members.slice(0, 8);

  return (
    <div className="h-full min-h-0 overflow-y-auto px-3 py-3">
      <HubShellBootstrap hub={hub} />
      <div className="grid gap-3">
        <section className="premium-panel rounded-[22px] p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CompactListMeta>
                  <Waves className="h-4 w-4" />
                  Хаб
                </CompactListMeta>
                <CompactListMeta>
                  {hub.membershipRole
                    ? roleLabels[hub.membershipRole] ?? hub.membershipRole
                    : "Гость"}
                </CompactListMeta>
                <CompactListMeta>
                  <UsersRound className="h-4 w-4" />
                  {hub.members.length} участников
                </CompactListMeta>
                {hub.isPrivate ? (
                  <CompactListMeta>
                    <LockKeyhole className="h-4 w-4" />
                    Приватный
                  </CompactListMeta>
                ) : null}
              </div>
              <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">{hub.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
                {hub.description ??
                  "Общее пространство для каналов, звонков и контекста участников."}
              </p>
            </div>

            <div className="grid min-w-[240px] grid-cols-2 gap-2 xl:w-[280px]">
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-white/[0.03] px-3 py-3">
                <p className="text-xs text-[var(--text-muted)]">Каналы</p>
                <p className="mt-1 text-lg font-semibold text-white">{hub.lobbies.length}</p>
              </div>
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-white/[0.03] px-3 py-3">
                <p className="text-xs text-[var(--text-muted)]">Ожидают инвайты</p>
                <p className="mt-1 text-lg font-semibold text-white">{hub.pendingInvites.length}</p>
              </div>
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-white/[0.03] px-3 py-3">
                <p className="text-xs text-[var(--text-muted)]">Активные муты</p>
                <p className="mt-1 text-lg font-semibold text-white">{hub.activeMutes.length}</p>
              </div>
              <div className="rounded-[16px] border border-[var(--border-soft)] bg-white/[0.03] px-3 py-3">
                <p className="text-xs text-[var(--text-muted)]">Активные баны</p>
                <p className="mt-1 text-lg font-semibold text-white">{hub.activeBans.length}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="premium-panel overflow-hidden rounded-[22px]">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium tracking-tight text-white">Каналы и пространства</p>
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
                        <p className="truncate text-sm font-medium text-white">{lobby.name}</p>
                        <CompactListCount>
                          {lobbyTypeLabels[lobby.type] ?? lobby.type}
                        </CompactListCount>
                        {lobby.isPrivate ? <CompactListCount>Приватный</CompactListCount> : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                        {lobby.description ?? "Готов к общению."}
                      </p>
                    </div>
                  </CompactListLink>
                ))}
              </CompactList>
            )}
          </section>

          <div className="grid gap-3">
            <section className="premium-panel overflow-hidden rounded-[22px]">
              <div className="px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium tracking-tight text-white">Участники</p>
                  <CompactListCount>{hub.members.length}</CompactListCount>
                </div>
              </div>
              <CompactList>
                {memberPreview.map((member) => (
                  <CompactListRow key={member.id} compact className="gap-3">
                    <UserAvatar user={member.user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm text-white">
                          {member.user.profile.displayName}
                        </p>
                        <PresenceIndicator presence={member.user.profile.presence} compact />
                      </div>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        @{member.user.username} · {roleLabels[member.role] ?? member.role}
                      </p>
                    </div>
                  </CompactListRow>
                ))}
              </CompactList>
            </section>

            <HubOverviewLauncher
              hubId={hub.id}
              membersCount={hub.members.length}
              lobbiesCount={hub.lobbies.length}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
