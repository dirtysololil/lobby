"use client";

import type { ReactNode } from "react";
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

const railIconProps = { size: 23, strokeWidth: 1.8 } as const;

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
        "group relative inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-transparent text-[#99a5b6] transition-all duration-150 md:h-[58px] md:w-[58px] md:rounded-[18px]",
        "hover:border-white/6 hover:bg-white/[0.028] hover:text-white",
        active &&
          "border-[#183963] bg-[#101923] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className,
      )}
    >
      {active ? (
        <>
          <span className="pointer-events-none absolute left-[-24px] top-1/2 hidden h-11 w-10 -translate-y-1/2 rounded-full bg-[#4a84ff]/18 blur-[14px] md:block" />
          <span className="pointer-events-none absolute left-[-18px] top-1/2 hidden h-10 w-[3px] -translate-y-1/2 rounded-full bg-[#4a84ff] shadow-[0_0_14px_rgba(74,132,255,0.55)] md:block" />
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
    <aside className="workspace-dock fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#0a1016] md:static md:inset-auto md:z-auto md:flex md:h-full md:w-[114px] md:flex-col md:border-r md:border-t-0 md:bg-[#0a1016]">
      <div className="flex h-full items-center justify-between gap-2 px-2 py-2 md:flex-col md:items-center md:justify-start md:px-0 md:py-4">
        <Link
          href="/app/messages"
          className="hidden h-[58px] w-[58px] items-center justify-center rounded-[16px] border border-white/12 bg-[#121923] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:flex"
          aria-label="Lobby"
          title="Lobby"
        >
          <span className="select-none text-[18px] font-semibold tracking-[-0.08em] text-white">
            LB
          </span>
        </Link>

        <div className="hidden h-px w-[82px] bg-white/6 md:mt-6 md:block" />

        <nav className="flex items-center gap-1.5 md:mt-6 md:flex-col md:gap-3">
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

        <div className="hidden h-px w-[82px] bg-white/6 md:mt-6 md:block" />

        <div className="ml-auto flex items-center gap-1.5 md:mt-auto md:flex-col md:gap-3 md:pb-3">
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
              className="hidden h-[58px] w-[58px] rounded-[18px] border border-transparent bg-transparent px-0 text-[#99a5b6] transition-all duration-150 hover:border-white/6 hover:bg-white/[0.028] hover:text-white [&_svg]:h-[23px] [&_svg]:w-[23px] md:inline-flex"
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
              className="h-11 w-11 text-[11px]"
            />
          </Link>
        </div>
      </div>
    </aside>
  );
}
