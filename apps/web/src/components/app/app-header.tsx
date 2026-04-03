import { BellRing, ShieldCheck } from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { UserAvatar } from "@/components/ui/user-avatar";
import { LogoutButton } from "./logout-button";

interface AppHeaderProps { viewer: PublicUser; }

export function AppHeader({ viewer }: AppHeaderProps) {
  return (
    <header className="social-shell grid gap-3 rounded-[28px] p-4 xl:grid-cols-[1fr_auto] xl:items-center">
      <div className="premium-tile rounded-3xl px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Private social control</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">Командные диалоги, community-хабы и управляемые форумы в едином премиальном пространстве.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="premium-tile flex items-center gap-3 rounded-2xl px-3 py-2.5">
          <UserAvatar user={viewer} size="sm" />
          <div>
            <p className="text-sm font-medium text-white">{viewer.profile.displayName}</p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]"><ShieldCheck className="h-3.5 w-3.5 text-[#8eb8ff]" /><span>{viewer.role}</span></div>
          </div>
        </div>
        <div className="premium-tile hidden items-center gap-2 rounded-2xl px-3 py-2 text-xs text-[var(--text-dim)] md:flex"><BellRing className="h-4 w-4 text-[#8eb8ff]" />Уведомления: активны</div>
        <LogoutButton />
      </div>
    </header>
  );
}
