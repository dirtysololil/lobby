import type { ReactNode } from "react";

export default function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="grid gap-4">
      <section className="social-shell rounded-[20px] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow-pill">Settings</span>
          <span className="status-pill">Personal</span>
        </div>
        <h1 className="mt-1.5 font-[var(--font-heading)] text-[1.1rem] font-semibold tracking-[-0.04em] text-white">
          Профиль и уведомления
        </h1>
      </section>
      {children}
    </div>
  );
}
