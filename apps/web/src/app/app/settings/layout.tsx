import type { ReactNode } from "react";

export default function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="grid gap-3 px-3 py-3 md:px-4 md:py-4">
      <section className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
        <div>
          <p className="section-kicker">Настройки</p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-white">
            Личное пространство
          </h1>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            Настраивайте профиль, присутствие, аватары и уведомления, не выпадая из
            основного рабочего ритма.
          </p>
        </div>
      </section>
      {children}
    </div>
  );
}
