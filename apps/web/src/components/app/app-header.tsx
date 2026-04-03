"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, ShieldCheck, Sparkles, Waves } from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { getSectionMeta, matchesPath, parseAppPath } from "@/lib/app-shell";
import { LogoutButton } from "./logout-button";
import { QuickLauncher } from "./quick-launcher";

interface AppHeaderProps {
  viewer: PublicUser;
}

const presenceLabels: Record<PublicUser["profile"]["presence"], string> = {
  ONLINE: "В сети",
  IDLE: "Отошёл",
  DND: "Не беспокоить",
  OFFLINE: "Скрыт",
};

export function AppHeader({ viewer }: AppHeaderProps) {
  const pathname = usePathname();
  const route = parseAppPath(pathname);
  const meta = getSectionMeta(route);

  return (
    <header className="social-shell rounded-[28px] p-3 lg:p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(340px,460px)] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">{meta.label}</span>
              <span className="status-pill">
                <span className="status-dot text-[var(--success)]" />
                {presenceLabels[viewer.profile.presence]}
              </span>
              {matchesPath(pathname, "/app/admin") ? (
                <span className="status-pill">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent-warm)]" />
                  Контроль
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="truncate font-[var(--font-heading)] text-[1.65rem] font-semibold tracking-[-0.05em] text-white lg:text-[1.9rem]">
                  {meta.title}
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
                  {meta.description}
                </p>
              </div>
            </div>
          </div>

          <QuickLauncher />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/app/messages"
            className="status-pill transition hover:border-[var(--border-strong)] hover:bg-white/[0.07]"
          >
            <BellRing className="h-3.5 w-3.5 text-[var(--accent)]" />
            Inbox
          </Link>
          <Link
            href="/app/hubs"
            className="status-pill transition hover:border-[var(--border-strong)] hover:bg-white/[0.07]"
          >
            <Waves className="h-3.5 w-3.5 text-[var(--accent)]" />
            Spaces
          </Link>
          <span className="status-pill hidden sm:inline-flex">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            Sync ready
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
