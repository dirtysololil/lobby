import type { ReactNode } from "react";

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <section className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain">
      <div className="grid min-h-full content-start gap-4 px-3 py-3 md:px-4 md:py-4">
        {children}
      </div>
    </section>
  );
}
