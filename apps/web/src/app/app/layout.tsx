import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/app-header";
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
      <main className="grid min-h-screen w-full grid-cols-1 gap-4 px-3 py-3 sm:px-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-5 lg:px-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <AppSidebar viewer={viewer} />
        <div className="flex min-h-0 flex-col gap-4 lg:gap-5">
          <AppHeader viewer={viewer} />
          <IncomingCallBanner />
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </main>
    </RealtimeProvider>
  );
}
