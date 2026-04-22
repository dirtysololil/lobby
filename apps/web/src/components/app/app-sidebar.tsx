"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
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

const utilityLinks = [
  { href: "/app/settings/profile", icon: Settings2, label: "Настройки" },
  {
    href: "/app/settings/notifications",
    icon: Bell,
    label: "Уведомления",
  },
] as const;

const railIconProps = { size: 22, strokeWidth: 2.15 } as const;

function SidebarIconLink({
  active,
  children,
  className,
  href,
  label,
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "group relative inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-[#a6afbd] transition-all duration-150 md:h-[52px] md:w-[52px] md:rounded-[15px]",
        "hover:bg-white/[0.026] hover:text-white",
        active &&
          "bg-[#101b27] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]",
        className,
      )}
    >
      {active ? (
        <>
          <span className="pointer-events-none absolute left-[-20px] top-1/2 hidden h-12 w-10 -translate-y-1/2 rounded-full bg-[#4a84ff]/16 blur-[14px] md:block" />
          <span className="pointer-events-none absolute left-[-18px] top-1/2 hidden h-11 w-[2px] -translate-y-1/2 rounded-full bg-[#4a84ff] shadow-[0_0_13px_rgba(74,132,255,0.58)] md:block" />
        </>
      ) : null}
      {children}
    </Link>
  );
}

export function AppSidebar({ viewer }: AppSidebarProps) {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const isMessagesRoute = matchesPath(safePathname, "/app/messages");

  return (
    <aside className="workspace-dock hidden bg-[#0a1016] md:static md:z-auto md:flex md:h-full md:w-[88px] md:flex-col md:border-r md:border-white/5 md:bg-[#0a1016]">
      <div className="hidden h-full items-center justify-between gap-2 px-2 py-2 md:flex md:flex-col md:items-center md:justify-start md:px-0 md:pb-4 md:pt-[28px]">
        <Link
          href="/app/messages"
          className="hidden h-[46px] w-[46px] items-center justify-center rounded-[11px] border border-white/13 bg-[#111821] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] md:flex"
          aria-label="Lobby"
          title="Lobby"
        >
          <span className="select-none text-[14px] font-bold tracking-[-0.07em] text-white">
            LB
          </span>
        </Link>

        <div className="hidden h-px w-[74px] bg-white/6 md:mt-[28px] md:block" />

        <nav className="flex items-center gap-1.5 md:mt-[18px] md:flex-col md:gap-[18px]">
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

        <div className="hidden h-px w-[74px] bg-white/6 md:mt-[28px] md:block" />

        <div className="ml-auto flex items-center gap-1.5 md:ml-0 md:mt-auto md:w-full md:flex-col md:items-center md:gap-[18px] md:pb-3">
          {utilityLinks.map((item) => (
            <SidebarIconLink
              key={item.href}
              className="hidden md:inline-flex"
              href={item.href}
              label={item.label}
              active={matchesPath(safePathname, item.href)}
            >
              <item.icon {...railIconProps} />
            </SidebarIconLink>
          ))}

          {!isMessagesRoute && viewer.role !== "MEMBER" ? (
            <SidebarIconLink
              className="hidden md:inline-flex"
              href="/app/admin"
              label="Админка"
              active={matchesPath(safePathname, "/app/admin")}
            >
              <ShieldCheck {...railIconProps} />
            </SidebarIconLink>
          ) : null}

          {!isMessagesRoute ? (
            <LogoutButton
              aria-label="Выйти"
              title="Выйти"
              label=""
              pendingLabel=""
              showIcon
              variant="ghost"
              size="sm"
              className="hidden h-[52px] w-[52px] rounded-[15px] border-0 bg-transparent px-0 text-[#a6afbd] transition-all duration-150 hover:bg-white/[0.026] hover:text-white [&_svg]:h-[22px] [&_svg]:w-[22px] [&_svg]:stroke-[2.15] md:inline-flex"
            />
          ) : null}

          <Link
            href="/app/settings/profile"
            title="Профиль"
            aria-label="Профиль"
            className="ml-1 inline-flex rounded-full border border-white/8 p-0.5 transition-all duration-150 hover:border-white/14 md:ml-0 md:mt-1"
          >
            <UserAvatar
              user={viewer}
              size="lg"
              className="h-[46px] w-[46px] text-[11px]"
            />
          </Link>
        </div>
      </div>
    </aside>
  );
}
