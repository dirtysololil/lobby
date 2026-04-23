import Link from "next/link";
import {
  Layers3,
  MessageSquareMore,
  UserRound,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AppMobileTopNavKey = "messages" | "people" | "hubs" | "settings";

interface AppMobileTopNavProps {
  active: AppMobileTopNavKey;
  className?: string;
}

const navItems: Array<{
  href: string;
  icon: LucideIcon;
  key: AppMobileTopNavKey;
  label: string;
}> = [
  {
    href: "/app/messages",
    icon: MessageSquareMore,
    key: "messages",
    label: "Чаты",
  },
  {
    href: "/app/people",
    icon: Users2,
    key: "people",
    label: "Люди",
  },
  {
    href: "/app/hubs",
    icon: Layers3,
    key: "hubs",
    label: "Сервисы",
  },
  {
    href: "/app/settings/profile",
    icon: UserRound,
    key: "settings",
    label: "Профиль",
  },
];

export function AppMobileTopNav({
  active,
  className,
}: AppMobileTopNavProps) {
  return (
    <nav className={cn("grid grid-cols-4 gap-1", className)} aria-label="Основная навигация">
      {navItems.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-label={item.label}
          title={item.label}
          className={cn(
            "inline-flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] text-[11px] font-medium tracking-[-0.01em] text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-hover)] hover:text-white",
            active === item.key && "border border-white/10 bg-[var(--bg-active)] text-white",
          )}
        >
          <item.icon size={18} strokeWidth={1.75} />
          <span className="max-w-full truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
