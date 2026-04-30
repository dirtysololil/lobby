"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { PublicUser } from "@lobby/shared";
import { AppContextRail } from "@/components/app/app-context-rail";
import { AppSidebar } from "@/components/app/app-sidebar";
import { PersistentCallDock } from "@/components/calls/call-session-provider";
import { IncomingCallBanner } from "@/components/realtime/incoming-call-banner";
import { NotificationSoundManager } from "@/components/realtime/notification-sound-manager";
import { parseAppPath } from "@/lib/app-shell";
import { subscribeToLogoutEvent } from "@/lib/logout-broadcast";
import { cn } from "@/lib/utils";

interface AppShellFrameProps {
  children: ReactNode;
  viewer: PublicUser;
}

export function AppShellFrame({ children, viewer }: AppShellFrameProps) {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const route = parseAppPath(safePathname);
  const isHomeWorkspaceRoute = route.section === "home";
  const isPeopleWorkspaceRoute =
    route.section === "people" && !route.peopleUsername;
  const isPeopleProfileRoute =
    route.section === "people" && Boolean(route.peopleUsername);
  const isStandaloneWorkspaceRoute =
    isHomeWorkspaceRoute || isPeopleWorkspaceRoute || isPeopleProfileRoute;
  const isMessagesRoute = route.section === "messages";
  const showContextRail = !isStandaloneWorkspaceRoute;
  const desktopGridColumns = isMessagesRoute
    ? "md:grid-cols-[88px_306px_minmax(0,1fr)]"
    : isStandaloneWorkspaceRoute
      ? "md:grid-cols-[88px_minmax(0,1fr)]"
    : "md:grid-cols-[88px_15rem_minmax(0,1fr)]";

  useEffect(() => {
    return subscribeToLogoutEvent(() => {
      window.location.replace("/login");
    });
  }, []);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-app)] text-[var(--text)]">
      <div
        className={cn(
          "relative z-10 grid h-full min-h-0 grid-cols-1",
          desktopGridColumns,
        )}
      >
        <AppSidebar viewer={viewer} />
        {showContextRail ? <AppContextRail viewer={viewer} /> : null}

        <main
          className={cn(
            "relative flex min-h-0 min-w-0 flex-col overflow-hidden pb-[var(--app-mobile-dock-clearance)] md:pb-0",
            "bg-black",
          )}
        >
          <IncomingCallBanner />
          <NotificationSoundManager viewer={viewer} />

          {isMessagesRoute ? (
            children
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden">
              <div
                className={cn(
                  "flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0",
                  isStandaloneWorkspaceRoute
                    ? "bg-transparent"
                    : "shell-frame bg-black",
                )}
              >
                {children}
              </div>
            </div>
          )}
        </main>
      </div>

      <PersistentCallDock />
    </div>
  );
}
