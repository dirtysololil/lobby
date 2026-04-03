import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { fetchViewer } from "@/lib/server-session";

export default async function Home() {
  const viewer = await fetchViewer();

  if (viewer) {
    redirect("/app");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 py-6 sm:px-8 lg:px-10">
      <div className="mb-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/5">
            <ShieldCheck className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan-200/70">Lobby</p>
            <p className="text-sm text-slate-300">Защищённая платформа общения</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-full border border-[var(--border)] bg-white/5 px-4 py-2 text-sm text-slate-200">
            Вход
          </Link>
          <Link href="/register" className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950">
            Регистрация
          </Link>
        </div>
      </div>

      <section className="grid flex-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-7 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-cyan-100">
            Только по приглашениям
          </div>

          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Премиальная рабочая зона для приватной коммуникации.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-300">
              Вход по ключу доступа, безопасные серверные сессии и единое пространство для личных сообщений, хабов и форумов.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 font-medium text-slate-950">
              Создать аккаунт
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/5 px-5 py-3 font-medium text-slate-100">
              Уже есть доступ
            </Link>
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          {[
            {
              icon: KeyRound,
              title: "Регистрация по ключу",
              text: "Публичная регистрация закрыта. Для входа нужен действующий ключ.",
            },
            {
              icon: Lock,
              title: "Безопасные сессии",
              text: "Авторизация хранится в HttpOnly cookie и не утекает в localStorage.",
            },
            {
              icon: ShieldCheck,
              title: "Контроль действий",
              text: "Критичные операции фиксируются в аудит-логе платформы.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-[var(--border)] bg-slate-950/40 p-5">
              <item.icon className="mb-2 h-5 w-5 text-cyan-200" />
              <p className="text-base font-medium text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
