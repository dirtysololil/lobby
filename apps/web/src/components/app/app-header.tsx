"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { getSectionMeta, matchesPath, parseAppPath } from "@/lib/app-shell";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { LogoutButton } from "./logout-button";
import { QuickLauncher } from "./quick-launcher";

interface AppHeaderProps {
  viewer: PublicUser;
}

export function AppHeader({
  viewer,
}: AppHeaderProps) {
  const pathname = usePathname();
  const route = parseAppPath(pathname ?? "");
  const meta = getSectionMeta(route);

  return (
    <header className="flex h-12 items-center gap-3 px-3 md:px-4">
      <div className="min-w-0 flex-1">
        <p className="section-kicker">{meta.label}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <h1 className="truncate text-[0.96rem] font-semibold tracking-[-0.03em] text-white md:text-[1rem]">
            {meta.title}
          </h1>
          <PresenceIndicator
            user={viewer}
            className="hidden lg:inline-flex"
          />
          {matchesPath(pathname, "/app/admin") ? (
            <span className="hidden md:inline-flex status-pill">
              <ShieldCheck className="h-3 w-3 text-[var(--accent)]" />
              Внутренний раздел
            </span>
          ) : null}
        </div>
      </div>

      <div className="hidden max-w-[340px] flex-1 lg:block">
        <QuickLauncher />
      </div>

      <div className="flex items-center gap-2">
        {viewer.role !== "MEMBER" ? (
          <Link href="/app/admin" className="hidden md:inline-flex status-pill">
            <ShieldCheck className="h-3 w-3 text-[var(--accent)]" />
            Управление
          </Link>
        ) : null}

        <div className="md:hidden">
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
