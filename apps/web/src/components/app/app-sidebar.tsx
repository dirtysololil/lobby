"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers3,
  MessageSquareMore,
  Settings2,
  ShieldCheck,
  Users2,
} from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { LogoutButton } from "@/components/app/logout-button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { matchesPath } from "@/lib/app-shell";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  viewer: PublicUser;
}

const coreLinks = [
  { href: "/app/messages", icon: MessageSquareMore, label: "Сообщения" },
  { href: "/app/people", icon: Users2, label: "Люди" },
  { href: "/app/hubs", icon: Layers3, label: "Хабы" },
] as const;

const railIconProps = { size: 20, strokeWidth: 1.65 } as const;

function SidebarIconLink({
  active,
  children,
  href,
  label,
}: {
  active: boolean;
  children: ReactNode;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex h-12 w-12 items-center justify-center rounded-[16px] border border-transparent text-[#8d9aad] transition-all duration-150",
        "hover:border-white/8 hover:bg-white/[0.035] hover:text-white",
        active &&
          "border-[#2d6cdf]/40 bg-[linear-gradient(180deg,rgba(70,132,255,0.26),rgba(48,92,168,0.16))] text-white shadow-[0_12px_28px_rgba(7,16,31,0.3)]",
      )}
    >
      {active ? (
        <span className="absolute left-[-13px] top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-[#4a84ff]" />
      ) : null}
      {children}
    </Link>
  );
}

export function AppSidebar({ viewer }: AppSidebarProps) {
  const pathname = usePathname();
  const safePathname = pathname ?? "";

  return (
    <aside className="workspace-dock fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#0b121b] md:static md:inset-auto md:z-auto md:flex md:h-full md:w-[88px] md:flex-col md:border-r md:border-t-0 md:bg-[#0a121a]">
      <div className="flex items-center justify-between gap-2 px-2 py-2 md:flex h-full md:flex-col md:items-stretch md:justify-start md:px-3 md:py-4">
        <Link
          href="/app/messages"
          className="hidden items-center gap-2 rounded-[18px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_55%),rgba(17,26,38,0.96)] px-2.5 py-2 text-white shadow-[0_14px_32px_rgba(6,14,26,0.28)] md:flex"
          aria-label="Lobby"
          title="Lobby"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] border border-[#4a84ff]/30 bg-[linear-gradient(180deg,rgba(74,132,255,0.24),rgba(74,132,255,0.1))] text-[13px] font-semibold tracking-tight">
            Lb
          </span>
          <span className="text-[13px] font-semibold tracking-tight text-white/92">
            Lobby
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 md:mt-6 md:flex-col md:gap-2">
          {coreLinks.map((item) => (
            <SidebarIconLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={matchesPath(safePathname, item.href)}
            >
              <item.icon {...railIconProps} />
            </SidebarIconLink>
          ))}
        </nav>

        <div className="hidden h-px w-full bg-white/6 md:mt-5 md:block" />

        <div className="ml-auto flex items-center gap-1.5 md:mt-auto md:flex-col md:gap-2">
          <SidebarIconLink
            href="/app/settings/profile"
            label="Настройки"
            active={matchesPath(safePathname, "/app/settings")}
          >
            <Settings2 {...railIconProps} />
          </SidebarIconLink>

          {viewer.role !== "MEMBER" ? (
            <SidebarIconLink
              href="/app/admin"
              label="Админка"
              active={matchesPath(safePathname, "/app/admin")}
            >
              <ShieldCheck {...railIconProps} />
            </SidebarIconLink>
          ) : null}

          <LogoutButton
            aria-label="Выйти"
            title="Выйти"
            label=""
            pendingLabel=""
            showIcon
            variant="ghost"
            size="sm"
            className="hidden h-11 w-11 rounded-[16px] border border-transparent px-0 text-[#8d9aad] transition-all duration-150 hover:border-white/8 hover:bg-white/[0.035] hover:text-white md:inline-flex"
          />

          <Link
            href="/app/settings/profile"
            title="Профиль"
            aria-label="Профиль"
            className="ml-1 inline-flex rounded-full border border-transparent p-0.5 transition-all duration-150 hover:border-white/10 md:ml-0 md:mt-1"
          >
            <UserAvatar user={viewer} size="sm" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
