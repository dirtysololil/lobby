"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Layers3,
  MessageSquareMore,
  Plus,
  Settings2,
  ShieldCheck,
  Users2,
  Waves,
} from "lucide-react";
import {
  hubListResponseSchema,
  type HubSummary,
  type PublicUser,
} from "@lobby/shared";
import { useEffect, useState } from "react";
import { apiClientFetch } from "@/lib/api-client";
import { matchesPath } from "@/lib/app-shell";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";

interface AppSidebarProps {
  viewer: PublicUser;
}

const coreLinks = [
  { href: "/app", icon: Compass, label: "Обзор" },
  { href: "/app/people", icon: Users2, label: "Люди" },
  { href: "/app/messages", icon: MessageSquareMore, label: "Диалоги" },
  { href: "/app/hubs", icon: Layers3, label: "Хабы" },
] as const;

export function AppSidebar({ viewer }: AppSidebarProps) {
  const pathname = usePathname();
  const [hubs, setHubs] = useState<HubSummary[]>([]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const payload = await apiClientFetch("/v1/hubs");
        const nextHubs = hubListResponseSchema.parse(payload).items;

        if (active) {
          setHubs(nextHubs);
        }
      } catch {
        if (active) {
          setHubs([]);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <aside className="workspace-dock flex gap-3 rounded-[28px] p-3 xl:sticky xl:top-3 xl:h-[calc(100vh-1.5rem)] xl:flex-col xl:items-center xl:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3 xl:w-full xl:flex-none xl:flex-col">
        <Link
          href="/app"
          className="dock-icon dock-icon-active flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px]"
          aria-label="Lobby home"
        >
          <Waves className="h-5 w-5" />
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto xl:w-full xl:flex-none xl:flex-col xl:overflow-visible">
          {coreLinks.map((item) => {
            const active = matchesPath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "dock-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] xl:h-14 xl:w-14 xl:rounded-[20px]",
                  active && "dock-icon-active",
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="hidden w-full flex-1 xl:flex xl:min-h-0 xl:flex-col xl:items-center">
        <div className="signal-line w-10" />
        <div className="mt-4 flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto">
          {hubs.slice(0, 10).map((hub) => {
            const active = pathname.startsWith(`/app/hubs/${hub.id}`);
            const initials = hub.name.slice(0, 2).toUpperCase();

            return (
              <Link
                key={hub.id}
                href={`/app/hubs/${hub.id}`}
                title={hub.name}
                aria-label={hub.name}
                className={cn(
                  "circle-chip flex h-14 w-14 items-center justify-center rounded-[22px] text-sm font-semibold text-white",
                  active && "circle-chip-active",
                )}
              >
                {initials}
              </Link>
            );
          })}

          <Link
            href="/app/hubs"
            aria-label="Все хабы"
            title="Создать или открыть хаб"
            className="circle-chip mt-1 flex h-12 w-12 items-center justify-center rounded-[18px]"
          >
            <Plus className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 xl:w-full xl:flex-col">
        <Link
          href="/app/settings/profile"
          aria-label="Настройки"
          title="Настройки"
          className={cn(
            "dock-icon flex h-12 w-12 items-center justify-center rounded-[18px]",
            matchesPath(pathname, "/app/settings") && "dock-icon-active",
          )}
        >
          <Settings2 className="h-4 w-4" />
        </Link>
        {viewer.role !== "MEMBER" ? (
          <Link
            href="/app/admin"
            aria-label="Контроль"
            title="Контроль"
            className={cn(
              "dock-icon flex h-12 w-12 items-center justify-center rounded-[18px]",
              matchesPath(pathname, "/app/admin") && "dock-icon-active",
            )}
          >
            <ShieldCheck className="h-4 w-4" />
          </Link>
        ) : null}
        <div className="ml-1 xl:ml-0 xl:mt-2">
          <UserAvatar user={viewer} size="sm" />
        </div>
      </div>
    </aside>
  );
}
