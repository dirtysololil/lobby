"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers3, MessageSquareMore, Plus, Settings2, ShieldCheck, Users2 } from "lucide-react";
import { hubListResponseSchema, type HubSummary, type PublicUser } from "@lobby/shared";
import { useEffect, useState } from "react";
import { apiClientFetch } from "@/lib/api-client";
import { matchesPath } from "@/lib/app-shell";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";

interface AppSidebarProps {
  viewer: PublicUser;
}

const coreLinks = [
  { href: "/app/messages", icon: MessageSquareMore, label: "Inbox" },
  { href: "/app/people", icon: Users2, label: "People" },
  { href: "/app/hubs", icon: Layers3, label: "Hubs" },
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
    <aside className="workspace-dock flex gap-1.5 rounded-[20px] p-1.5 lg:sticky lg:top-3 lg:h-[calc(100vh-1.5rem)] lg:flex-col lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:w-full lg:flex-none lg:flex-col">
        <Link
          href="/app/messages"
          className="dock-icon dock-icon-active flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent)] text-[#180d08]"
          aria-label="Lobby inbox"
        >
          <span className="text-sm font-bold tracking-[-0.04em]">Lb</span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto lg:w-full lg:flex-none lg:flex-col lg:overflow-visible">
          {coreLinks.map((item) => {
            const active = matchesPath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "dock-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] lg:h-11 lg:w-11",
                  active && "dock-icon-active",
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="hidden w-full flex-1 lg:flex lg:min-h-0 lg:flex-col lg:items-center">
        <div className="signal-line w-8" />
        <div className="mt-2.5 flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto">
          {hubs.slice(0, 6).map((hub) => {
            const active = pathname.startsWith(`/app/hubs/${hub.id}`);
            const initials = hub.name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0] ?? "")
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <Link
                key={hub.id}
                href={`/app/hubs/${hub.id}`}
                title={hub.name}
                aria-label={hub.name}
                className={cn(
                  "circle-chip flex h-10 w-10 items-center justify-center rounded-[14px] text-[10px] font-semibold text-white",
                  active && "circle-chip-active",
                )}
              >
                {initials}
              </Link>
            );
          })}

          <Link
            href="/app/hubs"
            aria-label="Open hubs"
            title="Open hubs"
            className="circle-chip mt-0.5 flex h-9 w-9 items-center justify-center rounded-[14px]"
          >
            <Plus className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:w-full lg:flex-col">
        <Link
          href="/app/settings/profile"
          aria-label="Settings"
          title="Settings"
          className={cn(
            "dock-icon flex h-10 w-10 items-center justify-center rounded-[14px]",
            matchesPath(pathname, "/app/settings") && "dock-icon-active",
          )}
        >
          <Settings2 className="h-4 w-4" />
        </Link>
        {viewer.role !== "MEMBER" ? (
          <Link
            href="/app/admin"
            aria-label="Admin"
            title="Admin"
            className={cn(
              "dock-icon flex h-10 w-10 items-center justify-center rounded-[14px]",
              matchesPath(pathname, "/app/admin") && "dock-icon-active",
            )}
          >
            <ShieldCheck className="h-4 w-4" />
          </Link>
        ) : null}
        <Link href="/app/settings/profile" className="ml-1 lg:ml-0 lg:mt-1">
          <UserAvatar user={viewer} size="sm" />
        </Link>
      </div>
    </aside>
  );
}
