import Link from "next/link";
import { Palette, SlidersHorizontal, Sparkles } from "lucide-react";

const items = [
  {
    href: "/app/settings/profile",
    label: "Профиль",
    description: "Аватар, пресет и публичная карточка",
    icon: Palette,
  },
  {
    href: "/app/settings/notifications",
    label: "Уведомления",
    description: "Базовые правила и переопределения по хабам",
    icon: SlidersHorizontal,
  },
];

export function SettingsNav() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="list-row rounded-[28px] p-5"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/[0.05] text-[var(--accent)]">
            <item.icon className="h-5 w-5" />
          </div>
          <p className="mt-4 text-lg font-medium text-white">{item.label}</p>
          <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
            {item.description}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            Часть персонального слоя управления
          </div>
        </Link>
      ))}
    </div>
  );
}
