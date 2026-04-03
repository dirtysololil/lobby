import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, MessageSquareMore, ShieldCheck, UsersRound, Waves } from "lucide-react";
import { fetchViewer } from "@/lib/server-session";

export default async function Home() {
  const viewer = await fetchViewer();

  if (viewer) {
    redirect("/app");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-4 py-4 lg:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="dock-icon flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--accent)] text-[#180d08]">
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
          <Link href="/register" className="status-pill border-[var(--accent)] bg-[var(--accent)] text-[#180d08]">
            Активация
          </Link>
        </div>
      </div>

      <section className="grid flex-1 gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="shell-frame flex flex-col justify-between rounded-[28px] p-6 lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <ShieldCheck className="h-3.5 w-3.5" />
                Closed network
              </span>
              <span className="status-pill">Compact, social, realtime</span>
            </div>
            <h1 className="mt-6 max-w-4xl font-[var(--font-heading)] text-4xl font-semibold tracking-[-0.06em] text-white sm:text-6xl">
              Communication first. Identity visible. Noise controlled.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--text-dim)]">
              Lobby связывает direct messages, hubs, форумы и внутренний control layer в один зрелый продукт для закрытых команд и комьюнити.
            </p>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
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
                <div key={item.title} className="surface-subtle rounded-[20px] p-4">
                  <item.icon className="h-5 w-5 text-[var(--accent)]" />
                  <p className="mt-3 text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex min-h-[42px] items-center gap-2 rounded-[12px] bg-[var(--accent)] px-5 text-sm font-semibold text-[#180d08]">
              Активировать доступ <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex min-h-[42px] items-center gap-2 rounded-[12px] border border-[var(--border)] bg-white/[0.04] px-5 text-sm font-medium text-[var(--text)]">
              Войти
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="shell-frame rounded-[28px] p-6 lg:p-7">
            <p className="section-kicker">Что внутри</p>
            <div className="mt-4 grid gap-2">
              {[
                "Far-left global rail для spaces, inbox и profile",
                "Context rail для chats, people views и hub channels",
                "Messenger-grade DM surfaces и call states",
                "Service surfaces only where they are actually useful",
              ].map((item) => (
                <div key={item} className="list-row rounded-[16px] px-3 py-3 text-sm text-white">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="shell-frame rounded-[28px] p-6 lg:p-7">
            <p className="section-kicker">Доступ</p>
            <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">
              Публичной регистрации нет. Вход и активация завязаны на приватные маршруты доступа, роли и управляемый онбординг.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
