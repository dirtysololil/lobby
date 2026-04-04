import type { ReactNode } from "react";
import {
  Layers3,
  MessageSquareMore,
  Settings2,
  ShieldCheck,
  Users2,
} from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

interface PreviewRow {
  id: string;
  label: string;
  detail?: string;
  active?: boolean;
  meta?: ReactNode;
  user?: PublicUser;
  initials?: string;
}

interface PreviewShellProps {
  viewer: PublicUser;
  sectionLabel: string;
  rows: PreviewRow[];
  children: ReactNode;
}

const iconProps = { size: 20, strokeWidth: 1.5 } as const;

export function PreviewShell({
  viewer,
  sectionLabel,
  rows,
  children,
}: PreviewShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text)]">
      <div className="grid min-h-screen grid-cols-[72px_15rem_minmax(0,1fr)]">
        <aside className="workspace-dock flex min-h-screen flex-col items-center justify-between border-r border-white/5">
          <div className="flex w-full flex-col items-center gap-2 px-2 py-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)),rgba(106,168,248,0.18)] text-sm font-semibold tracking-tight text-white shadow-[0_12px_28px_rgba(5,10,18,0.28)]">
              Lb
            </div>
            {[
              MessageSquareMore,
              Users2,
              Layers3,
              Settings2,
              ShieldCheck,
            ].map((Icon, index) => (
              <div
                key={index}
                className={cn(
                  "dock-icon flex h-10 w-10 items-center justify-center rounded-[16px] text-zinc-400",
                  index === 0 && "dock-icon-active text-white",
                )}
              >
                <Icon {...iconProps} />
              </div>
            ))}
          </div>

          <div className="px-2 py-3">
            <UserAvatar user={viewer} size="sm" />
          </div>
        </aside>

        <aside className="context-rail flex min-h-screen flex-col border-r border-white/5">
          <div className="border-b border-white/5 px-3 py-3">
            <div className="flex items-center gap-2 rounded-[18px] border border-white/6 bg-white/[0.03] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <UserAvatar user={viewer} size="sm" />
              <span className="status-dot bg-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {viewer.profile.displayName}
                </p>
                <p className="truncate text-xs text-zinc-500">@{viewer.username}</p>
              </div>
            </div>
          </div>

          <div className="px-3 pt-3 text-xs text-zinc-500">{sectionLabel}</div>
          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "mx-2 my-1 flex min-h-[52px] items-center gap-3 rounded-[16px] border border-transparent px-3 text-sm transition-colors",
                  row.active
                    ? "border-[rgba(106,168,248,0.18)] bg-[rgba(106,168,248,0.12)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    : "text-zinc-400",
                )}
              >
                {row.user ? (
                  <UserAvatar user={row.user} size="sm" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-[10px] font-semibold text-zinc-200">
                    {row.initials ?? row.label.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">
                    {row.label}
                  </span>
                  {row.detail ? (
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {row.detail}
                    </span>
                  ) : null}
                </span>
                {row.meta}
              </div>
            ))}
          </div>
        </aside>

        <main className="min-h-screen bg-[linear-gradient(180deg,rgba(255,255,255,0.012),transparent_18%)]">
          {children}
        </main>
      </div>
    </div>
  );
}
