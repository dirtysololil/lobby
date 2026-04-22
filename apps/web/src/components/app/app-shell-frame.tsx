"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { AppActivityRail } from "@/components/app/app-activity-rail";
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

const panelIconProps = { size: 20, strokeWidth: 1.5 } as const;

export function AppShellFrame({ children, viewer }: AppShellFrameProps) {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const route = parseAppPath(safePathname);
  const activityAvailable = route.section === "hubs" && Boolean(route.hubId);
  const [activityOpen, setActivityOpen] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(false);
  const effectiveActivityOpen = activityAvailable && activityOpen;
  const isMessagesRoute = route.section === "messages";
  const desktopGridColumns = isMessagesRoute
    ? "md:grid-cols-[114px_306px_minmax(0,1fr)]"
    : "md:grid-cols-[80px_15rem_minmax(0,1fr)]";
  const dockedGridColumns = isMessagesRoute
    ? "2xl:grid-cols-[114px_306px_minmax(0,1fr)_18rem]"
    : "2xl:grid-cols-[80px_15rem_minmax(0,1fr)_18rem]";

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

  useEffect(() => {
    return subscribeToLogoutEvent(() => {
      window.location.replace("/login");
    });
  }, []);

  const showDockedActivityRail = effectiveActivityOpen && isWideScreen;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-app)] text-[var(--text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(92,140,214,0.05),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.012),transparent_18%)]" />
      <div
        className={cn(
          "relative z-10 grid h-full min-h-0 grid-cols-1",
          desktopGridColumns,
          showDockedActivityRail && dockedGridColumns,
        )}
      >
        <AppSidebar viewer={viewer} />
        <AppContextRail viewer={viewer} />

        <main className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.008),transparent_18%)] pb-[var(--app-mobile-dock-clearance)] md:pb-0">
          {activityAvailable ? (
            <button
              type="button"
              onClick={() => setActivityOpen((current) => !current)}
              className={cn(
                "absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/5 bg-[var(--bg-sidebar)]/92 text-[var(--text-muted)] backdrop-blur-md transition-colors hover:bg-white/5 hover:text-white",
                effectiveActivityOpen &&
                  "border-[rgba(106,168,248,0.22)] bg-[rgba(106,168,248,0.12)] text-white",
              )}
              aria-label={effectiveActivityOpen ? "Скрыть детали" : "Показать детали"}
            >
              {effectiveActivityOpen ? (
                <PanelRightClose {...panelIconProps} />
              ) : (
                <PanelRightOpen {...panelIconProps} />
              )}
            </button>
          ) : null}

          <IncomingCallBanner />
          <NotificationSoundManager viewer={viewer} />

          <div className="min-h-0 flex-1 overflow-hidden p-[4px]">
            <div className="shell-frame flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.012),transparent_14%),rgba(8,13,20,0.96)]">
              {children}
            </div>
          </div>
        </main>

        {showDockedActivityRail ? (
          <AppActivityRail
            viewer={viewer}
            open={effectiveActivityOpen}
            onClose={() => setActivityOpen(false)}
            mode="docked"
          />
        ) : null}
      </div>

      {effectiveActivityOpen && !showDockedActivityRail ? (
        <AppActivityRail
          viewer={viewer}
          open={effectiveActivityOpen}
          onClose={() => setActivityOpen(false)}
          mode="overlay"
        />
      ) : null}

      <PersistentCallDock />
    </div>
  );
}
