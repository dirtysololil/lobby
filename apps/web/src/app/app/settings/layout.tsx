import Link from "next/link";
import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { AppMobileTopNav } from "@/components/app/app-mobile-top-nav";
import { CompactListMeta } from "@/components/ui/compact-list";

export default function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-black">
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="border-b border-[var(--border-soft)] px-4 pb-3 pt-5 md:px-5 md:pb-4 md:pt-5">
          <div className="md:hidden">
            <AppMobileTopNav active="settings" />
          </div>

          <div className="mt-4 flex flex-col gap-4 md:mt-0 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CompactListMeta className="border-[var(--border-soft)] bg-black text-[var(--text-muted)]">
                  Настройки
                </CompactListMeta>
                <CompactListMeta className="border-[var(--border-soft)] bg-black text-[var(--text-muted)]">
                  Профиль
                </CompactListMeta>
                <CompactListMeta className="border-[var(--border-soft)] bg-black text-[var(--text-muted)]">
                  Аватар
                </CompactListMeta>
                <CompactListMeta className="border-[var(--border-soft)] bg-black text-[var(--text-muted)]">
                  Рингтон
                </CompactListMeta>
              </div>
              <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.04em] text-white">
                Личное пространство
              </h1>
              <p className="mt-1 max-w-[48rem] text-sm text-[var(--text-dim)]">
                Настраивайте профиль, присутствие, аватар и звук входящего звонка
                в том же компактном рабочем каркасе, что и остальные разделы.
              </p>
            </div>

            <Link
              href="/app/settings/notifications"
              className="hidden min-h-11 items-center justify-center gap-2 rounded-[14px] border border-[var(--border)] bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--bg-hover)] md:inline-flex"
            >
              <Bell size={17} strokeWidth={1.75} />
              Уведомления
            </Link>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid min-h-full w-full content-start gap-3 px-4 py-3 md:px-5 md:py-5">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
