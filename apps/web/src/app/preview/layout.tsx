import Link from "next/link";
import type { ReactNode } from "react";

export default function PreviewLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const links = [
    { href: "/preview/dm-thread", label: "DM Thread" },
    { href: "/preview/dm-call", label: "DM Call" },
    { href: "/preview/hubs", label: "Hubs" },
    { href: "/preview/settings", label: "Settings" },
    { href: "/preview/admin", label: "Admin" },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <div className="border-b border-white/5 bg-[rgba(10,15,22,0.92)] px-4 py-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="glass-badge transition-colors hover:border-white/10 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
