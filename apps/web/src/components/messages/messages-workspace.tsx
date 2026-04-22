"use client";

import Link from "next/link";
import {
  MessageSquareMore,
  Search,
  SquarePen,
  UserRoundPlus,
} from "lucide-react";

const iconProps = { size: 20, strokeWidth: 1.6 } as const;

export function MessagesWorkspace() {
  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.012),transparent_14%),#0f1721]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(69,110,185,0.16),transparent_0%,transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.01),transparent_18%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_20px_20px,rgba(255,255,255,0.16)_1px,transparent_0)] [background-size:34px_34px]" />

      <div className="relative flex h-full min-h-0 items-center justify-center px-6 py-10">
        <div className="w-full max-w-[38rem] rounded-[30px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_18%),rgba(16,24,36,0.92)] p-7 shadow-[0_28px_60px_rgba(4,10,18,0.32)]">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] border border-[#4a84ff]/28 bg-[linear-gradient(180deg,rgba(74,132,255,0.22),rgba(74,132,255,0.08))] text-white shadow-[0_14px_32px_rgba(10,20,38,0.32)]">
            <MessageSquareMore {...iconProps} />
          </div>

          <h1 className="mt-5 text-[32px] font-semibold tracking-[-0.05em] text-white">
            Выберите диалог
          </h1>
          <p className="mt-3 max-w-[32rem] text-[15px] leading-7 text-[#8d98aa]">
            Список чатов уже открыт слева. Выберите существующую переписку или
            начните новую, чтобы перейти к экрану сообщений в обновлённом стиле.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link
              href="/app/people?view=discover"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] border border-[#4a84ff]/28 bg-[linear-gradient(180deg,rgba(74,132,255,0.24),rgba(61,104,192,0.14))] px-4 text-sm font-medium text-white transition-transform duration-150 hover:-translate-y-0.5"
            >
              <SquarePen {...iconProps} />
              Новый чат
            </Link>
            <Link
              href="/app/people?view=discover"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] border border-white/8 bg-white/[0.03] px-4 text-sm font-medium text-[#d8e1ef] transition-colors duration-150 hover:bg-white/[0.05]"
            >
              <UserRoundPlus {...iconProps} />
              Найти людей
            </Link>
          </div>

          <div className="mt-7 rounded-[22px] border border-white/6 bg-[#121b27]/88 p-4">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white/[0.045] text-[#94a4bb]">
                <Search {...iconProps} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Быстрый поиск по чатам</p>
                <p className="mt-1 text-sm leading-6 text-[#7d899b]">
                  Используйте поиск и вкладки в левой колонке, чтобы быстро найти
                  личный диалог или непрочитанные сообщения.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
