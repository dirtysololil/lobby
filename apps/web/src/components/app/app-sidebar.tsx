"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers3,
  MessageSquareMore,
  Plus,
  Settings2,
  ShieldCheck,
  Users2,
} from "lucide-react";
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

const railIconProps = { size: 20, strokeWidth: 1.5 } as const;

export function AppSidebar({ viewer }: AppSidebarProps) {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
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
    <aside className="workspace-dock fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#121214] md:static md:inset-auto md:z-auto md:flex md:min-h-screen md:w-[72px] md:flex-col md:items-center md:justify-between md:border-r md:border-t-0">
      <div className="flex items-center justify-between gap-2 px-2 py-2 md:h-full md:w-full md:flex-col md:px-0 md:py-3">
        <div className="flex items-center gap-1 md:w-full md:flex-col md:gap-2">
          <Link
            href="/app/messages"
            className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-semibold tracking-tight text-white md:flex"
            aria-label="Lobby"
            title="Lobby"
          >
            Lb
          </Link>

          <nav className="flex items-center gap-1 md:w-full md:flex-col md:px-2">
            {coreLinks.map((item) => {
              const active = matchesPath(safePathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    "dock-icon flex h-10 w-10 items-center justify-center rounded-2xl text-zinc-400",
                    active && "dock-icon-active text-white",
                  )}
                >
                  <item.icon {...railIconProps} />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden min-h-0 w-full flex-1 md:flex md:flex-col md:items-center md:py-2">
          <div className="signal-line w-8 bg-white/5" />
          <div className="mt-2 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
            {hubs.slice(0, 6).map((hub) => {
              const active = safePathname.startsWith(`/app/hubs/${hub.id}`);
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
                    "circle-chip flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-[10px] font-semibold text-zinc-300",
                    active && "circle-chip-active bg-white/10 text-white",
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
              className="circle-chip mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-zinc-400"
            >
              <Plus {...railIconProps} />
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-1 md:w-full md:flex-col md:px-2 md:gap-2">
          <Link
            href="/app/settings/profile"
            aria-label="Settings"
            title="Settings"
            className={cn(
              "dock-icon flex h-10 w-10 items-center justify-center rounded-2xl text-zinc-400",
              matchesPath(safePathname, "/app/settings") && "dock-icon-active text-white",
            )}
          >
            <Settings2 {...railIconProps} />
          </Link>
          {viewer.role !== "MEMBER" ? (
            <Link
              href="/app/admin"
              aria-label="Admin"
              title="Admin"
              className={cn(
                "dock-icon flex h-10 w-10 items-center justify-center rounded-2xl text-zinc-400",
                matchesPath(safePathname, "/app/admin") && "dock-icon-active text-white",
              )}
            >
              <ShieldCheck {...railIconProps} />
            </Link>
          ) : null}
          <Link
            href="/app/settings/profile"
            title="Profile"
            aria-label="Profile"
            className="ml-1 flex items-center justify-center md:ml-0"
          >
            <UserAvatar user={viewer} size="sm" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
