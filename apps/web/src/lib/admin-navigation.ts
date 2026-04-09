export const adminNavigationItems = [
  { href: "/app/admin", section: "overview", label: "Обзор" },
  { href: "/app/admin/users", section: "users", label: "Пользователи" },
  { href: "/app/admin/invites", section: "invites", label: "Инвайты" },
  { href: "/app/admin/audit", section: "audit", label: "Аудит" },
  { href: "/app/admin/media", section: "media", label: "Медиатека" },
  {
    href: "/app/admin/sticker-packs",
    section: "sticker-packs",
    label: "Наборы стикеров",
  },
] as const;

export type AdminNavigationItem = (typeof adminNavigationItems)[number];
