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
      <main className="mx-auto grid min-h-screen w-full max-w-[1800px] grid-cols-1 gap-3 px-3 py-3 lg:grid-cols-[72px_minmax(240px,286px)_minmax(0,1fr)] lg:px-4 lg:py-4">
        <AppSidebar viewer={viewer} />
        <AppContextRail viewer={viewer} />
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <AppHeader viewer={viewer} />
          <IncomingCallBanner />
          <div className="flex min-h-0 flex-1 gap-3">
            <div className="min-h-0 min-w-0 flex-1">{children}</div>
            <AppActivityRail viewer={viewer} />
          </div>
        </div>
      </main>
    </RealtimeProvider>
  );
}
