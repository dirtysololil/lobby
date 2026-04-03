import Link from "next/link";
import { Palette, SlidersHorizontal } from "lucide-react";

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
          className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[var(--shadow)] transition hover:border-sky-300/25 hover:bg-white/[0.06]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-300/10 text-sky-300">
            <item.icon className="h-5 w-5" />
          </div>
          <p className="mt-4 text-lg font-medium text-white">{item.label}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
        </Link>
      ))}
    </div>
  );
}
