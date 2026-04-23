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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="grid min-h-full w-full content-start">
          <div className="border-b border-[var(--border-soft)] px-4 pb-3 pt-3 md:px-5 md:pb-4 md:pt-5">
            <div className="md:hidden">
              <AppMobileTopNav active="settings" />
            </div>

            <div className="mt-3 flex items-start justify-between gap-3 md:mt-0">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3 md:block">
                  <CompactListMeta className="border-[var(--border-soft)] bg-black text-[var(--text-muted)]">
                    Настройки
                  </CompactListMeta>

                  <Link
                    href="/app/settings/notifications"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border)] bg-black text-white transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] md:hidden"
                    aria-label="Уведомления"
                  >
                    <Bell size={16} strokeWidth={1.75} />
                  </Link>
                </div>

                <div className="mt-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-[20px] font-semibold tracking-[-0.04em] text-white md:text-[24px]">
                      Личные параметры
                    </h1>
                    <p className="mt-1 max-w-[42rem] text-[13px] leading-5 text-[var(--text-dim)] md:text-sm">
                      Профиль, статус, звук и уведомления в одной компактной панели.
                    </p>
                  </div>

                  <Link
                    href="/app/settings/notifications"
                    className="hidden min-h-10 items-center justify-center gap-2 rounded-[14px] border border-[var(--border)] bg-black px-4 text-sm font-medium text-white transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] md:inline-flex"
                  >
                    <Bell size={17} strokeWidth={1.75} />
                    Уведомления
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 w-full content-start gap-3 px-4 py-3 md:px-5 md:py-5">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
