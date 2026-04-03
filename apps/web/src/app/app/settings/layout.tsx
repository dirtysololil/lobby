import type { ReactNode } from "react";

export default function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="grid gap-4">
      <section className="social-shell rounded-[24px] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow-pill">Settings</span>
          <span className="status-pill">Personal surface</span>
        </div>
        <h1 className="mt-2 font-[var(--font-heading)] text-[1.4rem] font-semibold tracking-[-0.04em] text-white">
          Профиль и уведомления
        </h1>
      </section>
      {children}
    </div>
  );
}
