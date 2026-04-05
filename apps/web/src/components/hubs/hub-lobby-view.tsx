import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Hash, LockKeyhole, MessageSquareQuote, Mic, Waves } from "lucide-react";
import type { HubShell } from "@lobby/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserAvatar } from "@/components/ui/user-avatar";
import { buildHubLobbyHref } from "@/lib/hub-routes";
import { buildUserProfileHref } from "@/lib/profile-routes";
import { HubShellBootstrap } from "./hub-shell-bootstrap";

const DeferredLobbyCallPanel = dynamic(
  () => import("@/components/calls/lobby-call-panel").then((module) => module.LobbyCallPanel),
  {
    loading: () => (
      <div className="rounded-[20px] border border-[var(--border)] bg-white/[0.03] px-4 py-4 text-sm text-[var(--text-dim)]">
        Preparing voice room...
      </div>
    ),
  },
);

interface HubLobbyViewProps {
  hub: HubShell["hub"];
  lobbyId: string;
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
          <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">{description}</p>
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
        Р›РѕР±Р±Рё РЅРµ РЅР°Р№РґРµРЅРѕ РёР»Рё Сѓ РІР°СЃ РЅРµС‚ РґРѕСЃС‚СѓРїР° Рє СЌС‚РѕР№ СЂР°Р±РѕС‡РµР№ Р·РѕРЅРµ.
      </div>
    );
  }

  const relatedForums = hub.lobbies.filter((item) => item.type === "FORUM");
  const relatedVoice = hub.lobbies.filter((item) => item.type === "VOICE");
  const memberPreview = hub.members.slice(0, 6);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HubShellBootstrap hub={hub} />

      <div className="border-b border-white/5 px-3 py-3">
        <div className="compact-toolbar">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                {lobby.type === "VOICE" ? (
                  <Mic className="h-3.5 w-3.5" />
                ) : (
                  <Hash className="h-3.5 w-3.5" />
                )}
                {lobby.type === "VOICE" ? "Р“РѕР»РѕСЃ" : "РљР°РЅР°Р»"}
              </span>
              <span className="status-pill">
                {lobby.type === "VOICE"
                  ? "Р“РѕР»РѕСЃРѕРІРѕР№"
                  : lobby.type === "TEXT"
                    ? "РўРµРєСЃС‚РѕРІР°СЏ РїРѕРІРµСЂС…РЅРѕСЃС‚СЊ"
                    : "Р¤РѕСЂСѓРј"}
              </span>
              {lobby.isPrivate ? (
                <span className="status-pill">
                  <LockKeyhole className="h-3.5 w-3.5 text-[var(--accent)]" />
                  РџСЂРёРІР°С‚РЅС‹Р№
                </span>
              ) : null}
            </div>
            <h1 className="mt-1.5 font-[var(--font-heading)] text-[1.15rem] font-semibold tracking-[-0.04em] text-white">
              {lobby.name}
            </h1>
            <p className="mt-1 truncate text-sm text-[var(--text-dim)]">
              {lobby.description ??
                (lobby.type === "VOICE"
                  ? "Р“РѕР»РѕСЃРѕРІР°СЏ СЃС†РµРЅР°"
                  : lobby.type === "TEXT"
                    ? "РўРµРєСЃС‚РѕРІРѕР№ РєРѕРЅС‚РµРєСЃС‚ РґР»СЏ РЅР°РІРёРіР°С†РёРё Рё Р±С‹СЃС‚СЂС‹С… РїРµСЂРµС…РѕРґРѕРІ"
                    : "Р¤РѕСЂСѓРј")}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="mx-auto grid max-w-[1120px] gap-3">
          {hub.isViewerMuted ? (
            <div className="rounded-[16px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
              Р”Р»СЏ СЌС‚РѕРіРѕ Р°РєРєР°СѓРЅС‚Р° РїСѓР±Р»РёРєР°С†РёСЏ РјРµРґРёР° РѕРіСЂР°РЅРёС‡РµРЅР°. РЎР»СѓС€Р°С‚СЊ РєРѕРјРЅР°С‚Сѓ РјРѕР¶РЅРѕ, РЅРѕ
              РіРѕРІРѕСЂРёС‚СЊ Рё РїРѕРєР°Р·С‹РІР°С‚СЊ СЌРєСЂР°РЅ РЅРµ РїРѕР»СѓС‡РёС‚СЃСЏ.
            </div>
          ) : null}

          {lobby.type === "VOICE" ? (
            <DeferredLobbyCallPanel
              hubId={hub.id}
              hubName={hub.name}
              lobbyId={lobby.id}
              lobbyName={lobby.name}
              isViewerMuted={hub.isViewerMuted}
            />
          ) : (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-3">
                <section className="social-shell rounded-[24px] p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="eyebrow-pill">
                      <Hash className="h-3.5 w-3.5" />
                      РўРµРєСЃС‚РѕРІР°СЏ РїРѕРІРµСЂС…РЅРѕСЃС‚СЊ
                    </span>
                    <span className="status-pill">Р‘РµР· live composer</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold tracking-[-0.04em] text-white">
                    Р­С‚РѕС‚ РєР°РЅР°Р» СЂР°Р±РѕС‚Р°РµС‚ РєР°Рє РєРѕРЅС‚РµРєСЃС‚РЅР°СЏ С‚РѕС‡РєР° С…Р°Р±Р°.
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
                    Р—РґРµСЃСЊ РЅРµС‚ С„РѕСЂРјС‹ РѕС‚РїСЂР°РІРєРё СЃРѕРѕР±С‰РµРЅРёР№: РґР»РёРЅРЅС‹Рµ РѕР±СЃСѓР¶РґРµРЅРёСЏ СѓР¶Рµ СѓРІРµРґРµРЅС‹ РІ С„РѕСЂСѓРјС‹,
                    Р° Р±С‹СЃС‚СЂС‹Р№ РєРѕРЅС‚Р°РєС‚ РѕСЃС‚Р°С‘С‚СЃСЏ РІ Р›РЎ Рё РіРѕР»РѕСЃРѕРІС‹С… РєРѕРјРЅР°С‚Р°С….
                  </p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <QuickJumpCard
                      href={`/app/hubs/${hub.id}`}
                      icon={Waves}
                      title="РћР±Р·РѕСЂ С…Р°Р±Р°"
                      description="Р’РµСЂРЅСѓС‚СЊСЃСЏ Рє СѓС‡Р°СЃС‚РЅРёРєР°Рј, РїСЂР°РІР°Рј Рё РѕР±С‰РµР№ СЃС‚СЂСѓРєС‚СѓСЂРµ."
                    />
                    {relatedForums[0] ? (
                      <QuickJumpCard
                        href={buildHubLobbyHref(hub.id, relatedForums[0].id, relatedForums[0].type)}
                        icon={MessageSquareQuote}
                        title={relatedForums.length > 1 ? "Р¤РѕСЂСѓРјС‹ С…Р°Р±Р°" : relatedForums[0].name}
                        description="РџРµСЂРµР№С‚Рё РІ thread-based РѕР±СЃСѓР¶РґРµРЅРёРµ СЃ РѕС‚РІРµС‚Р°РјРё Рё РѕР±С‰РёРј РєРѕРЅС‚РµРєСЃС‚РѕРј."
                      />
                    ) : (
                      <QuickJumpCard
                        href="/app/messages"
                        icon={MessageSquareQuote}
                        title="Р›РёС‡РЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ"
                        description="Р•СЃР»Рё РЅСѓР¶РЅР° Р±С‹СЃС‚СЂР°СЏ РїРµСЂРµРїРёСЃРєР°, РїРµСЂРµР№РґРёС‚Рµ РІ ЛС."
                      />
                    )}
                  </div>
                </section>

                {(relatedForums.length > 0 || relatedVoice.length > 0) && (
                  <section className="premium-panel rounded-[24px] p-4">
                    <div className="compact-toolbar">
                      <div>
                        <p className="section-kicker">РљСѓРґР° РїРµСЂРµР№С‚Рё РґР°Р»СЊС€Рµ</p>
                        <p className="mt-2 text-sm text-[var(--text-dim)]">
                          Р’СЃРµ Р°РєС‚РёРІРЅС‹Рµ РїРѕРІРµСЂС…РЅРѕСЃС‚Рё РґР»СЏ РѕР±С‰РµРЅРёСЏ Рё СЃРѕР·РІРѕРЅРѕРІ РїРѕ Р­С‚РѕРјСѓ С…Р°Р±Сѓ.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {relatedForums.map((item) => (
                        <Link
                          key={item.id}
                          href={buildHubLobbyHref(hub.id, item.id, item.type)}
                        >
                          <Button size="sm" variant="secondary">
                            <MessageSquareQuote className="h-4 w-4" />
                            {item.name}
                          </Button>
                        </Link>
                      ))}
                      {relatedVoice.map((item) => (
                        <Link
                          key={item.id}
                          href={buildHubLobbyHref(hub.id, item.id, item.type)}
                        >
                          <Button size="sm" variant="secondary">
                            <Mic className="h-4 w-4" />
                            {item.name}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className="grid gap-3">
                <section className="premium-panel rounded-[24px] p-4">
                  <p className="section-kicker">РЈС‡Р°СЃС‚РЅРёРєРё</p>
                  <div className="mt-3 grid gap-2">
                    {memberPreview.map((member) => (
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
                    ))}
                  </div>
                </section>

                <section className="premium-panel rounded-[24px] p-4">
                  <p className="section-kicker">Р›РѕРіРёРєР° РєР°РЅР°Р»Р°</p>
                  <div className="mt-3 rounded-[18px] border border-[var(--border-soft)] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-[var(--text-soft)]">
                    РўРµРєСЃС‚РѕРІС‹Рµ Р»РѕР±Р±Рё РІ С‚РµРєСѓС‰РµР№ РІРµСЂСЃРёРё РѕР±СЉРµРґРёРЅСЏСЋС‚ РЅР°РІРёРіР°С†РёСЋ, РѕРїРёСЃР°РЅРёРµ Рё РїРµСЂРµС…РѕРґС‹. Р•СЃР»Рё РЅСѓР¶РЅР° threaded
                    РґРёСЃРєСѓСЃСЃРёСЏ, Р»СѓС‡С€Рµ СЃСЂР°Р·Сѓ РѕС‚РєСЂС‹С‚СЊ С„РѕСЂСѓРј.
                  </div>
                </section>
              </aside>
            </div>
          )}

          {lobby.type !== "VOICE" && relatedForums.length === 0 && relatedVoice.length === 0 ? (
            <div className="premium-panel rounded-[24px] p-4">
              <EmptyState
                title="Р­С‚РѕС‚ РєР°РЅР°Р» СЃРµР№С‡Р°СЃ СЂР°Р±РѕС‚Р°РµС‚ РєР°Рє РєРѕРЅС‚РµРєСЃС‚РЅР°СЏ С‚РѕС‡РєР°"
                description="Р¤РѕСЂСѓРјРѕРІ РёР»Рё РіРѕР»РѕСЃРѕРІС‹С… РєРѕРјРЅР°С‚ РІ СЌС‚РѕРј С…Р°Р±Рµ РїРѕРєР° РЅРµС‚, РїРѕСЌС‚РѕРјСѓ РѕСЃРЅРѕРІРЅРѕР№ РїСѓРЅРєС‚ РІС…РѕРґР° СЃРµР№С‡Р°СЃ
                РѕСЃС‚Р°С‘С‚СЃСЏ РѕР±Р·РѕСЂ С…Р°Р±Р°."
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
