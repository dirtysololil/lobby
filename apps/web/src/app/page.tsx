import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  AudioLines,
  KeyRound,
  Lock,
  Network,
  ShieldCheck,
  UsersRound,
  Waves,
} from "lucide-react";
import { fetchViewer } from "@/lib/server-session";

export default async function Home() {
  const viewer = await fetchViewer();

  if (viewer) {
    redirect("/app");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1760px] flex-col px-4 py-5 sm:px-8 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="shell-frame flex h-12 w-12 items-center justify-center rounded-[18px]">
            <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="section-kicker">Закрытая сеть Lobby</p>
            <p className="text-sm text-[var(--text-dim)]">
              Премиальная социальная экосистема для закрытых сообществ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="status-pill">
            Вход
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-[44px] items-center rounded-full bg-[linear-gradient(135deg,#8ff0ea,#74d3cd,#8ea7ff)] px-4 text-sm font-semibold text-[#041014] shadow-[0_14px_32px_rgba(124,215,209,0.28)]"
          >
            Активация
          </Link>
        </div>
      </div>

      <section className="grid flex-1 gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <div className="shell-frame rounded-[38px] p-7 lg:p-8 xl:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow-pill">
              <Network className="h-3.5 w-3.5" /> Приватность по умолчанию
            </span>
            <span className="status-pill">
              <span className="status-dot text-[var(--success)]" />
              Закрытая сеть активна
            </span>
          </div>
          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-end">
            <div className="space-y-5">
              <h1 className="max-w-4xl font-[var(--font-heading)] text-4xl font-semibold tracking-[-0.06em] text-white sm:text-6xl xl:text-7xl">
                Не просто чат. Это закрытая социальная операционная среда.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-[var(--text-dim)]">
                Lobby связывает личные диалоги, хабы, лобби, форумные ветки и
                внутренний админ-контур в единую премиальную систему для
                приватных сообществ, управленческих команд и отобранных сетей.
              </p>
            </div>
            <div className="surface-highlight rounded-[28px] p-5">
              <p className="section-kicker">Сигнатура продукта</p>
              <p className="mt-3 text-lg font-semibold text-white">
                Между мессенджером, экосистемой сообществ и центром контроля.
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">
                Без ощущения шаблонной админки, витринной оболочки или типового
                сервисного дэшборда.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="surface-subtle rounded-[28px] p-5">
              <UsersRound className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-4 text-base font-semibold text-white">
                Живые сообщества
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Иерархия hub → lobby → topic читается мгновенно и ощущается как
                пространство, а не список карточек.
              </p>
            </div>
            <div className="surface-subtle rounded-[28px] p-5">
              <AudioLines className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-4 text-base font-semibold text-white">
                Мессенджер и звонки
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Диалоги, сгруппированные сообщения и сессии LiveKit собраны в
                цельный настольный UX.
              </p>
            </div>
            <div className="surface-subtle rounded-[28px] p-5">
              <Lock className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-4 text-base font-semibold text-white">
                Контроль доступа
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Инвайты, роли, модерация и аудит встроены в продукт, а не
                выглядят как сторонняя админка.
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-[linear-gradient(135deg,#8ff0ea,#74d3cd,#8ea7ff)] px-6 font-semibold text-[#041014] shadow-[0_18px_36px_rgba(124,215,209,0.28)]"
            >
              Активировать доступ <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.04] px-6 font-medium text-[var(--text)]"
            >
              Войти в существующий контур
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="shell-frame rounded-[36px] p-6 lg:p-7">
            <p className="section-kicker">Почему Lobby ощущается дороже</p>
            <div className="mt-5 grid gap-4">
              {[
                {
                  icon: KeyRound,
                  title: "Закрытый онбординг",
                  text: "Нет публичной регистрации, каждый вход завязан на ключ, роль и управляемый маршрут доступа.",
                },
                {
                  icon: ShieldCheck,
                  title: "Доверенный контур",
                  text: "Сессии валидируются сервером, критичные действия логируются, а пространства остаются приватными по умолчанию.",
                },
                {
                  icon: Waves,
                  title: "Социальная топология",
                  text: "Внутри продукта чувствуется живая сеть: люди, диалоги, лобби, темы, активность и контекстные слои.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="surface-subtle rounded-[26px] p-5"
                >
                  <item.icon className="h-5 w-5 text-[var(--accent)]" />
                  <p className="mt-4 text-base font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="shell-frame rounded-[36px] p-6 lg:p-7">
            <p className="section-kicker">Ключевые режимы</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                "Личные переговоры",
                "Хабы сообществ",
                "Форумные обсуждения",
                "Аудит и модерация",
              ].map((item) => (
                <div
                  key={item}
                  className="metric-tile rounded-[22px] px-4 py-4 text-sm font-medium text-white"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
