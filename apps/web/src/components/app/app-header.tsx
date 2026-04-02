import { BellRing, ShieldCheck } from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { UserAvatar } from "@/components/ui/user-avatar";
import { LogoutButton } from "./logout-button";

interface AppHeaderProps {
  viewer: PublicUser;
}

export function AppHeader({ viewer }: AppHeaderProps) {
  return (
    <header className="flex flex-col gap-4 rounded-[30px] border border-white/10 bg-white/[0.04] p-4 shadow-[var(--shadow)] backdrop-blur-xl xl:flex-row xl:items-center xl:justify-between">
      <div className="rounded-[24px] border border-white/10 bg-slate-950/35 px-4 py-4">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-sky-200/70">Private platform</p>
        <p className="mt-2 text-sm leading-7 text-slate-300">
          Direct messages, hubs, forum and LiveKit calls stay private by default, while owner/admin tooling
          and avatar customization now live in the same shell.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-slate-950/35 px-4 py-3">
          <UserAvatar user={viewer} size="sm" />
          <div>
            <p className="text-sm font-medium text-white">{viewer.profile.displayName}</p>
            <div className="mt-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-300" />
              <span>{viewer.role}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-[24px] border border-white/10 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
          <BellRing className="h-4 w-4 text-sky-300" />
          Notifications and profile settings are ready
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
