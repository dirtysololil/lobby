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
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!mounted) {
    return (
      <div className="relative h-[100dvh] overflow-hidden bg-[var(--bg-app)] text-[var(--text)]">
        <div className="relative z-10 flex h-full min-h-0 items-center justify-center p-6">
          <div className="rounded-[18px] border border-white/8 bg-black px-5 py-4 text-sm text-[var(--text-muted)]">
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
