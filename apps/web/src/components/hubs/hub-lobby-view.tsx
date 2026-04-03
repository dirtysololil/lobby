import Link from "next/link";
import { Hash, LockKeyhole, Mic, Waves } from "lucide-react";
import type { HubShell } from "@lobby/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { buildHubLobbyHref } from "@/lib/hub-routes";
import { LobbyCallPanel } from "@/components/calls/lobby-call-panel";

interface HubLobbyViewProps {
  hub: HubShell["hub"];
  lobbyId: string;
}

export function HubLobbyView({ hub, lobbyId }: HubLobbyViewProps) {
  const lobby = hub.lobbies.find((item) => item.id === lobbyId);

  if (!lobby) {
    return (
      <div className="rounded-[16px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
        Лобби недоступно с вашими текущими правами.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="social-shell rounded-[24px] p-4">
        <div className="compact-toolbar">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                {lobby.type === "VOICE" ? (
                  <Mic className="h-3.5 w-3.5" />
                ) : (
                  <Hash className="h-3.5 w-3.5" />
                )}
                {lobby.type === "VOICE" ? "Voice" : "Channel"}
              </span>
              <span className="status-pill">{lobby.type}</span>
              {lobby.isPrivate ? (
                <span className="status-pill">
                  <LockKeyhole className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Private
                </span>
              ) : null}
            </div>
            <h1 className="mt-2 font-[var(--font-heading)] text-[1.45rem] font-semibold tracking-[-0.04em] text-white">
              {lobby.name}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--text-dim)]">
              {lobby.description ?? "Описание лобби не задано."}
            </p>
          </div>
        </div>
      </div>

      {hub.isViewerMuted ? (
        <div className="rounded-[16px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
          Вы ограничены в этом хабе. Часть активных действий может быть недоступна.
        </div>
      ) : null}

      {lobby.type === "VOICE" ? (
        <LobbyCallPanel
          hubId={hub.id}
          lobbyId={lobby.id}
          isViewerMuted={hub.isViewerMuted}
        />
      ) : (
        <div className="premium-panel rounded-[24px] p-4">
          <EmptyState
            title="Текстовый канал готов"
            description="В этом режиме у продукта пока нет отдельного feed API, поэтому экран сфокусирован на структуре пространства и быстрых переходах."
          />
        </div>
      )}

      {hub.lobbies.filter((item) => item.type === "FORUM").length > 0 ? (
        <div className="premium-panel rounded-[24px] p-4">
          <div className="compact-toolbar">
            <div>
              <p className="section-kicker">Related forums</p>
              <p className="mt-2 text-sm text-[var(--text-dim)]">
                Длинные обсуждения лучше переносить в форумные каналы.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {hub.lobbies
              .filter((item) => item.type === "FORUM")
              .map((item) => (
                <Link
                  key={item.id}
                  href={buildHubLobbyHref(hub.id, item.id, item.type)}
                >
                  <Button size="sm" variant="secondary">
                    <Waves className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
