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
      <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <AppSidebar />
        <div className="flex min-h-0 flex-col gap-6">
          <AppHeader viewer={viewer} />
          <IncomingCallBanner />
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </main>
    </RealtimeProvider>
  );
}
