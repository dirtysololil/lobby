import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  KeyRound,
  MessageSquareMore,
  ShieldCheck,
  Waves,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  footer,
  children,
}: AuthShellProps) {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-[1760px] gap-5 px-4 py-5 sm:px-8 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="shell-frame flex flex-col justify-between rounded-[36px] p-7 lg:p-8 xl:p-10">
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="eyebrow-pill">
              Закрытая сеть Lobby
            </Link>
            <span className="status-pill">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--success)]" />
              Только по приглашению
            </span>
          </div>
          <div className="max-w-3xl space-y-5">
            <p className="section-kicker">{eyebrow}</p>
            <h1 className="font-[var(--font-heading)] text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl xl:text-6xl">
              Закрытая социальная экосистема для диалогов, хабов и управляемых
              комьюнити.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[var(--text-dim)]">
              Lobby сочетает плотность мессенджера, иерархию пространства
              сообщества и строгость внутреннего центра контроля — без
              SaaS-шаблонности и без витринного ощущения.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                icon: MessageSquareMore,
                label: "Коммуникации",
                text: "Личные диалоги, звонки и живой слой присутствия в едином потоке.",
              },
              {
                icon: Waves,
                label: "Пространства",
                text: "Хабы, лобби и форумы формируют читаемую иерархию закрытого сообщества.",
              },
              {
                icon: KeyRound,
                label: "Контроль доступа",
                text: "Регистрация, роли и аудит изначально встроены в продуктовый контур.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="surface-subtle rounded-[28px] p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/[0.05] text-[var(--accent)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-base font-semibold text-white">
                  {item.label}
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-highlight rounded-[30px] p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="section-kicker">Почему этот вход выглядит иначе</p>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-dim)]">
                Здесь нет дешёвого hero-блока или типовой карточки авторизации.
                Вход встроен в общий дизайн-язык платформы: статусные тёмные
                поверхности, социальная иерархия и ощущение закрытой сети.
              </p>
            </div>
            <Link href="/" className="status-pill">
              <ArrowUpRight className="h-3.5 w-3.5 text-[var(--accent)]" />
              Вернуться на обзор
            </Link>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-center">
        <Card className="w-full max-w-xl rounded-[36px]">
          <CardHeader>
            <p className="section-kicker">{eyebrow}</p>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {children}
            <div className="rounded-[22px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-4 text-sm text-[var(--text-dim)]">
              {footer}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
