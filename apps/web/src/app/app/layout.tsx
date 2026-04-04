import type { ReactNode } from "react";
import { AppShellFrame } from "@/components/app/app-shell-frame";
import { CallSessionProvider } from "@/components/calls/call-session-provider";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { requireViewer } from "@/lib/server-session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const viewer = await requireViewer();

  return (
    <RealtimeProvider viewer={viewer}>
      <CallSessionProvider>
        <AppShellFrame viewer={viewer}>{children}</AppShellFrame>
      </CallSessionProvider>
    </RealtimeProvider>
  );
}
