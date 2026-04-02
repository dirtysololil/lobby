import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="grid gap-6">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Personal settings</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Profile and notifications</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Manage your public profile, avatar presets, safe animated avatar uploads and notification routing
          across direct messages, hubs and lobbies.
        </p>
      </section>
      <SettingsNav />
      {children}
    </div>
  );
}
