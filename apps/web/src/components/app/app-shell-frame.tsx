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
  const effectiveActivityOpen = activityAvailable && activityOpen;

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

  const showDockedActivityRail = effectiveActivityOpen && isWideScreen;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-app)] text-[var(--text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(106,168,248,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_20%)]" />
      <div
        className={cn(
          "relative z-10 grid h-full min-h-0 grid-cols-1 md:grid-cols-[64px_14rem_minmax(0,1fr)]",
          showDockedActivityRail && "2xl:grid-cols-[64px_14rem_minmax(0,1fr)_18rem]",
        )}
      >
        <AppSidebar viewer={viewer} />
        <AppContextRail viewer={viewer} />

        <main className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.012),transparent_18%)]">
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

          <div className="min-h-0 flex-1 overflow-hidden p-1.5 md:p-2 lg:p-2.5">
            <div className="shell-frame flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent_16%),rgba(8,13,20,0.92)]">
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
