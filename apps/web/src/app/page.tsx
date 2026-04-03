import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, AudioLines, KeyRound, Lock, ShieldCheck, UsersRound } from "lucide-react";
import { fetchViewer } from "@/lib/server-session";

export default async function Home() {
  const viewer = await fetchViewer();

  if (viewer) {
    redirect("/app");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-6 sm:px-8 lg:px-10">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="social-shell flex h-11 w-11 items-center justify-center rounded-2xl"><ShieldCheck className="h-5 w-5 text-[#a7cbff]" /></div>
          <div><p className="font-mono text-xs uppercase tracking-[0.24em] text-[var(--text-muted)]">Lobby Private</p><p className="text-sm text-[var(--text-dim)]">Исполнительная community-платформа</p></div>
        </div>
        <div className="flex items-center gap-2"><Link href="/login" className="rounded-full border border-[var(--border)] bg-white/5 px-4 py-2 text-sm text-[var(--text-dim)]">Вход</Link><Link href="/register" className="rounded-full bg-[#86c9ff] px-4 py-2 text-sm font-semibold text-[#03111f]">Регистрация</Link></div>
      </div>

      <section className="grid flex-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="social-shell space-y-7 rounded-[32px] p-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#8bbcff]/30 bg-[#8bbcff]/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#bfddff]">Private-by-design</div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">Не чат. Закрытая социальная операционная среда.</h1>
            <p className="max-w-2xl text-base leading-8 text-[var(--text-dim)]">Lobby объединяет диалоги, хабы, форумные пространства и голосовые комнаты в единую архитектуру премиального private community.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="premium-tile rounded-3xl p-4"><UsersRound className="h-5 w-5 text-[#9fc7ff]" /><p className="mt-3 text-sm font-medium">Живые сообщества</p><p className="mt-2 text-sm text-[var(--text-muted)]">Иерархия hub → lobby → topic.</p></div>
            <div className="premium-tile rounded-3xl p-4"><AudioLines className="h-5 w-5 text-[#9fc7ff]" /><p className="mt-3 text-sm font-medium">Мессенджер + звонки</p><p className="mt-2 text-sm text-[var(--text-muted)]">Плотный UX без лишней декоративности.</p></div>
            <div className="premium-tile rounded-3xl p-4"><Lock className="h-5 w-5 text-[#9fc7ff]" /><p className="mt-3 text-sm font-medium">Контроль доступа</p><p className="mt-2 text-sm text-[var(--text-muted)]">Ключи, роли и аудит в одном контуре.</p></div>
          </div>
          <div className="flex flex-wrap gap-3"><Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-[#86c9ff] px-5 py-3 font-semibold text-[#03111f]">Запросить доступ <ArrowRight className="h-4 w-4" /></Link><Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/5 px-5 py-3 font-medium text-[var(--text)]">Войти по ключу</Link></div>
        </div>

        <div className="social-shell space-y-3 rounded-[32px] p-6">
          {[{ icon: KeyRound, title: "Регистрация по инвайту", text: "Открытый доступ отключён, каждая сессия под контролем." }, { icon: Lock, title: "Безопасные сессии", text: "HttpOnly cookie + серверная валидация каждой операции." }, { icon: ShieldCheck, title: "Аудит и ответственность", text: "Изменения ролей, блокировки и критичные действия логируются." }].map((item) => (
            <div key={item.title} className="premium-tile rounded-3xl p-5"><item.icon className="mb-2 h-5 w-5 text-[#a8d1ff]" /><p className="text-base font-medium text-white">{item.title}</p><p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">{item.text}</p></div>
          ))}
        </div>
      </section>
    </main>
  );
}
