import Link from "next/link";
import { Home, Layers3, MessageSquare, Users2 } from "lucide-react";
import { hubListResponseSchema } from "@lobby/shared";
import { fetchServerApi } from "@/lib/server-api";

const sidebarItems = [
  {
    label: "Dashboard",
    href: "/app",
    icon: Home,
  },
  {
    label: "Invites",
    href: "/app",
    icon: Layers3,
  },
  {
    label: "Hubs",
    href: "/app/hubs",
    icon: Layers3,
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
];

export async function AppSidebar() {
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

  return (
    <aside className="flex h-full flex-col rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[var(--shadow)] backdrop-blur-xl">
      <div className="mb-6 flex items-center gap-3 rounded-3xl border border-sky-300/15 bg-sky-300/10 px-4 py-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/60 text-sky-300">
          <Layers3 className="h-5 w-5" />
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-200/70">
            Lobby
          </p>
          <p className="text-sm text-slate-300">Stage 2 social foundation</p>
        </div>
      </div>

      <nav className="space-y-2">
        {sidebarItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm text-slate-300 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
          >
            <item.icon className="h-4 w-4 text-sky-300" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/35 p-4">
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

      <div className="mt-auto rounded-3xl border border-white/10 bg-slate-950/35 p-4">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-sky-200/70">
          Connected
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Invite-only auth, social graph, hubs and forum foundation are live in this shell.
        </p>
      </div>
    </aside>
  );
}
