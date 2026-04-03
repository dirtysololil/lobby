import type { ReactNode } from "react";
import Link from "next/link";
import { KeyRound, MessageSquareMore, ShieldCheck, Waves } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <main className="mx-auto grid min-h-screen w-full max-w-[1480px] gap-4 px-4 py-4 lg:grid-cols-[1.05fr_0.95fr] lg:px-6">
      <section className="shell-frame flex flex-col justify-between rounded-[28px] p-6 lg:p-8">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="eyebrow-pill">
              Lobby
            </Link>
            <span className="status-pill">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--success)]" />
              Closed network
            </span>
          </div>

          <div className="mt-8 max-w-3xl">
            <p className="section-kicker">{eyebrow}</p>
            <h1 className="mt-3 font-[var(--font-heading)] text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              Compact communication for private communities.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-dim)]">
              Lobby открывается как рабочая среда для общения: быстрый inbox,
              hubs, identity-driven people layer и сервисный control only where it matters.
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              {
                icon: MessageSquareMore,
                label: "Inbox first",
                text: "DM и сообщения открываются как основной сценарий, а не как вторичный модуль.",
              },
              {
                icon: Waves,
                label: "Hub structure",
                text: "Хабы, каналы и форумы собираются в понятную компактную навигацию.",
              },
              {
                icon: KeyRound,
                label: "Access control",
                text: "Регистрация, роли и доступы остаются приватными и управляемыми.",
              },
            ].map((item) => (
              <div key={item.label} className="surface-subtle rounded-[20px] p-4">
                <item.icon className="h-5 w-5 text-[var(--accent)]" />
                <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-subtle mt-6 rounded-[20px] px-4 py-4 text-sm text-[var(--text-dim)]">
          Доступ в продукт по-прежнему закрыт: сначала identity, потом пространство.
        </div>
      </section>

      <div className="flex items-center justify-center">
        <Card className="w-full max-w-xl rounded-[28px]">
          <CardHeader>
            <p className="section-kicker">{eyebrow}</p>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {children}
            <div className="rounded-[16px] border border-[var(--border)] bg-white/[0.03] px-4 py-4 text-sm text-[var(--text-dim)]">
              {footer}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
