import { Search, ShieldCheck } from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { LogoutButton } from "./logout-button";

interface AppHeaderProps {
  viewer: PublicUser;
}

export function AppHeader({ viewer }: AppHeaderProps) {
  return (
    <header className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[var(--shadow)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
        <Search className="h-4 w-4 text-sky-300" />
        <span className="text-sm text-slate-400">People search, private messaging and LiveKit calls are available</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sky-200/70">
            Authenticated
          </p>
          <div className="mt-1 flex items-center gap-2 text-sm text-white">
            <ShieldCheck className="h-4 w-4 text-sky-300" />
            <span>{viewer.profile.displayName}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300">{viewer.role}</span>
          </div>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
