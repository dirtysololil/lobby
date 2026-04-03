import type { ReactNode } from "react";
import { AppShellFrame } from "@/components/app/app-shell-frame";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { requireViewer } from "@/lib/server-session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const viewer = await requireViewer();

  return (
    <RealtimeProvider viewer={viewer}>
      <AppShellFrame viewer={viewer}>{children}</AppShellFrame>
    </RealtimeProvider>
  );
}
