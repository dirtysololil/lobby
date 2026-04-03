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
    <aside className="workspace-dock fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[rgba(10,12,15,0.96)] backdrop-blur-sm md:static md:z-auto md:flex md:min-h-screen md:flex-col md:items-center md:justify-between md:border-r md:border-t-0">
      <div className="flex items-center justify-between gap-2 px-2 py-2 md:h-full md:flex-col md:px-0 md:py-3">
        <div className="flex items-center gap-1 md:flex-col">
          <Link
            href="/app/messages"
            className="hidden h-10 w-10 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--bg-panel)] text-sm font-bold tracking-[-0.04em] text-white md:flex"
            aria-label="Lobby"
            title="Lobby"
          >
            Lb
          </Link>

          <nav className="flex items-center gap-1 md:flex-col">
            {coreLinks.map((item) => {
              const active = matchesPath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    "dock-icon flex h-9 w-9 items-center justify-center rounded-[12px] md:h-10 md:w-10",
                    active && "dock-icon-active",
                  )}
                >
                  <item.icon className="h-[17px] w-[17px]" />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden min-h-0 flex-1 flex-col items-center py-3 md:flex">
          <div className="signal-line mb-2 w-7" />
          <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto px-1">
            {hubs.slice(0, 7).map((hub) => {
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
                    "circle-chip flex h-9 w-9 items-center justify-center rounded-[12px] text-[10px] font-semibold text-white",
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
              className="circle-chip mt-1 flex h-8 w-8 items-center justify-center rounded-[12px]"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-1 md:flex-col">
          <Link
            href="/app/settings/profile"
            aria-label="Settings"
            title="Settings"
            className={cn(
              "dock-icon flex h-9 w-9 items-center justify-center rounded-[12px] md:h-10 md:w-10",
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
                "dock-icon flex h-9 w-9 items-center justify-center rounded-[12px] md:h-10 md:w-10",
                matchesPath(pathname, "/app/admin") && "dock-icon-active",
              )}
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
          ) : null}
          <Link
            href="/app/settings/profile"
            title="Profile"
            aria-label="Profile"
            className="ml-1 flex items-center justify-center md:ml-0 md:mt-1"
          >
            <UserAvatar user={viewer} size="sm" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
