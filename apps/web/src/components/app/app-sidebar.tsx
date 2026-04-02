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
    {
      label: "Dashboard",
      href: "/app",
      icon: LayoutDashboard,
    },
    {
      label: "People",
      href: "/app/people",
      icon: Users2,
    },
    {
      label: "Messages",
      href: "/app/messages",
      icon: MessageSquare,
    },
    {
      label: "Hubs",
      href: "/app/hubs",
      icon: Layers3,
    },
    {
      label: "Settings",
      href: "/app/settings/profile",
      icon: Settings2,
    },
    ...(viewer.role === "OWNER" || viewer.role === "ADMIN"
      ? [
          {
            label: "Admin",
            href: "/app/admin",
            icon: ShieldCheck,
          },
          {
            label: "Invite keys",
            href: "/app/admin/invites",
            icon: KeyRound,
          },
        ]
      : []),
  ];

  return (
    <aside className="flex h-full flex-col rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 shadow-[var(--shadow)] backdrop-blur-xl">
      <div className="mb-6 rounded-[28px] border border-white/10 bg-slate-950/45 p-4">
        <div className="flex items-center gap-4">
          <UserAvatar user={viewer} />
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-200/70">Lobby</p>
            <p className="mt-1 truncate text-base font-medium text-white">{viewer.profile.displayName}</p>
            <p className="mt-1 truncate text-sm text-slate-400">
              @{viewer.username} · {viewer.role}
            </p>
          </div>
        </div>
      </div>

      <nav className="space-y-2">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
          >
            <item.icon className="h-4 w-4 text-sky-300" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-950/35 p-4">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-sky-200/70">Your hubs</p>
        <div className="mt-4 space-y-2">
          {hubItems.length === 0 ? (
            <p className="text-sm leading-6 text-slate-500">No joined hubs yet.</p>
          ) : (
            hubItems.map((hub) => (
              <Link
                key={hub.id}
                href={hub.href}
                className="flex items-center justify-between rounded-2xl border border-transparent px-3 py-3 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
              >
                <span className="truncate">{hub.name}</span>
                <span className="ml-3 rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-sky-200/70">
                  {hub.role ?? "guest"}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="mt-auto rounded-[28px] border border-white/10 bg-slate-950/35 p-4">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-sky-200/70">Platform state</p>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          Invite-only auth, social graph, hubs, forum, LiveKit calls, avatar presets and moderation tools are active in this shell.
        </p>
      </div>
    </aside>
  );
}
