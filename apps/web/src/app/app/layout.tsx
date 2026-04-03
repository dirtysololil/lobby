import type { ReactNode } from "react";
import {
  BellDot,
  ShieldCheck,
  Sparkles,
  Waves,
  UsersRound,
} from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { IncomingCallBanner } from "@/components/realtime/incoming-call-banner";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { requireViewer } from "@/lib/server-session";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const viewer = await requireViewer();

  return (
    <RealtimeProvider viewer={viewer}>
      <main className="mx-auto grid min-h-screen w-full max-w-[1880px] grid-cols-1 gap-4 px-3 py-3 2xl:grid-cols-[320px_minmax(0,1fr)_340px] 2xl:px-5">
        <AppSidebar viewer={viewer} />
        <div className="flex min-h-0 flex-col gap-4">
          <AppHeader viewer={viewer} />
          <IncomingCallBanner />
          <div className="min-h-0 flex-1">{children}</div>
        </div>
        <aside className="shell-frame desktop-only min-h-[calc(100vh-1.5rem)] rounded-[32px] p-4 2xl:sticky 2xl:top-3">
          <div className="surface-highlight rounded-[28px] p-5">
            <span className="eyebrow-pill">
              <Sparkles className="h-3.5 w-3.5" /> Контекст платформы
            </span>
            <h2 className="mt-4 font-[var(--font-heading)] text-2xl font-semibold tracking-[-0.04em] text-white">
              Lobby работает как закрытая социальная система.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">
              Правый контекстный рейл удерживает чувство пространства: живые
              сигналы, статус контура и уровень активности без ощущения
              CRM-панели.
            </p>
          </div>

          <div className="mt-4 grid gap-4">
            <div className="surface-subtle rounded-[26px] p-4">
              <p className="section-kicker">Сейчас в фокусе</p>
              <div className="mt-3 grid gap-3">
                {[
                  {
                    icon: Waves,
                    title: "Мессенджер и звонки",
                    text: "Диалоги, входящие вызовы и live presence синхронизируются в реальном времени.",
                  },
                  {
                    icon: UsersRound,
                    title: "Комьюнити-структура",
                    text: "Хабы, лобби и темы формируют читаемую иерархию пространства.",
                  },
                  {
                    icon: BellDot,
                    title: "Сигналы и реакции",
                    text: "Уведомления и события собираются без визуального шума.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="metric-tile rounded-[22px] px-4 py-4"
                  >
                    <div className="flex items-center gap-2 text-white">
                      <item.icon className="h-4 w-4 text-[var(--accent)]" />
                      {item.title}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-subtle rounded-[26px] p-4">
              <p className="section-kicker">Состояние контура</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-[22px] border border-[var(--border-soft)] px-4 py-3">
                  <span className="text-sm text-[var(--text-dim)]">
                    Авторизация
                  </span>
                  <span className="status-pill">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--success)]" />
                    Проверена
                  </span>
                </div>
                <div className="rounded-[22px] border border-[var(--border-soft)] px-4 py-3 text-sm leading-6 text-[var(--text-dim)]">
                  Все сценарии построены вокруг приватного доступа, ролей и
                  безопасной маршрутизации — без «демо-ощущения» витрины.
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </RealtimeProvider>
  );
}
