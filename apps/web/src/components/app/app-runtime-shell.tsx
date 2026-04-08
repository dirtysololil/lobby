"use client";

import type { PublicUser } from "@lobby/shared";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CallSessionProvider } from "@/components/calls/call-session-provider";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { AppShellFrame } from "./app-shell-frame";

interface AppRuntimeShellProps {
  viewer: PublicUser;
  children: ReactNode;
}

export function AppRuntimeShell({ viewer, children }: AppRuntimeShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-app)] text-[var(--text)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(106,168,248,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_20%)]" />
        <div className="relative z-10 flex h-full min-h-0 items-center justify-center p-6">
          <div className="rounded-[22px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent_16%),rgba(8,13,20,0.92)] px-5 py-4 text-sm text-[var(--text-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            Загружаем Lobby...
          </div>
        </div>
      </div>
    );
  }

  return (
    <RealtimeProvider viewer={viewer}>
      <CallSessionProvider>
        <AppShellFrame viewer={viewer}>{children}</AppShellFrame>
      </CallSessionProvider>
    </RealtimeProvider>
  );
}
