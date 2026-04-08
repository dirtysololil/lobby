import type { ReactNode } from "react";
import { AppRuntimeShell } from "@/components/app/app-runtime-shell";
import { requireViewer } from "@/lib/server-session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const viewer = await requireViewer();

  return (
    <AppRuntimeShell viewer={viewer}>{children}</AppRuntimeShell>
  );
}
