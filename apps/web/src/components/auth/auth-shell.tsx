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
    <main className="mx-auto grid min-h-screen w-full max-w-[1600px] gap-5 px-4 py-5 sm:px-8 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="social-shell flex flex-col justify-between rounded-[30px] p-7">
        <div className="space-y-6">
          <Link href="/" className="inline-flex items-center rounded-full border border-[var(--border)] bg-white/5 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[#bbd9ff]">Lobby</Link>
          <div className="max-w-2xl space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">{eyebrow}</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Закрытый контур коммуникаций для команд и сообществ.</h1>
            <p className="text-base leading-8 text-[var(--text-dim)]">Премиальный social shell: мессенджер, хабы и админ-контроль с доступом только по приглашениям.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[ ["Доступ", "Только инвайт и проверенные ключи."], ["Сессии", "Серверная авторизация без localStorage."], ["Контроль", "Действия фиксируются в журнале платформы."] ].map(([label, text]) => (
            <div key={label} className="premium-tile rounded-2xl p-4"><p className="text-sm font-medium text-white">{label}</p><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{text}</p></div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-center">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">{eyebrow}</p>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">{children}<div className="text-sm text-[var(--text-dim)]">{footer}</div></CardContent>
        </Card>
      </div>
    </main>
  );
}
