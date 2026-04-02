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
    return (
      <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-50">
        Lobby is not accessible for your current permissions.
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{lobby.name}</CardTitle>
              <CardDescription>{lobby.description ?? "No lobby description yet."}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/10 px-3 py-1 text-sky-200/70">{lobby.type}</span>
              {lobby.isPrivate ? (
                <span className="rounded-full border border-amber-300/20 px-3 py-1 text-amber-100/80">private</span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-7 text-slate-300">
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
            {lobby.type === "TEXT"
              ? "Text lobby shell is ready. Channel messaging can be attached later without changing hub roles or privacy rules."
              : "Voice lobby now exposes LiveKit-powered group calls, with join, leave, mute, camera and screen sharing controls below."}
          </div>

          {hub.isViewerMuted ? (
            <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-50">
              You are muted in this hub. Posting actions are disabled until unmuted.
            </div>
          ) : null}

          {hub.lobbies.filter((item) => item.type === "FORUM").length > 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <p className="text-sm font-medium text-white">Forum lobbies</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {hub.lobbies
                  .filter((item) => item.type === "FORUM")
                  .map((item) => (
                    <Link key={item.id} href={buildHubLobbyHref(hub.id, item.id, item.type)}>
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
        <LobbyCallPanel hubId={hub.id} lobbyId={lobby.id} isViewerMuted={hub.isViewerMuted} />
      ) : null}
    </div>
  );
}
