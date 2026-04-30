import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  footer,
  children,
}: AuthShellProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-black px-4 py-6 sm:px-6">
      <section className="w-full max-w-[440px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/" className="eyebrow-pill">
            Lobby
          </Link>
          <span className="status-pill">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--success)]" />
            Закрытая сеть
          </span>
        </div>

        <div className="rounded-[22px] border border-[var(--border)] bg-[#050505] p-4 shadow-none sm:p-5">
          <div className="mb-4">
            <p className="section-kicker">{eyebrow}</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">
              {title}
            </h1>
          </div>

          {children}

          <div className="mt-4 rounded-[14px] border border-[var(--border-soft)] bg-black px-3 py-3 text-sm text-[var(--text-dim)]">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
