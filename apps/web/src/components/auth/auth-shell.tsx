import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthShell({ eyebrow, title, description, footer, children }: AuthShellProps) {
  return (
    <main className="grid min-h-screen gap-5 px-4 py-5 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
      <section className="flex flex-col justify-between rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7">
        <div className="space-y-6">
          <Link href="/" className="inline-flex items-center rounded-full border border-[var(--border)] bg-white/5 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-cyan-100">
            Lobby
          </Link>
          <div className="max-w-2xl space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-200/70">{eyebrow}</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Закрытый доступ без компромиссов.</h1>
            <p className="text-base leading-8 text-slate-300">
              Платформа работает по приглашениям. Вход безопасный, сессии хранятся на стороне сервера.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["Доступ", "Регистрация только с ключом приглашения."],
            ["Сессии", "Авторизация через безопасные cookie."],
            ["Аудит", "Критичные действия фиксируются в журнале."],
          ].map(([label, text]) => (
            <div key={label} className="rounded-2xl border border-[var(--border)] bg-slate-950/35 p-4">
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-center">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-200/70">{eyebrow}</p>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {children}
            <div className="text-sm text-slate-300">{footer}</div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
