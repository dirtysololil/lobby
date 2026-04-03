import Link from "next/link";
import { Hash, LockKeyhole, MessagesSquare, Mic, Sparkles } from "lucide-react";
import type { HubShell } from "@lobby/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
        Лобби недоступно с вашими текущими правами.
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{lobby.name}</CardTitle>
              <CardDescription>
                {lobby.description ?? "Описание лобби не задано"}
              </CardDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="eyebrow-pill">
                  <Sparkles className="h-3.5 w-3.5" /> Пространство лобби
                </span>
                <span className="status-pill">
                  {lobby.type === "TEXT" ? (
                    <Hash className="h-3.5 w-3.5 text-[var(--accent)]" />
                  ) : (
                    <Mic className="h-3.5 w-3.5 text-[var(--accent)]" />
                  )}
                  {lobby.type === "TEXT"
                    ? "Текстовый режим"
                    : lobby.type === "VOICE"
                      ? "Голосовой режим"
                      : "Форумный режим"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="glass-badge">
                {lobby.type === "TEXT"
                  ? "Текст"
                  : lobby.type === "VOICE"
                    ? "Голос"
                    : "Форум"}
              </span>
              {lobby.isPrivate ? (
                <span className="glass-badge">
                  <LockKeyhole className="h-3 w-3" />
                  Приватное
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-7 text-slate-300">
          <div className="surface-highlight rounded-[26px] p-4">
            {lobby.type === "TEXT"
              ? "Текстовое лобби работает как локальная комната общения внутри хаба. Здесь должен чувствоваться контекст пространства, а не безликая лента."
              : "Голосовое лобби использует LiveKit: подключение, выход и контроль медиа собраны в единый слой звонка."}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="surface-subtle rounded-[24px] p-4">
              <div className="flex items-center gap-2 text-white">
                <MessagesSquare className="h-4 w-4 text-[var(--accent)]" />{" "}
                Контекст лобби
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Лобби — это не просто канал. Оно занимает своё место внутри
                структуры сообщества и связано с ролью участника, приватностью и
                смежными зонами.
              </p>
            </div>
            <div className="surface-subtle rounded-[24px] p-4">
              <div className="flex items-center gap-2 text-white">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" /> Соседние
                секции
              </div>
              <p className="mt-2 text-sm leading-7 text-[var(--text-dim)]">
                Если внутри хаба есть форумные зоны, они доступны как связанные
                пространства для более длинных обсуждений.
              </p>
            </div>
          </div>

          {hub.isViewerMuted ? (
            <div className="rounded-[22px] border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
              Вы ограничены в этом хабе. Публикация контента временно отключена.
            </div>
          ) : null}

          {hub.lobbies.filter((item) => item.type === "FORUM").length > 0 ? (
            <div className="surface-subtle rounded-[24px] p-4">
              <p className="text-sm font-medium text-white">Форумные лобби</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {hub.lobbies
                  .filter((item) => item.type === "FORUM")
                  .map((item) => (
                    <Link
                      key={item.id}
                      href={buildHubLobbyHref(hub.id, item.id, item.type)}
                    >
                      <Button size="sm" variant="secondary">
                        {item.name}
                      </Button>
                    </Link>
                  ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {lobby.type === "VOICE" ? (
        <LobbyCallPanel
          hubId={hub.id}
          lobbyId={lobby.id}
          isViewerMuted={hub.isViewerMuted}
        />
      ) : null}
    </div>
  );
}
