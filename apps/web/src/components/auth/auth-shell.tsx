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
    <main className="grid min-h-screen gap-10 px-6 py-8 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12">
      <section className="flex flex-col justify-between rounded-[36px] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl sm:p-10">
        <div className="space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-sky-100/80"
          >
            Lobby
          </Link>

          <div className="max-w-2xl space-y-4">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-200/70">{eyebrow}</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Access stays private by default.
            </h1>
            <p className="text-lg leading-8 text-slate-300">
              Registration is available only with a valid access key. Sessions are issued as HttpOnly
              cookies and routed safely behind a reverse proxy.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Invite gate", "Registration is closed without a signed access key."],
            ["Cookie auth", "Session stays on the server side, not in local storage."],
            ["Audit trail", "Critical auth actions already land in the audit log."],
          ].map(([label, text]) => (
            <div key={label} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-center">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-200/70">{eyebrow}</p>
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
