import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Hash,
  LockKeyhole,
  MessageSquareQuote,
  Mic,
  Waves,
} from "lucide-react";
import type { HubShell } from "@lobby/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { buildHubLobbyHref } from "@/lib/hub-routes";
import { buildUserProfileHref } from "@/lib/profile-routes";
import { HubShellBootstrap } from "./hub-shell-bootstrap";

const DeferredLobbyCallPanel = dynamic(
  () =>
    import("@/components/calls/lobby-call-panel").then(
      (module) => module.LobbyCallPanel,
    ),
  {
    loading: () => (
      <div className="premium-panel rounded-[22px] px-4 py-4 text-sm text-[var(--text-dim)]">
        Подготавливаем голосовую комнату...
      </div>
    ),
  },
);

interface HubLobbyViewProps {
  hub: HubShell["hub"];
  lobbyId: string;
}

function getLobbySurfaceLabel(type: HubShell["hub"]["lobbies"][number]["type"]) {
  switch (type) {
    case "VOICE":
      return "Голосовая комната";
    case "FORUM":
      return "Форум";
    default:
      return "Текстовый канал";
  }
}

function getLobbyFallbackDescription(
  type: HubShell["hub"]["lobbies"][number]["type"],
) {
  switch (type) {
    case "VOICE":
      return "Быстрый вход в голосовую комнату хаба.";
    case "FORUM":
      return "Темы, ответы и длинные обсуждения по хабу.";
    default:
      return "Короткий контекст и быстрые переходы по хабу.";
  }
}

function QuickJumpCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof MessageSquareQuote;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3 transition-colors hover:border-[var(--border)] hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--bg-panel-soft)] text-white">
            <Icon className="h-4 w-4" />
          </div>
          <p className="mt-3 text-sm font-medium text-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">
            {description}
          </p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
      </div>
    </Link>
  );
}

