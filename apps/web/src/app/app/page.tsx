import Link from "next/link";
import {
  ArrowRight,
  Layers3,
  MessageSquare,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users2,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid gap-5">
        <Card className="overflow-hidden">
          <CardHeader>
            <p className="section-kicker">Личный центр управления</p>
            <CardTitle>Добро пожаловать в Lobby</CardTitle>
            <CardDescription>
              Главная точка входа в ваши диалоги, хабы, форумные ветки и
              приватные процессы.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="surface-highlight rounded-[30px] p-5 lg:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <UserAvatar user={viewer} size="lg" />
                  <div>
                    <p className="text-2xl font-semibold text-white">
                      {viewer.profile.displayName}
                    </p>
                    <p className="mt-1 text-sm uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      @{viewer.username} · {roleLabels[viewer.role]}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="status-pill">
                        <span className="status-dot text-[var(--success)]" />
                        {presenceLabels[viewer.profile.presence]}
                      </span>
                      <span className="status-pill">
                        <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                        {viewer.profile.avatarPreset}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:w-[340px]">
                  <div className="metric-tile rounded-[22px] px-4 py-3">
                    <p className="section-kicker">Роль</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {roleLabels[viewer.role]}
                    </p>
                  </div>
                  <div className="metric-tile rounded-[22px] px-4 py-3">
                    <p className="section-kicker">Статус</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {presenceLabels[viewer.profile.presence]}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--text-dim)]">
                {viewer.profile.bio ??
                  "Профиль пока без описания. Добавьте биографию, чтобы люди в хабах и личных диалогах сразу считывали ваш контекст."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  icon: MessageSquare,
                  title: "Личные диалоги",
                  text: "Переход к плотному UX входящих диалогов и сгруппированным сообщениям.",
                  href: "/app/messages",
                },
                {
                  icon: Layers3,
                  title: "Хабы и лобби",
                  text: "Иерархия сообщества, роли участников и форумные зоны.",
                  href: "/app/hubs",
                },
                {
                  icon: Users2,
                  title: "Люди",
                  text: "Поиск, связи, блокировки и быстрый старт новых диалогов.",
                  href: "/app/people",
                },
                {
                  icon: Settings2,
                  title: "Настройки",
                  text: "Профиль, уведомления и персональные правила платформы.",
                  href: "/app/settings/profile",
                },
              ].map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="list-row rounded-[28px] p-5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/[0.05] text-[var(--accent)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                    {item.text}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Пульс платформы</CardTitle>
            <CardDescription>
              Что делает Lobby продуктом между премиальным мессенджером и
              приватной экосистемой сообществ.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <div className="surface-subtle rounded-[26px] p-5">
              <Waves className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-4 text-base font-semibold text-white">
                Живой социальный слой
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Presence, роли, участники и активность не прячутся за безликими
                CRUD-блоками.
              </p>
            </div>
            <div className="surface-subtle rounded-[26px] p-5">
              <MessageSquare className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-4 text-base font-semibold text-white">
                Мессенджер как ядро
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Сообщения и звонки остаются ядром продукта, а не второстепенным
                модулем.
              </p>
            </div>
            <div className="surface-subtle rounded-[26px] p-5">
              <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-4 text-base font-semibold text-white">
                Строгий центр контроля
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Админ-контур и слой доступа выглядят как внутренний центр
                управления, а не магазинная админка.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>
              Навигация по самым важным рабочим сценариям.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/app/messages">
              <Button className="w-full justify-between" variant="secondary">
                Открыть сообщения <MessageSquare className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/app/hubs">
              <Button className="w-full justify-between" variant="secondary">
                Перейти в хабы <Layers3 className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/app/people">
              <Button className="w-full justify-between" variant="secondary">
                Найти людей <Users2 className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/app/settings/notifications">
              <Button className="w-full justify-between" variant="secondary">
                Настроить уведомления <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {isAdmin ? (
              <Link href="/app/admin">
                <Button className="w-full justify-between">
                  Открыть центр контроля <ShieldCheck className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Профиль в сети</CardTitle>
            <CardDescription>
              Как ваш аккаунт выглядит внутри приватной экосистемы.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="surface-subtle rounded-[26px] p-5">
              <p className="section-kicker">Контактный слой</p>
              <p className="mt-3 text-sm leading-7 text-[var(--text-dim)]">
                Почта: <span className="text-white">{viewer.email}</span>
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Имя пользователя:{" "}
                <span className="text-white">@{viewer.username}</span>
              </p>
            </div>
            <div className="surface-subtle rounded-[26px] p-5 text-sm leading-7 text-[var(--text-dim)]">
              Для более сильной социальной идентичности настройте биографию,
              пресет аватара и уровень уведомлений под ваш способ работы.
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
