import { BellRing, ShieldCheck } from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { UserAvatar } from "@/components/ui/user-avatar";
import { LogoutButton } from "./logout-button";

interface AppHeaderProps {
  viewer: PublicUser;
}

export function AppHeader({ viewer }: AppHeaderProps) {
  return (
    <header className="grid gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)] backdrop-blur-xl xl:grid-cols-[1fr_auto] xl:items-center">
      <div className="rounded-2xl border border-[var(--border)] bg-slate-950/35 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">Приватное пространство</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Сообщения, хабы, форум и звонки собраны в единую рабочую панель.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-slate-950/35 px-3 py-2.5">
          <UserAvatar user={viewer} size="sm" />
          <div>
            <p className="text-sm font-medium text-white">{viewer.profile.displayName}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />
              <span>{viewer.role}</span>
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-2xl border border-[var(--border)] bg-slate-950/35 px-3 py-2 text-xs text-slate-300 md:flex">
          <BellRing className="h-4 w-4 text-cyan-200" />
          Уведомления активны
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