export function HubLobbyView({ hub, lobbyId }: HubLobbyViewProps) {
  const lobby = hub.lobbies.find((item) => item.id === lobbyId);

  if (!lobby) {
    return (
      <div className="rounded-[16px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
        Лобби не найдено или у вас нет доступа к этой рабочей зоне.
      </div>
    );
  }

  const relatedForums = hub.lobbies.filter((item) => item.type === "FORUM");
  const relatedVoice = hub.lobbies.filter((item) => item.type === "VOICE");
  const memberPreview = hub.members.slice(0, 6);
  const relatedSpaces = [
    {
      href: `/app/hubs/${hub.id}`,
      icon: Waves,
      title: "Обзор хаба",
      description: "Состав, роли и общая структура пространства.",
    },
    relatedForums[0]
      ? {
          href: buildHubLobbyHref(
            hub.id,
            relatedForums[0].id,
            relatedForums[0].type,
          ),
          icon: MessageSquareQuote,
          title:
            relatedForums.length > 1 ? "Форумы хаба" : relatedForums[0].name,
          description: "Длинные обсуждения с ответами и тегами.",
        }
      : null,
    relatedVoice[0] && relatedVoice[0].id !== lobby.id
      ? {
          href: buildHubLobbyHref(
            hub.id,
            relatedVoice[0].id,
            relatedVoice[0].type,
          ),
          icon: Mic,
          title:
            relatedVoice.length > 1
              ? "Голосовые комнаты"
              : relatedVoice[0].name,
          description: "Быстрое подключение к созвону внутри хаба.",
        }
      : null,
  ].filter(Boolean) as Array<{
    href: string;
    title: string;
    description: string;
    icon: typeof MessageSquareQuote;
  }>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HubShellBootstrap hub={hub} />

      <div className="border-b border-white/5 px-3 py-3">
        <div className="compact-toolbar gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                {lobby.type === "VOICE" ? (
                  <Mic className="h-3.5 w-3.5" />
                ) : (
                  <Hash className="h-3.5 w-3.5" />
                )}
                {lobby.type === "VOICE" ? "Голос" : "Канал"}
              </span>
              <span className="status-pill">
                {getLobbySurfaceLabel(lobby.type)}
              </span>
              {lobby.isPrivate ? (
                <span className="status-pill">
                  <LockKeyhole className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Приватный
                </span>
              ) : null}
            </div>

            <h1 className="mt-1.5 font-[var(--font-heading)] text-[1.15rem] font-semibold tracking-[-0.04em] text-white">
              {lobby.name}
            </h1>
            <p className="mt-1 line-clamp-1 text-sm text-[var(--text-dim)]">
              {lobby.description?.trim() || getLobbyFallbackDescription(lobby.type)}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="grid gap-3">
          {hub.isViewerMuted ? (
            <div className="rounded-[16px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
              {lobby.type === "VOICE"
                ? "Для этого аккаунта доступен только режим прослушивания: микрофон, камера и экран отключены."
                : "В этом хабе для вас ограничена публикация нового контента."}
            </div>
          ) : null}

          {lobby.type === "VOICE" ? (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0">
                <DeferredLobbyCallPanel
                  hubId={hub.id}
                  hubName={hub.name}
                  lobbyId={lobby.id}
                  lobbyName={lobby.name}
                  isViewerMuted={hub.isViewerMuted}
                />
              </div>

              <aside className="grid content-start gap-3">
                <section className="premium-panel rounded-[24px] p-4">
                  <p className="section-kicker">О комнате</p>
                  <div className="mt-3 grid gap-2">
                    <div className="surface-subtle rounded-[16px] px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Формат
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        Голосовая сцена
                      </p>
                    </div>
                    <div className="surface-subtle rounded-[16px] px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Доступ
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {lobby.isPrivate ? "По списку участников" : "Открыта для хаба"}
                      </p>
                    </div>
                    <div className="surface-subtle rounded-[16px] px-3 py-2.5 text-sm text-[var(--text-dim)]">
                      Быстрый созвон, возврат к комнате через call dock и переходы в соседние пространства без лишних экранов.
                    </div>
                  </div>
                </section>

                {relatedSpaces.length > 0 ? (
                  <section className="premium-panel rounded-[24px] p-4">
                    <p className="section-kicker">Соседние пространства</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {relatedSpaces.slice(0, 3).map((item) => (
                        <Link key={item.href} href={item.href}>
                          <Button size="sm" variant="secondary">
                            <item.icon className="h-4 w-4" />
                            {item.title}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="premium-panel rounded-[24px] p-4">
                  <p className="section-kicker">Участники хаба</p>
                  <div className="mt-3 grid gap-2">
                    {memberPreview.length === 0 ? (
                      <div className="rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--text-dim)]">
                        Список участников доступен после вступления в хаб.
                      </div>
                    ) : (
                      memberPreview.map((member) => (
                        <Link
                          key={member.id}
                          href={buildUserProfileHref(member.user.username)}
                          className="identity-link rounded-[16px] border border-transparent px-2 py-2 hover:border-[var(--border-soft)] hover:bg-white/[0.03]"
                        >
                          <UserAvatar user={member.user} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-white">
                                {member.user.profile.displayName}
                              </p>
                              <PresenceIndicator user={member.user} compact />
                            </div>
                            <p className="truncate text-xs text-[var(--text-muted)]">
                              @{member.user.username}
                            </p>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </section>
              </aside>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid min-w-0 gap-3">
                <section className="social-shell rounded-[24px] p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow-pill">
                      <Hash className="h-3.5 w-3.5" />
                      Текстовый канал
                    </span>
                    <span className="status-pill">Контекст хаба</span>
                  </div>

                  <h2 className="mt-3 text-lg font-semibold tracking-[-0.04em] text-white">
                    Короткая рабочая поверхность для навигации по хабу.
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                    Здесь удобно держать описание, быстрые переходы и соседние пространства, не раздувая хаб в лишний дашборд.
                  </p>
                </section>

                <section className="premium-panel rounded-[24px] p-4">
                  <div className="compact-toolbar gap-3">
                    <div>
                      <p className="section-kicker">Быстрые переходы</p>
                      <p className="mt-2 text-sm text-[var(--text-dim)]">
                        Откройте нужную поверхность хаба без возврата в общий список.
                      </p>
                    </div>
                  </div>

                  {relatedSpaces.length > 0 ? (
                    <div className="mt-4 grid gap-2 xl:grid-cols-2">
                      {relatedSpaces.map((item) => (
                        <QuickJumpCard
                          key={item.href}
                          href={item.href}
                          icon={item.icon}
                          title={item.title}
                          description={item.description}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="Соседних пространств пока нет"
                      description="Этот канал сейчас служит основной точкой входа в хаб."
                    />
                  )}
                </section>
              </div>

              <aside className="grid content-start gap-3">
                <section className="premium-panel rounded-[24px] p-4">
                  <p className="section-kicker">О канале</p>
                  <div className="mt-3 grid gap-2">
                    <div className="surface-subtle rounded-[16px] px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Формат
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        Текстовая поверхность
                      </p>
                    </div>
                    <div className="surface-subtle rounded-[16px] px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Доступ
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {lobby.isPrivate ? "По списку участников" : "Открыт для хаба"}
                      </p>
                    </div>
                    <div className="surface-subtle rounded-[16px] px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Связанные пространства
                      </p>
                      <p className="mt-1 text-sm font-medium text-white">
                        {relatedSpaces.length}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="premium-panel rounded-[24px] p-4">
                  <p className="section-kicker">Участники</p>
                  <div className="mt-3 grid gap-2">
                    {memberPreview.length === 0 ? (
                      <div className="rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--text-dim)]">
                        Состав хаба появится здесь, когда вы получите доступ к участникам.
                      </div>
                    ) : (
                      memberPreview.map((member) => (
                        <Link
                          key={member.id}
                          href={buildUserProfileHref(member.user.username)}
                          className="identity-link rounded-[16px] border border-transparent px-2 py-2 hover:border-[var(--border-soft)] hover:bg-white/[0.03]"
                        >
                          <UserAvatar user={member.user} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-white">
                                {member.user.profile.displayName}
                              </p>
                              <PresenceIndicator user={member.user} compact />
                            </div>
                            <p className="truncate text-xs text-[var(--text-muted)]">
                              @{member.user.username}
                            </p>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </section>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
