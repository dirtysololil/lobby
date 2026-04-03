import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Layers3,
  MessageSquareMore,
  Settings2,
  ShieldCheck,
  Users2,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { requireViewer } from "@/lib/server-session";

const roleLabels = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MEMBER: "Участник",
} as const;

const presenceLabels = {
  ONLINE: "В сети",
  IDLE: "Отошёл",
  DND: "Не беспокоить",
  OFFLINE: "Скрыт",
} as const;

export default async function AppPage() {
  const viewer = await requireViewer();
  const isAdmin = viewer.role === "OWNER" || viewer.role === "ADMIN";

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-4">
        <div className="premium-panel rounded-[28px] p-5 lg:p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow-pill">
                  <Waves className="h-3.5 w-3.5" />
                  Lobby OS
                </span>
                <span className="status-pill">
                  <span className="status-dot text-[var(--success)]" />
                  {presenceLabels[viewer.profile.presence]}
                </span>
              </div>
              <h2 className="mt-4 font-[var(--font-heading)] text-[2rem] font-semibold tracking-[-0.05em] text-white">
                Рабочая среда для диалогов, пространств и real-time присутствия
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
                Главная сцена больше не пытается быть hero-экраном. Это точка
                входа в коммуникационную систему: быстрые переходы, live
                контекст, социальная идентичность и контроль без ощущения dark
                CRM.
              </p>
            </div>

            <div className="surface-highlight rounded-[24px] p-4">
              <div className="flex items-center gap-3">
                <UserAvatar user={viewer} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-white">
                    {viewer.profile.displayName}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">
                    @{viewer.username} · {roleLabels[viewer.role]}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-dim)]">
                {viewer.profile.bio ??
                  "Профиль пока без биографии. Добавьте контекст, чтобы люди в диалогах и хабах быстрее считывали вашу роль."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: MessageSquareMore,
              title: "Direct messages",
              text: "Личные каналы, unread, live calls и retention в одном ритме.",
              href: "/app/messages",
            },
            {
              icon: Layers3,
              title: "Community hubs",
              text: "Иерархия пространств, лобби и форумных обсуждений.",
              href: "/app/hubs",
            },
            {
              icon: Users2,
              title: "People graph",
              text: "Поиск, friendship flows и приватный социальный слой.",
              href: "/app/people",
            },
            {
              icon: Settings2,
              title: "Preferences",
              text: "Профиль, presence и настройка шум-контроля.",
              href: "/app/settings/profile",
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="list-row rounded-[24px] p-5"
            >
              <div className="dock-icon flex h-12 w-12 items-center justify-center rounded-[18px]">
                <item.icon className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <p className="mt-4 text-base font-semibold text-white">
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                {item.text}
              </p>
            </Link>
          ))}
        </div>

        <div className="premium-panel rounded-[28px] p-5 lg:p-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="surface-subtle rounded-[22px] p-4">
              <AudioLines className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-4 text-base font-semibold text-white">
                Voice-first readiness
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                LiveKit flows встроены в product shell и не выглядят чужим
                модулем.
              </p>
            </div>
            <div className="surface-subtle rounded-[22px] p-4">
              <Users2 className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-4 text-base font-semibold text-white">
                Social identity
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                Профили, presence и avatar language работают как часть живой
                среды общения.
              </p>
            </div>
            <div className="surface-subtle rounded-[22px] p-4">
              <ShieldCheck className="h-5 w-5 text-[var(--accent-warm)]" />
              <p className="mt-4 text-base font-semibold text-white">
                Internal control
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                Admin и settings подчинены тому же shell grammar, что и chat и
                hub surfaces.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="premium-panel rounded-[28px] p-5">
          <p className="section-kicker">Quick Routes</p>
          <div className="mt-4 grid gap-2">
            <Link href="/app/messages">
              <Button className="w-full justify-between" variant="secondary">
                Открыть сообщения <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/app/hubs">
              <Button className="w-full justify-between" variant="secondary">
                Перейти в хабы <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/app/people">
              <Button className="w-full justify-between" variant="secondary">
                Найти людей <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {isAdmin ? (
              <Link href="/app/admin">
                <Button className="w-full justify-between">
                  Центр контроля <ShieldCheck className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="premium-panel rounded-[28px] p-5">
          <p className="section-kicker">Identity</p>
          <div className="mt-4 space-y-3">
            <div className="surface-subtle rounded-[20px] p-4">
              <p className="text-sm text-[var(--text-dim)]">Почта</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {viewer.email}
              </p>
            </div>
            <div className="surface-subtle rounded-[20px] p-4">
              <p className="text-sm text-[var(--text-dim)]">Роль в системе</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {roleLabels[viewer.role]}
              </p>
            </div>
            <div className="surface-subtle rounded-[20px] p-4">
              <p className="text-sm text-[var(--text-dim)]">Presence</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {presenceLabels[viewer.profile.presence]}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
