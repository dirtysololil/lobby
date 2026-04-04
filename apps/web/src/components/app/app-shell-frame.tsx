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

const panelIconProps = { size: 20, strokeWidth: 1.5 } as const;

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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(106,168,248,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_20%)]" />
      <div
        className={cn(
          "relative z-10 grid min-h-screen grid-cols-1 md:grid-cols-[72px_15rem_minmax(0,1fr)]",
          showDockedActivityRail && "2xl:grid-cols-[72px_15rem_minmax(0,1fr)_16rem]",
        )}
      >
        <AppSidebar viewer={viewer} />
        <AppContextRail viewer={viewer} />

        <main className="relative flex min-h-screen min-w-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.012),transparent_18%)]">
          {activityAvailable ? (
            <button
              type="button"
              onClick={() => setActivityOpen((current) => !current)}
              className={cn(
                "absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/5 bg-[var(--bg-sidebar)]/92 text-[var(--text-muted)] backdrop-blur-md transition-colors hover:bg-white/5 hover:text-white",
                activityOpen && "border-[rgba(106,168,248,0.22)] bg-[rgba(106,168,248,0.12)] text-white",
              )}
              aria-label={activityOpen ? "Hide details" : "Show details"}
            >
              {activityOpen ? (
                <PanelRightClose {...panelIconProps} />
              ) : (
                <PanelRightOpen {...panelIconProps} />
              )}
            </button>
          ) : null}

          <IncomingCallBanner />

          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
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
