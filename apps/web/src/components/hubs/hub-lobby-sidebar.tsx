import Link from "next/link";
import type { HubShell } from "@lobby/shared";
import { buildHubLobbyHref } from "@/lib/hub-routes";

interface HubLobbySidebarProps {
  hub: HubShell["hub"];
}

export function HubLobbySidebar({ hub }: HubLobbySidebarProps) {
  return (
    <aside className="flex h-full flex-col rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[var(--shadow)] backdrop-blur-xl">
      <div className="rounded-3xl border border-sky-300/15 bg-sky-300/10 px-4 py-4">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Hub</p>
        <h2 className="mt-2 text-lg font-semibold text-white">{hub.name}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {hub.description ?? "No hub description yet."}
        </p>
      </div>

      <div className="mt-6">
        <Link
          href={`/app/hubs/${hub.id}`}
          className="flex items-center justify-between rounded-2xl border border-transparent px-4 py-3 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
        >
          <span>Overview</span>
          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-sky-200/70">
            {hub.membershipRole ?? "guest"}
          </span>
        </Link>
      </div>

      <div className="mt-6 flex-1">
        <p className="px-4 font-mono text-xs uppercase tracking-[0.22em] text-sky-200/70">Lobbies</p>
        <div className="mt-3 space-y-2">
          {hub.lobbies.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-500">
              No accessible lobbies yet.
            </div>
          ) : (
            hub.lobbies.map((lobby) => (
              <Link
                key={lobby.id}
                href={buildHubLobbyHref(hub.id, lobby.id, lobby.type)}
                className="block rounded-2xl border border-transparent px-4 py-3 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{lobby.name}</span>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-sky-200/70">
                    {lobby.type}
                  </span>
                </div>
                {lobby.isPrivate ? (
                  <p className="mt-2 text-xs text-amber-100/70">Private lobby</p>
                ) : null}
              </Link>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
