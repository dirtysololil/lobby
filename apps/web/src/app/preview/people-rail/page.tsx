import Link from "next/link";
import {
  Bell,
  Layers3,
  LockKeyhole,
  MessageSquareMore,
  Search,
  Settings2,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { previewViewer } from "../_mock-data";
import { cn } from "@/lib/utils";

const sidebarIconProps = { size: 22, strokeWidth: 2.15 } as const;
const railIconProps = { size: 18, strokeWidth: 1.9 } as const;

const peopleViews = [
  { id: "friends", label: "Друзья", icon: Users2, count: 4, active: true },
  { id: "requests", label: "Заявки", icon: Users2, count: 1 },
  { id: "discover", label: "Поиск", icon: Search },
  { id: "suggested", label: "Возможные друзья", icon: Users2 },
  { id: "blocked", label: "Блокировки", icon: LockKeyhole, count: 0 },
] as const;

function SidebarIconLink({
  active,
  children,
  href,
  label,
}: {
  active?: boolean;
  children: React.ReactNode;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "group relative inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-[#a6afbd] transition-all duration-150 md:h-[52px] md:w-[52px] md:rounded-[15px]",
        "hover:bg-white/[0.026] hover:text-white",
        active && "bg-[#101b27] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]",
      )}
    >
      {active ? (
        <>
          <span className="pointer-events-none absolute left-[-20px] top-1/2 hidden h-12 w-10 -translate-y-1/2 rounded-full bg-[#4a84ff]/16 blur-[14px] md:block" />
          <span className="pointer-events-none absolute left-[-18px] top-1/2 hidden h-11 w-[2px] -translate-y-1/2 rounded-full bg-[#4a84ff] shadow-[0_0_13px_rgba(74,132,255,0.58)] md:block" />
        </>
      ) : null}
      {children}
    </Link>
  );
}

