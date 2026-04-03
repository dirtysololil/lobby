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
      <main className="mx-auto grid min-h-screen w-full max-w-[1920px] grid-cols-1 gap-3 px-3 py-3 xl:grid-cols-[84px_320px_minmax(0,1fr)] 2xl:grid-cols-[84px_320px_minmax(0,1fr)_320px] 2xl:px-5">
        <AppSidebar viewer={viewer} />
        <AppContextRail viewer={viewer} />
        <div className="flex min-h-0 flex-col gap-3">
          <AppHeader viewer={viewer} />
          <IncomingCallBanner />
          <div className="min-h-0 flex-1">{children}</div>
        </div>
        <AppActivityRail viewer={viewer} />
      </main>
    </RealtimeProvider>
  );
}
