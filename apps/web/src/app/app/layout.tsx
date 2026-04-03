import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/app-header";
import { AppActivityRail } from "@/components/app/app-activity-rail";
import { AppContextRail } from "@/components/app/app-context-rail";
import { AppSidebar } from "@/components/app/app-sidebar";
import { IncomingCallBanner } from "@/components/realtime/incoming-call-banner";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { requireViewer } from "@/lib/server-session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const viewer = await requireViewer();

  return (
    <RealtimeProvider viewer={viewer}>
      <main className="mx-auto grid min-h-screen w-full max-w-[1680px] grid-cols-1 gap-2.5 px-2.5 py-2.5 lg:grid-cols-[68px_minmax(216px,272px)_minmax(0,1fr)] lg:px-3 lg:py-3 xl:grid-cols-[68px_minmax(224px,272px)_minmax(0,1fr)]">
        <AppSidebar viewer={viewer} />
        <AppContextRail viewer={viewer} />
        <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
          <AppHeader viewer={viewer} />
          <IncomingCallBanner />
          <div className="flex min-h-0 flex-1 gap-2.5">
            <div className="min-h-0 min-w-0 flex-1">{children}</div>
            <AppActivityRail viewer={viewer} />
          </div>
        </div>
      </main>
    </RealtimeProvider>
  );
}
