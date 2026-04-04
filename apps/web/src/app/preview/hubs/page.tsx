"use client";

import { LockKeyhole, UserRoundPlus, UsersRound, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PreviewShell } from "../_preview-shell";
import { previewHub, previewViewer } from "../_mock-data";

const iconProps = { size: 18, strokeWidth: 1.5 } as const;
const pendingInvite = previewHub.pendingInvites[0]!;

export default function PreviewHubsPage() {
  return (
    <PreviewShell
      viewer={previewViewer}
      sectionLabel="Hubs"
      rows={previewHub.lobbies.map((lobby, index) => ({
        id: lobby.id,
        label: lobby.name,
        detail: lobby.type,
        active: index === 1,
        initials: lobby.name.slice(0, 2).toUpperCase(),
        meta: lobby.isPrivate ? <LockKeyhole {...iconProps} className="text-zinc-500" /> : null,
      }))}
    >
      <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-4">
          <section className="premium-panel rounded-[26px] p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="eyebrow-pill">
                    <Waves {...iconProps} />
                    Hub
                  </span>
                  <span className="status-pill">Owner</span>
                  <span className="status-pill">
                    <UsersRound {...iconProps} />
                    {previewHub.members.length} members
                  </span>
                </div>
                <h1 className="mt-3 text-xl font-semibold tracking-tight text-white">
                  {previewHub.name}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
                  {previewHub.description}
                </p>
              </div>
            </div>
          </section>

          <section className="premium-panel rounded-[26px] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium tracking-tight text-white">Channels and spaces</p>
              <span className="glass-badge">{previewHub.lobbies.length}</span>
            </div>
            <div className="mt-4 grid gap-1.5">
              {previewHub.lobbies.map((lobby) => (
                <div
                  key={lobby.id}
                  className="flex min-h-14 items-start gap-3 rounded-[18px] border border-transparent px-3 py-3 transition-colors hover:border-white/6 hover:bg-[var(--bg-hover)]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--bg-panel-soft)] text-[11px] font-semibold text-white">
                    {lobby.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">{lobby.name}</p>
                      <span className="glass-badge">{lobby.type}</span>
                      {lobby.isPrivate ? <span className="glass-badge">Private</span> : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                      {lobby.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="premium-panel rounded-[26px] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium tracking-tight text-white">Members</p>
              <span className="glass-badge">{previewHub.members.length}</span>
            </div>
            <div className="mt-4 grid gap-1.5">
              {previewHub.members.map((member) => (
                <div
                  key={member.id}
                  className="rounded-[18px] border border-transparent px-3 py-3 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar user={member.user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {member.user.profile.displayName}
                        </p>
                        <span className="glass-badge">{member.role}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                        @{member.user.username}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-4">
          <section className="premium-panel rounded-[26px] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium tracking-tight text-white">Invite member</p>
              <span className="glass-badge">{previewHub.pendingInvites.length} pending</span>
            </div>
            <div className="mt-4 flex gap-2">
              <Input value={pendingInvite.invitee.username} readOnly />
              <Button type="button">
                <UserRoundPlus {...iconProps} />
                Invite
              </Button>
            </div>
            <div className="mt-4 grid gap-1.5">
              {previewHub.pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-[18px] border border-transparent px-3 py-3 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {invite.invitee.profile.displayName}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--text-dim)]">
                      @{invite.invitee.username}
                    </p>
                  </div>
                  <span className="glass-badge">Pending</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PreviewShell>
  );
}
