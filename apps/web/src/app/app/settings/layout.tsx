import type { ReactNode } from "react";

export default function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="grid gap-4">
      <section className="social-shell rounded-[24px] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">Settings</span>
              <span className="status-pill">Personal workspace</span>
            </div>
            <h1 className="mt-3 text-lg font-semibold tracking-tight text-white">
              Profile, presence and notification controls
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-dim)]">
              Keep your identity, avatar behavior and alert rules aligned across DMs,
              hubs and the wider Lobby workspace.
            </p>
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}
