import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <section className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain">
      <div className="grid min-h-full content-start gap-4 px-3 py-3 md:px-4 md:py-4">
        <Link
          href="/app/home"
          className="inline-flex min-h-10 w-fit items-center gap-2 rounded-[12px] border border-[var(--border-soft)] bg-black px-3.5 text-sm font-medium text-white transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-hover)] md:hidden"
        >
          <ArrowLeft size={16} strokeWidth={1.9} />
          <span>Назад</span>
        </Link>

        {children}
      </div>
    </section>
  );
}
