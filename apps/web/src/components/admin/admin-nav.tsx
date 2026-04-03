import Link from "next/link";
import {
  KeyRound,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users2,
} from "lucide-react";

const items = [
  {
    href: "/app/admin",
    label: "Обзор",
    description: "Сводка платформы и модерации",
    icon: ShieldCheck,
  },
  {
    href: "/app/admin/invites",
    label: "Ключи приглашений",
    description: "Создание и отзыв ключей доступа",
    icon: KeyRound,
  },
  {
    href: "/app/admin/users",
    label: "Пользователи",
    description: "Поиск, анализ и модерация пользователей",
    icon: Users2,
  },
  {
    href: "/app/admin/audit",
    label: "Журнал аудита",
    description: "Критичные действия по всей платформе",
    icon: ScrollText,
  },
];

export function AdminNav() {
  return (
    <div className="grid gap-3 lg:grid-cols-4">
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
            Внутренний модуль контроля
          </div>
        </Link>
      ))}
    </div>
  );
}
