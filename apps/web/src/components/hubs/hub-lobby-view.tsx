import Link from "next/link";
import type { HubShell } from "@lobby/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildHubLobbyHref } from "@/lib/hub-routes";
import { LobbyCallPanel } from "@/components/calls/lobby-call-panel";

interface HubLobbyViewProps {
  hub: HubShell["hub"];
  lobbyId: string;
}

export function HubLobbyView({ hub, lobbyId }: HubLobbyViewProps) {
  const lobby = hub.lobbies.find((item) => item.id === lobbyId);

  if (!lobby) {
    return <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">Лобби недоступно с вашими текущими правами.</div>;
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{lobby.name}</CardTitle>
              <CardDescription>{lobby.description ?? "Описание лобби не задано"}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[var(--border)] px-3 py-1 text-cyan-100/75">{lobby.type}</span>
              {lobby.isPrivate ? <span className="rounded-full border border-amber-300/20 px-3 py-1 text-amber-100/80">Приватное</span> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-7 text-slate-300">
          <div className="rounded-2xl border border-[var(--border)] bg-slate-950/40 p-4">
            {lobby.type === "TEXT"
              ? "Текстовое лобби готово к обмену сообщениями внутри хаба."
              : "Голосовое лобби использует LiveKit: подключение, выход и контроль медиа в одном интерфейсе."}
          </div>

          {hub.isViewerMuted ? <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">Вы ограничены в этом хабе. Публикация контента временно отключена.</div> : null}

          {hub.lobbies.filter((item) => item.type === "FORUM").length > 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-slate-950/40 p-4">
              <p className="text-sm font-medium text-white">Форумные лобби</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {hub.lobbies.filter((item) => item.type === "FORUM").map((item) => (
                  <Link key={item.id} href={buildHubLobbyHref(hub.id, item.id, item.type)}>
                    <Button size="sm" variant="secondary">{item.name}</Button>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {lobby.type === "VOICE" ? <LobbyCallPanel hubId={hub.id} lobbyId={lobby.id} isViewerMuted={hub.isViewerMuted} /> : null}
    </div>
  );
}