function RailRow({
  href,
  label,
  active,
  count,
  icon: Icon,
}: {
  href: string;
  label: string;
  active?: boolean;
  count?: number;
  icon: typeof Users2;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex w-full min-w-0 items-center gap-3 rounded-[15px] px-3 py-2.5 transition-all duration-150",
        active
          ? "bg-[#101b27] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
          : "text-[#a6afbd] hover:bg-white/[0.026] hover:text-white",
      )}
    >
      {active ? (
        <>
          <span className="pointer-events-none absolute left-[-20px] top-1/2 hidden h-12 w-10 -translate-y-1/2 rounded-full bg-[#4a84ff]/16 blur-[14px] md:block" />
          <span className="pointer-events-none absolute left-[-18px] top-1/2 hidden h-11 w-[2px] -translate-y-1/2 rounded-full bg-[#4a84ff] shadow-[0_0_13px_rgba(74,132,255,0.58)] md:block" />
        </>
      ) : null}

      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] transition-all duration-150",
          active ? "text-white" : "text-[#a6afbd] group-hover:text-white",
        )}
      >
        <Icon {...railIconProps} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-medium leading-tight",
            active ? "text-white" : "text-[#a6afbd] group-hover:text-white",
          )}
        >
          {label}
        </span>
      </span>

      {count !== undefined ? (
        <span className="inline-flex min-h-6 items-center rounded-full border border-white/10 bg-white/[0.026] px-2.5 text-[11px] font-medium text-[#a6afbd]">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export default function PreviewPeopleRailPage() {
  return (
    <div className="min-h-[calc(100vh-57px)]">
      <div className="grid min-h-[calc(100vh-57px)] grid-cols-[88px_15rem_minmax(0,1fr)]">
        <aside className="workspace-dock hidden bg-[#0a1016] md:static md:z-auto md:flex md:h-full md:w-[88px] md:flex-col md:border-r md:border-white/5 md:bg-[#0a1016]">
          <div className="hidden h-full items-center justify-between gap-2 px-2 py-2 md:flex md:flex-col md:items-center md:justify-start md:px-0 md:pb-4 md:pt-[28px]">
            <Link
              href="/preview/people-rail"
              className="hidden h-[46px] w-[46px] items-center justify-center rounded-[11px] border border-white/13 bg-[#111821] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] md:flex"
              aria-label="Lobby"
              title="Lobby"
            >
              <span className="select-none text-[14px] font-bold tracking-[-0.07em] text-white">
                LB
              </span>
            </Link>

            <div className="hidden h-px w-[74px] bg-white/6 md:mt-[28px] md:block" />

            <nav className="flex items-center gap-1.5 md:mt-[18px] md:flex-col md:gap-[18px]">
              <SidebarIconLink href="/preview/dm-thread" label="Сообщения">
                <MessageSquareMore {...sidebarIconProps} />
              </SidebarIconLink>
              <SidebarIconLink href="/preview/people-rail" label="Люди" active>
                <Users2 {...sidebarIconProps} />
              </SidebarIconLink>
              <SidebarIconLink href="/preview/hubs" label="Хабы">
                <Layers3 {...sidebarIconProps} />
              </SidebarIconLink>
            </nav>

            <div className="hidden h-px w-[74px] bg-white/6 md:mt-[28px] md:block" />

            <div className="ml-auto flex items-center gap-1.5 md:ml-0 md:mt-auto md:w-full md:flex-col md:items-center md:gap-[18px] md:pb-3">
              <SidebarIconLink href="/preview/settings" label="Настройки">
                <Settings2 {...sidebarIconProps} />
              </SidebarIconLink>
              <SidebarIconLink href="/preview/settings" label="Уведомления">
                <Bell {...sidebarIconProps} />
              </SidebarIconLink>
              <SidebarIconLink href="/preview/admin" label="Админка">
                <ShieldCheck {...sidebarIconProps} />
              </SidebarIconLink>
              <Link
                href="/preview/people-rail"
                title="Профиль"
                aria-label="Профиль"
                className="ml-1 inline-flex rounded-full border border-white/8 p-0.5 transition-all duration-150 hover:border-white/14 md:ml-0 md:mt-1"
              >
                <UserAvatar
                  user={previewViewer}
                  size="lg"
                  className="h-[46px] w-[46px] text-[11px]"
                />
              </Link>
            </div>
          </div>
        </aside>

        <aside className="context-rail relative hidden h-full w-60 shrink-0 border-r border-white/5 bg-[#0a1016] md:flex md:flex-col">
          <div className="border-b border-white/5 px-3 py-3.5">
            <div className="flex items-center gap-2.5 rounded-[20px] border border-white/13 bg-[#111821] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
              <UserAvatar
                user={previewViewer}
                size="sm"
                className="h-10 w-10 text-[11px]"
                showPresenceIndicator={false}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {previewViewer.profile.displayName}
                </p>
                <p className="truncate text-xs text-[#7f8a9c]">@{previewViewer.username}</p>
              </div>
              <PresenceIndicator
                user={previewViewer}
                compact
                className="border-white/10 bg-white/[0.026] px-2.5 py-1 text-[11px] text-[#a6afbd]"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-[#6f7b8e]">
                <span>Люди</span>
                <Link
                  href="/preview/dm-thread"
                  className="inline-flex items-center gap-1.5 normal-case tracking-normal text-[#a6afbd] transition-colors hover:text-white"
                >
                  <MessageSquareMore {...railIconProps} />
                  Диалоги
                </Link>
              </div>

              <div className="flex flex-col gap-1.5 px-3 pb-3">
                {peopleViews.map((item) => (
                  <RailRow
                    key={item.id}
                    href={`/preview/people-rail?view=${item.id}`}
                    label={item.label}
                    icon={item.icon}
                    count={item.count}
                    active={item.active}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="bg-[linear-gradient(180deg,rgba(255,255,255,0.008),transparent_18%)]" />
      </div>
    </div>
  );
}
