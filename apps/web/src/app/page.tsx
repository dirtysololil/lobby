import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, MessageSquareMore, ShieldCheck, UsersRound, Waves } from "lucide-react";
import { fetchViewer } from "@/lib/server-session";

export default async function Home() {
  const viewer = await fetchViewer();

  if (viewer) {
    redirect("/app/home");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1380px] flex-col px-3 py-3 lg:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="dock-icon flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/10 bg-white text-black">
            <span className="text-sm font-bold tracking-[-0.04em]">Lb</span>
          </div>
          <div>
            <p className="section-kicker">Lobby</p>
            <p className="text-sm text-[var(--text-dim)]">
              Private communication platform
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="status-pill">
            Вход
          </Link>
          <Link
            href="/register"
            className="status-pill border-[#0070F3] bg-[#0070F3] text-white hover:border-[#0064d8] hover:bg-[#0064d8]"
          >
            Активация
          </Link>
        </div>
      </div>

      <section className="grid flex-1 gap-3 lg:grid-cols-[0.98fr_0.82fr]">
        <div className="shell-frame flex flex-col justify-between rounded-[24px] p-4 lg:p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <ShieldCheck className="h-3.5 w-3.5" />
                Closed network
              </span>
              <span className="status-pill">Compact, social, realtime</span>
            </div>
            <h1 className="mt-5 max-w-3xl font-[var(--font-heading)] text-3xl font-semibold tracking-[-0.06em] text-white sm:text-[3.1rem]">
              Private communication with a sharper signal-to-noise ratio.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-dim)]">
              Lobby соединяет DM, hubs и форумы в один рабочий продукт для закрытых команд.
            </p>

            <div className="mt-6 grid gap-2.5 md:grid-cols-3">
              {[
                {
                  icon: MessageSquareMore,
                  title: "Inbox",
                  text: "Личные диалоги и звонки как основной рабочий слой.",
                },
                {
                  icon: UsersRound,
                  title: "People",
                  text: "Друзья, запросы и discovery без сервисных giant cards.",
                },
                {
                  icon: Waves,
                  title: "Hubs",
                  text: "Пространства и каналы с понятной левой архитектурой.",
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
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              href="/register"
              className="inline-flex min-h-[38px] items-center gap-2 rounded-[12px] border border-[#0070F3] bg-[#0070F3] px-4 text-sm font-semibold text-white transition-colors hover:border-[#0064d8] hover:bg-[#0064d8]"
            >
              Активировать доступ <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex min-h-[38px] items-center gap-2 rounded-[12px] border border-[var(--border)] bg-black px-4 text-sm font-medium text-[var(--text)]">
              Войти
            </Link>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="shell-frame rounded-[24px] p-4">
            <p className="section-kicker">Что внутри</p>
            <div className="mt-3 grid gap-2">
              {[
                "Far-left global rail для spaces, inbox и profile",
                "Context rail для chats, people views и hub channels",
                "Messenger-grade DM surfaces и call states",
                "Service surfaces only where they are actually useful",
              ].map((item) => (
                <div key={item} className="list-row rounded-[16px] px-3 py-2.5 text-sm text-white">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="shell-frame rounded-[24px] p-4">
            <p className="section-kicker">Доступ</p>
            <p className="mt-2.5 text-sm leading-5 text-[var(--text-dim)]">
              Публичной регистрации нет. Вход и активация работают через приватные ключи и роли.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
