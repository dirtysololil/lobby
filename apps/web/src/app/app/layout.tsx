import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { IncomingCallBanner } from "@/components/realtime/incoming-call-banner";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { requireViewer } from "@/lib/server-session";

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const viewer = await requireViewer();

  return (
    <RealtimeProvider viewer={viewer}>
      <main className="mx-auto grid min-h-screen w-full max-w-[1800px] grid-cols-1 gap-4 px-3 py-3 xl:grid-cols-[280px_320px_minmax(0,1fr)] xl:gap-4 xl:px-5">
        <AppSidebar viewer={viewer} />
        <section className="social-shell hidden min-h-[calc(100vh-1.5rem)] rounded-[28px] p-4 xl:flex xl:flex-col">
          <p className="px-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">Контекст пространства</p>
          <div className="mt-3 premium-tile flex-1 rounded-3xl p-4 text-sm leading-6 text-[var(--text-dim)]">
            Выберите хаб, диалог или раздел слева. Эта колонка зарезервирована под список каналов, участников и быстрые действия по текущему контексту.
          </div>
        </section>
        <div className="flex min-h-0 flex-col gap-4">
          <AppHeader viewer={viewer} />
          <IncomingCallBanner />
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </main>
    </RealtimeProvider>
  );
}
