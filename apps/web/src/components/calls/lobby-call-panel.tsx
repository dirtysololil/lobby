"use client";

import { callResponseSchema, callStateResponseSchema, callTokenResponseSchema, type CallStateResponse } from "@lobby/shared";
import { Phone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClientFetch } from "@/lib/api-client";
import { LiveKitCallRoom } from "./livekit-call-room";
import { useRealtime } from "../realtime/realtime-provider";

interface LobbyCallPanelProps { hubId: string; lobbyId: string; isViewerMuted: boolean; }

export function LobbyCallPanel({ hubId, lobbyId, isViewerMuted }: LobbyCallPanelProps) {
  const { socket, latestSignal } = useRealtime();
  const [state, setState] = useState<CallStateResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [connection, setConnection] = useState<{ callId: string; url: string; roomName: string; token: string; canPublishMedia: boolean; } | null>(null);

  const loadState = useCallback(async () => {
    try {
      const payload = await apiClientFetch(`/v1/calls/hubs/${hubId}/lobbies/${lobbyId}`);
      setState(callStateResponseSchema.parse(payload));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить состояние звонка");
    }
  }, [hubId, lobbyId]);

  useEffect(() => { void loadState(); }, [loadState]);

  useEffect(() => {
    if (!socket) return;
    const currentSocket = socket;
    function subscribe() { currentSocket.emit("calls.subscribe_lobby", { hubId, lobbyId }); }
    subscribe();
    currentSocket.on("connect", subscribe);
    return () => { currentSocket.off("connect", subscribe); };
  }, [socket, hubId, lobbyId]);

  useEffect(() => {
    if (latestSignal?.call.lobbyId !== lobbyId) return;
    if (["DECLINED", "ENDED", "MISSED"].includes(latestSignal.call.status)) setConnection(null);
    void loadState();
  }, [latestSignal, lobbyId, loadState]);

  async function startCall() {
    setPendingAction("start");
    try {
      const payload = await apiClientFetch(`/v1/calls/hubs/${hubId}/lobbies/${lobbyId}/start`, { method: "POST" });
      callResponseSchema.parse(payload);
      await loadState();
    } finally { setPendingAction(null); }
  }

  async function joinCall() {
    if (!state?.activeCall) return;
    setPendingAction("join");
    try {
      const payload = await apiClientFetch(`/v1/calls/${state.activeCall.id}/token`, { method: "POST" });
      const parsed = callTokenResponseSchema.parse(payload);
      setConnection(parsed.connection);
      await loadState();
    } finally { setPendingAction(null); }
  }

  async function leaveCall() {
    if (!state?.activeCall) return;
    setPendingAction("leave");
    try {
      const payload = await apiClientFetch(`/v1/calls/${state.activeCall.id}/end`, { method: "POST" });
      callResponseSchema.parse(payload);
      setConnection(null);
      await loadState();
    } finally { setPendingAction(null); }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Групповой звонок</CardTitle>
          <CardDescription>Голосовое лобби работает через LiveKit-токены, выдаваемые API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div> : null}
          {isViewerMuted ? <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">Подключение разрешено, но публикация медиа ограничена из-за мута в хабе.</div> : null}

          <div className="flex flex-wrap gap-2">
            {!state?.activeCall ? (
              <Button onClick={() => void startCall()} disabled={pendingAction !== null}><Phone className="mr-2 h-4 w-4" />{pendingAction === "start" ? "Запускаем..." : "Начать звонок"}</Button>
            ) : (
              <>
                <Button onClick={() => void joinCall()} disabled={pendingAction !== null}>{pendingAction === "join" ? "Подключаем..." : "Подключиться"}</Button>
                <Button variant="secondary" onClick={() => void leaveCall()} disabled={pendingAction !== null}>{pendingAction === "leave" ? "Завершаем..." : "Завершить"}</Button>
              </>
            )}
          </div>

          {state?.activeCall ? <div className="rounded-2xl border border-[var(--border)] bg-slate-950/45 p-4"><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-cyan-100/75">{state.activeCall.mode}</span><span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-slate-300">{state.activeCall.status}</span></div></div> : null}

          {state?.history.length ? <div className="rounded-2xl border border-[var(--border)] bg-slate-950/45 p-4"><p className="text-sm font-medium text-white">Недавние сессии</p><div className="mt-2 space-y-2 text-sm text-slate-300">{state.history.slice(0, 5).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-3 py-2"><span>{item.mode} / {item.status}</span><span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span></div>)}</div></div> : null}
        </CardContent>
      </Card>

      <LiveKitCallRoom connection={connection} mode={state?.activeCall?.mode ?? "AUDIO"} title="Активный звонок лобби" description="Управляйте микрофоном, камерой и демонстрацией экрана прямо в этом лобби." onLeave={async () => { await leaveCall(); }} />
    </div>
  );
}
