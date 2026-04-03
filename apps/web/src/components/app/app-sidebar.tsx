import Link from "next/link";
import {
  Compass,
  Crown,
  KeyRound,
  Layers3,
  MessageSquare,
  Orbit,
  Settings2,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { hubListResponseSchema, type PublicUser } from "@lobby/shared";
import { UserAvatar } from "@/components/ui/user-avatar";
import { fetchServerApi } from "@/lib/server-api";

interface AppSidebarProps {
  viewer: PublicUser;
}

const roleLabels: Record<PublicUser["role"], string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MEMBER: "Участник",
};

const presenceLabels: Record<PublicUser["profile"]["presence"], string> = {
  ONLINE: "В сети",
  IDLE: "Отошёл",
  DND: "Не беспокоить",
  OFFLINE: "Скрыт",
};

export async function AppSidebar({ viewer }: AppSidebarProps) {
  let hubItems: Array<{
    id: string;
    name: string;
    href: string;
    role: string | null;
  }> = [];

  try {
    const payload = await fetchServerApi("/v1/hubs");
    hubItems = hubListResponseSchema.parse(payload).items.map((hub) => ({
      id: hub.id,
      name: hub.name,
      href: `/app/hubs/${hub.id}`,
      role: hub.membershipRole,
    }));
  } catch {
    hubItems = [];
  }

  const navigation = [
    {
      label: "Обзор",
      description: "Личный операционный центр",
      href: "/app",
      icon: Compass,
    },
    { label: "Люди", href: "/app/people", icon: Users2 },
    { label: "Мессенджер", href: "/app/messages", icon: MessageSquare },
    { label: "Хабы", href: "/app/hubs", icon: Layers3 },
    { label: "Настройки", href: "/app/settings/profile", icon: Settings2 },
    ...(viewer.role === "OWNER" || viewer.role === "ADMIN"
      ? [
          { label: "Контроль", href: "/app/admin", icon: ShieldCheck },
          { label: "Инвайты", href: "/app/admin/invites", icon: KeyRound },
        ]
      : []),
  ];

  return (
    <aside className="social-shell flex h-full max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[34px] p-3 lg:p-4 xl:sticky xl:top-3">
      <div className="surface-highlight rounded-[30px] px-4 py-5">
        <div className="flex items-start gap-3">
          <UserAvatar user={viewer} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="eyebrow-pill">
                <Orbit className="h-3.5 w-3.5" /> Lobby
              </span>
            </div>
            <p className="mt-4 truncate text-lg font-semibold text-white">
              {viewer.profile.displayName}
            </p>
            <p className="mt-1 truncate text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
              @{viewer.username} · {roleLabels[viewer.role]}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="status-pill">
                <span className="status-dot text-[var(--success)]" />
                {presenceLabels[viewer.profile.presence]}
              </span>
              <span className="status-pill">
                <Crown className="h-3.5 w-3.5 text-[var(--accent)]" />
                {roleLabels[viewer.role]}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 px-2">
        <p className="section-kicker">Навигация</p>
      </div>
      <nav className="nav-cluster mt-2">
        {navigation.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link">
            <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/[0.04] text-[var(--accent)]">
              <item.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-inherit">
                {item.label}
              </span>
              {"description" in item && item.description ? (
                <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                  {item.description}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </nav>

      <div className="surface-subtle mt-5 min-h-0 flex-1 overflow-auto rounded-[28px] p-3">
        <div className="flex items-center justify-between gap-3 px-2">
          <p className="section-kicker">Активные хабы</p>
          <span className="glass-badge">{hubItems.length}</span>
        </div>
        <div className="mt-3 space-y-2">
          {hubItems.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[var(--border)] px-4 py-4 text-sm leading-6 text-[var(--text-muted)]">
              Подключённых пространств пока нет. Создайте первый хаб или
              дождитесь приглашения.
            </div>
          ) : (
            hubItems.map((hub) => (
              <Link
                key={hub.id}
                href={hub.href}
                className="list-row block rounded-[24px] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {hub.name}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Приватная зона сообщества
                    </p>
                  </div>
                  <span className="glass-badge">{hub.role ?? "гость"}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="surface-subtle mt-4 rounded-[24px] p-4 text-sm leading-6 text-[var(--text-dim)]">
        <p className="section-kicker">Политика пространства</p>
        <p className="mt-2">
          Lobby не раскрывает публичный каталог пользователей, а доступ к новым
          секциям управляется ролями, инвайтами и аудитом действий.
        </p>
      </div>
    </aside>
  );
}
