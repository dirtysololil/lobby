"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, ShieldCheck } from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { getSectionMeta, matchesPath, parseAppPath } from "@/lib/app-shell";
import { LogoutButton } from "./logout-button";
import { QuickLauncher } from "./quick-launcher";

interface AppHeaderProps {
  viewer: PublicUser;
}

const presenceLabels: Record<PublicUser["profile"]["presence"], string> = {
  ONLINE: "В сети",
  IDLE: "Отошел",
  DND: "Не беспокоить",
  OFFLINE: "Скрыт",
};

export function AppHeader({ viewer }: AppHeaderProps) {
  const pathname = usePathname();
  const route = parseAppPath(pathname);
  const meta = getSectionMeta(route);

  return (
    <header className="social-shell rounded-[24px] p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">{meta.label}</span>
            <span className="status-pill">
              <span className="status-dot bg-[var(--success)]" />
              {presenceLabels[viewer.profile.presence]}
            </span>
            {matchesPath(pathname, "/app/admin") ? (
              <span className="status-pill">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                Внутренний модуль
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="truncate font-[var(--font-heading)] text-[1.2rem] font-semibold tracking-[-0.04em] text-white lg:text-[1.35rem]">
              {meta.title}
            </h1>
            <p className="hidden text-sm text-[var(--text-dim)] lg:block">
              {meta.description}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 xl:min-w-[540px] xl:flex-row xl:items-center xl:justify-end">
          <div className="min-w-0 flex-1">
            <QuickLauncher />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/app/messages" className="status-pill">
              <BellRing className="h-3.5 w-3.5 text-[var(--accent)]" />
              Inbox
            </Link>
            {viewer.role !== "MEMBER" ? (
              <Link href="/app/admin" className="status-pill">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                Control
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
