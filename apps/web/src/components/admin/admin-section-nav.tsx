"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavigationItems } from "@/lib/admin-navigation";
import { parseAppPath } from "@/lib/app-shell";
import { cn } from "@/lib/utils";

export function AdminSectionNav() {
  const pathname = usePathname();
  const route = parseAppPath(pathname ?? "");

  if (route.section !== "admin") {
    return null;
  }

  return (
    <section className="premium-panel rounded-[22px] p-2.5">
      <p className="section-kicker px-1 md:hidden">Разделы админки</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:mt-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {adminNavigationItems.map((item) => {
          const active = route.adminSection === item.section;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-[12px] border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-[#0070F3]/28 bg-[var(--bg-active)] text-white"
                  : "border-[var(--border-soft)] bg-black text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--bg-hover)] hover:text-white",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
