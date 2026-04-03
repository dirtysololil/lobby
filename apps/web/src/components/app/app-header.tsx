"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelRightClose, PanelRightOpen, ShieldCheck } from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { getSectionMeta, matchesPath, parseAppPath } from "@/lib/app-shell";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./logout-button";
import { QuickLauncher } from "./quick-launcher";

interface AppHeaderProps {
  activityAvailable: boolean;
  activityOpen: boolean;
  onToggleActivity: () => void;
  viewer: PublicUser;
}

const presenceLabels: Record<PublicUser["profile"]["presence"], string> = {
  ONLINE: "Online",
  IDLE: "Idle",
  DND: "Do not disturb",
  OFFLINE: "Invisible",
};

export function AppHeader({
  activityAvailable,
  activityOpen,
  onToggleActivity,
  viewer,
}: AppHeaderProps) {
  const pathname = usePathname();
  const route = parseAppPath(pathname);
  const meta = getSectionMeta(route);

  return (
    <header className="flex h-12 items-center gap-3 px-3 md:px-4">
      <div className="min-w-0 flex-1">
        <p className="section-kicker">{meta.label}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <h1 className="truncate text-[0.96rem] font-semibold tracking-[-0.03em] text-white md:text-[1rem]">
            {meta.title}
          </h1>
          <span className="hidden items-center gap-1.5 text-xs text-[var(--text-dim)] lg:inline-flex">
            <span className="status-dot bg-[var(--success)]" />
            {presenceLabels[viewer.profile.presence]}
          </span>
          {matchesPath(pathname, "/app/admin") ? (
            <span className="hidden md:inline-flex status-pill">
              <ShieldCheck className="h-3 w-3 text-[var(--accent)]" />
              Internal
            </span>
          ) : null}
        </div>
      </div>

      <div className="hidden max-w-[340px] flex-1 lg:block">
        <QuickLauncher />
      </div>

      <div className="flex items-center gap-2">
        {activityAvailable ? (
          <button
            type="button"
            onClick={onToggleActivity}
            className={cn(
              "inline-flex min-h-[34px] items-center gap-2 rounded-[10px] border px-2.5 text-sm font-medium transition-colors",
              activityOpen
                ? "border-[rgba(255,117,84,0.18)] bg-[rgba(255,117,84,0.12)] text-white"
                : "border-[var(--border)] bg-[var(--bg-panel-soft)] text-[var(--text-dim)] hover:bg-[var(--bg-panel-muted)] hover:text-white",
            )}
          >
            {activityOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {activityOpen ? "Hide details" : "Details"}
            </span>
          </button>
        ) : null}

        {viewer.role !== "MEMBER" ? (
          <Link href="/app/admin" className="hidden md:inline-flex status-pill">
            <ShieldCheck className="h-3 w-3 text-[var(--accent)]" />
            Control
          </Link>
        ) : null}

        <div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
