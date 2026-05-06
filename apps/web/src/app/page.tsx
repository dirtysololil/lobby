import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  LockKeyhole,
  MessageSquareMore,
  ShieldCheck,
  UsersRound,
  Waves,
} from "lucide-react";
import { CookieConsentBanner } from "@/components/privacy/cookie-consent-banner";
import { fetchViewer } from "@/lib/server-session";

export default async function Home() {
  const viewer = await fetchViewer();

  if (viewer) {
    redirect("/app/home");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-3 py-3 lg:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="dock-icon flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/10 bg-white text-black">
            <span className="text-sm font-bold tracking-[-0.04em]">Lb</span>
          </div>
          <div>
            <p className="section-kicker">Lobby</p>
            <p className="text-sm text-[var(--text-dim)]">
              Закрытая коммуникационная платформа
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="status-pill">
            Вход
          </Link>
          <Link
            href="/register"
            className="status-pill border-[var(--border-strong)] bg-white text-black hover:bg-[#f1f1f1]"
          >
            Активация
          </Link>
        </div>
      </div>

      <section className="shell-frame flex flex-1 flex-col justify-between rounded-[24px] p-4 lg:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">
              <ShieldCheck className="h-3.5 w-3.5" />
              Закрытая сеть
            </span>
            <span className="status-pill">Компактно, социально, realtime</span>
          </div>
          <h1 className="mt-5 max-w-3xl font-[var(--font-heading)] text-3xl font-semibold tracking-[-0.06em] text-white sm:text-[3.1rem]">
            Приватное общение для команд с доступом по приглашению.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-dim)]">
            Lobby объединяет личные диалоги, людей и пространства в спокойный
            рабочий продукт для закрытых сообществ.
          </p>

          <div className="mt-6 grid gap-2.5 md:grid-cols-3">
            {[
              {
                icon: MessageSquareMore,
                title: "Входящие",
                text: "Личные диалоги и звонки без лишних публичных слоев.",
              },
              {
                icon: UsersRound,
                title: "Люди",
                text: "Друзья, запросы и поиск участников внутри закрытой сети.",
              },
              {
                icon: Waves,
                title: "Пространства",
                text: "Командные зоны и каналы с понятной навигацией.",
              },
            ].map((item) => (
              <div key={item.title} className="surface-subtle rounded-[16px] p-3.5">
                <item.icon className="h-4 w-4 text-[var(--accent)]" />
                <p className="mt-2.5 text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1.5 text-sm leading-5 text-[var(--text-dim)]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex max-w-2xl items-start gap-3 rounded-[16px] border border-[var(--border-soft)] bg-black px-3.5 py-3 text-sm leading-5 text-[var(--text-dim)]">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-soft)]" />
            <p>
              Доступ ограничен. Используйте сервис только при наличии ключа
              активации и не размещайте данные, которые не предназначены для
              участников вашего закрытого пространства.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            href="/register"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-[12px] border border-white bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-[#f1f1f1]"
          >
            Активировать доступ <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-[12px] border border-[var(--border)] bg-black px-4 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
          >
            Войти
          </Link>
          <Link
            href="/privacy"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-[12px] border border-transparent px-4 text-sm font-medium text-[var(--text-dim)] transition-colors hover:text-white"
          >
            Политика конфиденциальности
          </Link>
        </div>
      </section>
      <CookieConsentBanner />
    </main>
  );
}
