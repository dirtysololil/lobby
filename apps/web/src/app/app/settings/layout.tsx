import Link from "next/link";
import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { AppMobileTopNav } from "@/components/app/app-mobile-top-nav";
import { CompactListMeta } from "@/components/ui/compact-list";

export default function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#0d151f] md:bg-[linear-gradient(180deg,rgba(255,255,255,0.012),transparent_14%),#0f1721]">
      <div className="absolute inset-0 hidden bg-[radial-gradient(circle_at_50%_15%,rgba(69,110,185,0.14),transparent_0%,transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.01),transparent_18%)] md:block" />

      <div className="relative flex h-full min-h-0 flex-col">
        <div className="border-b border-white/5 px-4 pb-3 pt-5 md:px-5 md:pb-4 md:pt-5">
          <div className="md:hidden">
            <AppMobileTopNav active="settings" />
          </div>

          <div className="mt-4 flex flex-col gap-4 md:mt-0 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
                  Настройки
                </CompactListMeta>
                <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
                  Профиль
                </CompactListMeta>
                <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
                  Аватар
                </CompactListMeta>
                <CompactListMeta className="border-white/6 bg-white/[0.04] text-[#9ca9bb]">
                  Рингтон
                </CompactListMeta>
              </div>
              <h1 className="mt-3 text-[26px] font-semibold tracking-[-0.04em] text-white">
                Личное пространство
              </h1>
              <p className="mt-1 max-w-[48rem] text-sm text-[#8d98aa]">
                Настраивайте профиль, присутствие, аватар и звук входящего звонка
                в том же компактном рабочем каркасе, что и остальные разделы.
              </p>
            </div>

            <Link
              href="/app/settings/notifications"
              className="hidden min-h-11 items-center justify-center gap-2 rounded-[14px] border border-white/6 bg-white/[0.04] px-4 text-sm font-medium text-[#d8e1ef] transition-colors hover:bg-white/[0.06] md:inline-flex"
            >
              <Bell size={17} strokeWidth={1.75} />
              Уведомления
            </Link>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto grid min-h-full w-full max-w-[1120px] content-start gap-3 px-4 py-3 md:px-5 md:py-5">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
