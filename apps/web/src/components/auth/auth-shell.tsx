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
    <main className="mx-auto grid min-h-screen w-full max-w-[1380px] gap-3 px-3 py-3 lg:grid-cols-[0.95fr_0.9fr] lg:px-4">
      <section className="shell-frame flex flex-col justify-between rounded-[24px] p-4 lg:p-5">
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

          <div className="mt-6 max-w-2xl">
            <p className="section-kicker">{eyebrow}</p>
            <h1 className="mt-2.5 font-[var(--font-heading)] text-3xl font-semibold tracking-[-0.05em] text-white sm:text-[2.6rem]">
              Private communication, compact by default.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-dim)]">
              Inbox, people and hubs без лишнего слоя панели.
            </p>
          </div>

          <div className="mt-6 grid gap-2.5 md:grid-cols-3">
            {[
              {
                icon: MessageSquareMore,
                label: "Inbox first",
                text: "DM как основной сценарий.",
              },
              {
                icon: Waves,
                label: "Hub structure",
                text: "Хабы и каналы в плотной навигации.",
              },
              {
                icon: KeyRound,
                label: "Access control",
                text: "Закрытый доступ и управляемые роли.",
              },
            ].map((item) => (
              <div key={item.label} className="surface-subtle rounded-[16px] p-3.5">
                <item.icon className="h-4 w-4 text-[var(--accent)]" />
                <p className="mt-2.5 text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-1.5 text-sm leading-5 text-[var(--text-dim)]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-subtle mt-4 rounded-[16px] px-3 py-2.5 text-sm text-[var(--text-dim)]">
          Сначала identity, потом доступ.
        </div>
      </section>

      <div className="flex items-center justify-center">
        <Card className="w-full max-w-lg rounded-[24px]">
          <CardHeader>
            <p className="section-kicker">{eyebrow}</p>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {children}
            <div className="rounded-[14px] border border-[var(--border)] bg-white/[0.03] px-3 py-3 text-sm text-[var(--text-dim)]">
              {footer}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
