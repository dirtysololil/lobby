import Link from "next/link";
import { LayoutDashboard, KeyRound, Layers3, MessageSquare, Settings2, ShieldCheck, Users2 } from "lucide-react";
import { hubListResponseSchema, type PublicUser } from "@lobby/shared";
import { UserAvatar } from "@/components/ui/user-avatar";
import { fetchServerApi } from "@/lib/server-api";

interface AppSidebarProps {
  viewer: PublicUser;
}

export async function AppSidebar({ viewer }: AppSidebarProps) {
  let hubItems: Array<{ id: string; name: string; href: string; role: string | null }> = [];

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
    { label: "Главная", href: "/app", icon: LayoutDashboard },
    { label: "Люди", href: "/app/people", icon: Users2 },
    { label: "Сообщения", href: "/app/messages", icon: MessageSquare },
    { label: "Хабы", href: "/app/hubs", icon: Layers3 },
    { label: "Настройки", href: "/app/settings/profile", icon: Settings2 },
    ...(viewer.role === "OWNER" || viewer.role === "ADMIN"
      ? [
          { label: "Админка", href: "/app/admin", icon: ShieldCheck },
          { label: "Ключи", href: "/app/admin/invites", icon: KeyRound },
        ]
      : []),
  ];

  return (
    <aside className="flex h-full max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 shadow-[var(--shadow)] backdrop-blur-xl lg:sticky lg:top-3">
      <div className="mb-4 rounded-3xl border border-[var(--border)] bg-slate-950/45 p-4">
        <div className="flex items-center gap-3">
          <UserAvatar user={viewer} />
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-200/70">Lobby</p>
            <p className="mt-1 truncate text-base font-medium text-white">{viewer.profile.displayName}</p>
            <p className="mt-1 truncate text-xs text-slate-400">@{viewer.username} · {viewer.role}</p>
          </div>
        </div>
      </div>

      <nav className="grid gap-1.5">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sm text-slate-300 transition hover:border-[var(--border)] hover:bg-white/[0.06] hover:text-white"
          >
            <item.icon className="h-4 w-4 text-cyan-200" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-3xl border border-[var(--border)] bg-slate-950/35 p-3">
        <p className="px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/70">Мои хабы</p>
        <div className="mt-2.5 space-y-1.5">
          {hubItems.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">Пока нет подключённых хабов.</p>
          ) : (
            hubItems.map((hub) => (
              <Link
                key={hub.id}
                href={hub.href}
                className="flex items-center justify-between rounded-2xl border border-transparent px-3 py-2.5 text-sm text-slate-300 transition hover:border-[var(--border)] hover:bg-white/[0.06] hover:text-white"
              >
                <span className="truncate">{hub.name}</span>
                <span className="ml-3 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100/70">
                  {hub.role ?? "гость"}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
