"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { AppActivityRail } from "@/components/app/app-activity-rail";
import { AppContextRail } from "@/components/app/app-context-rail";
import { AppSidebar } from "@/components/app/app-sidebar";
import { IncomingCallBanner } from "@/components/realtime/incoming-call-banner";
import { parseAppPath } from "@/lib/app-shell";
import { cn } from "@/lib/utils";

interface AppShellFrameProps {
  children: ReactNode;
  viewer: PublicUser;
}

export function AppShellFrame({ children, viewer }: AppShellFrameProps) {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const route = parseAppPath(safePathname);
  const activityAvailable =
    (route.section === "messages" && Boolean(route.conversationId)) ||
    (route.section === "hubs" && Boolean(route.hubId));
  const [activityOpen, setActivityOpen] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(false);

  useEffect(() => {
    setActivityOpen(false);
  }, [safePathname]);

  useEffect(() => {
    if (!activityAvailable) {
      setActivityOpen(false);
    }
  }, [activityAvailable]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(min-width: 1536px)");

    function syncMediaState(event?: MediaQueryListEvent) {
      setIsWideScreen(event ? event.matches : media.matches);
    }

    syncMediaState();
    media.addEventListener("change", syncMediaState);

    return () => {
      media.removeEventListener("change", syncMediaState);
    };
  }, []);

  const showDockedActivityRail = activityAvailable && activityOpen && isWideScreen;

  return (
    <div className="relative min-h-screen bg-[var(--bg-app)] text-[var(--text)]">
      <div
        className={cn(
          "grid min-h-screen grid-cols-1 md:grid-cols-[72px_16rem_minmax(0,1fr)]",
          showDockedActivityRail && "2xl:grid-cols-[72px_16rem_minmax(0,1fr)_16rem]",
        )}
      >
        <AppSidebar viewer={viewer} />
        <AppContextRail viewer={viewer} />

        <main className="relative flex min-h-screen min-w-0 flex-col bg-[var(--bg-app)]">
          {activityAvailable ? (
            <button
              type="button"
              onClick={() => setActivityOpen((current) => !current)}
              className={cn(
                "absolute right-3 top-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-lg text-white transition-colors",
                activityOpen
                  ? "bg-[var(--bg-active)]"
                  : "bg-[var(--bg-panel-soft)] hover:bg-[var(--bg-hover)]",
              )}
              aria-label={activityOpen ? "Hide details" : "Show details"}
            >
              {activityOpen ? (
                <PanelRightClose className="h-5 w-5" />
              ) : (
                <PanelRightOpen className="h-5 w-5" />
              )}
            </button>
          ) : null}

          <div className="px-3 pt-3">
            <IncomingCallBanner />
          </div>

          <div className="min-h-0 flex-1 overflow-hidden pb-20 md:pb-0">
            {children}
          </div>
        </main>

        {showDockedActivityRail ? (
          <AppActivityRail
            viewer={viewer}
            open={activityOpen}
            onClose={() => setActivityOpen(false)}
            mode="docked"
          />
        ) : null}
      </div>

      {activityAvailable && activityOpen && !showDockedActivityRail ? (
        <AppActivityRail
          viewer={viewer}
          open={activityOpen}
          onClose={() => setActivityOpen(false)}
          mode="overlay"
        />
      ) : null}
    </div>
  );
}
