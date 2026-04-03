import {
  BellRing,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import type { PublicUser } from "@lobby/shared";
import { UserAvatar } from "@/components/ui/user-avatar";
import { LogoutButton } from "./logout-button";

interface AppHeaderProps {
  viewer: PublicUser;
}

const presenceLabels: Record<PublicUser["profile"]["presence"], string> = {
  ONLINE: "В сети",
  IDLE: "Не у компьютера",
  DND: "Не беспокоить",
  OFFLINE: "Скрыт",
};

const roleLabels: Record<PublicUser["role"], string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MEMBER: "Участник",
};

export function AppHeader({ viewer }: AppHeaderProps) {
  return (
    <header className="social-shell rounded-[32px] p-4 lg:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="surface-highlight rounded-[28px] px-5 py-4 lg:px-6 lg:py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">
              <Sparkles className="h-3.5 w-3.5" /> Закрытая сеть Lobby
            </span>
            <span className="status-pill">
              <span className="status-dot text-[var(--success)]" />
              {presenceLabels[viewer.profile.presence]}
            </span>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <p className="section-kicker">Операционный контур</p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-dim)]">
                Сообщения, сообщества, форумы и контроль доступа собраны в
                единый плотный интерфейс без ощущения шаблонной админки.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[420px]">
              <div className="metric-tile rounded-[22px] px-4 py-3">
                <p className="section-kicker">Роль</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {roleLabels[viewer.role]}
                </p>
              </div>
              <div className="metric-tile rounded-[22px] px-4 py-3">
                <p className="section-kicker">Нотификации</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  Включены
                </p>
              </div>
              <div className="metric-tile rounded-[22px] px-4 py-3">
                <p className="section-kicker">Контур</p>
                <p className="mt-2 text-sm font-semibold text-white">Защищён</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:min-w-[360px]">
          <div className="surface-subtle rounded-[26px] p-3">
            <div className="flex items-center gap-3">
              <UserAvatar user={viewer} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {viewer.profile.displayName}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  @{viewer.username} · {roleLabels[viewer.role]}
                </p>
              </div>
              <span className="status-pill">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
                Аккаунт активен
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface-subtle rounded-[24px] px-4 py-3 text-sm text-[var(--text-dim)]">
              <div className="flex items-center gap-2 text-white">
                <BellRing className="h-4 w-4 text-[var(--accent)]" />
                Входящие сигналы
              </div>
              <p className="mt-2 leading-6">
                Система готова к push-уведомлениям, звонкам и live presence.
              </p>
            </div>
            <div className="surface-subtle rounded-[24px] px-4 py-3 text-sm text-[var(--text-dim)]">
              <div className="flex items-center gap-2 text-white">
                <LockKeyhole className="h-4 w-4 text-[var(--accent)]" />
                Сессионная защита
              </div>
              <p className="mt-2 leading-6">
                Куки и серверные проверки защищают маршруты и действия.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="status-pill">
              <Waves className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
              Пространство синхронизировано
            </span>
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
