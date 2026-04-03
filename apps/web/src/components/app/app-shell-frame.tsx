"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { PublicUser } from "@lobby/shared";
import { AppActivityRail } from "@/components/app/app-activity-rail";
import { AppContextRail } from "@/components/app/app-context-rail";
import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { IncomingCallBanner } from "@/components/realtime/incoming-call-banner";
import { parseAppPath } from "@/lib/app-shell";

interface AppShellFrameProps {
  children: ReactNode;
  viewer: PublicUser;
}

export function AppShellFrame({ children, viewer }: AppShellFrameProps) {
  const pathname = usePathname();
  const route = parseAppPath(pathname);
  const activityAvailable =
    (route.section === "messages" && Boolean(route.conversationId)) ||
    (route.section === "hubs" && Boolean(route.hubId));
  const [activityOpen, setActivityOpen] = useState(false);

  useEffect(() => {
    setActivityOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!activityAvailable) {
      setActivityOpen(false);
    }
  }, [activityAvailable]);

  return (
    <div className="relative min-h-screen bg-[var(--bg-app)] text-[var(--text)]">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[56px_minmax(240px,280px)_minmax(0,1fr)] lg:grid-cols-[56px_minmax(256px,288px)_minmax(0,1fr)]">
        <AppSidebar viewer={viewer} />
        <AppContextRail viewer={viewer} />
        <div className="relative flex min-h-screen min-w-0 flex-col border-l border-[var(--border)] md:border-l-0">
          <div className="sticky top-0 z-30 border-b border-[var(--border)] bg-[rgba(13,15,18,0.94)] backdrop-blur-sm">
            <AppHeader
              activityAvailable={activityAvailable}
              activityOpen={activityOpen}
              onToggleActivity={() => setActivityOpen((current) => !current)}
              viewer={viewer}
            />
            <IncomingCallBanner />
          </div>

          <div className="min-h-0 flex-1 overflow-hidden pb-20 md:pb-0">
            {children}
          </div>
        </div>
      </div>

      <AppActivityRail
        viewer={viewer}
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
      />
    </div>
  );
}
