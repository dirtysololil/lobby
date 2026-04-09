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
    <section className="premium-panel rounded-[22px] p-3">
      <p className="section-kicker px-1">Разделы админки</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {adminNavigationItems.map((item) => {
          const active = route.adminSection === item.section;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-[14px] border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-[rgba(106,168,248,0.24)] bg-[rgba(106,168,248,0.14)] text-white"
                  : "border-white/8 bg-white/[0.03] text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-white",
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
