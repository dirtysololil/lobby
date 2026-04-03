"use client";

import {
  callResponseSchema,
  callStateResponseSchema,
  callTokenResponseSchema,
  type CallStateResponse,
} from "@lobby/shared";
import { Phone } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";
import { LiveKitCallRoom } from "./livekit-call-room";
import { useRealtime } from "../realtime/realtime-provider";

interface LobbyCallPanelProps {
  hubId: string;
  lobbyId: string;
  isViewerMuted: boolean;
}

export function LobbyCallPanel({
  hubId,
  lobbyId,
  isViewerMuted,
}: LobbyCallPanelProps) {
  const { socket, latestSignal } = useRealtime();
  const [state, setState] = useState<CallStateResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [connection, setConnection] = useState<{
    callId: string;
    url: string;
    roomName: string;
    token: string;
    canPublishMedia: boolean;
  } | null>(null);

  const loadState = useCallback(async () => {
    try {
      const payload = await apiClientFetch(`/v1/calls/hubs/${hubId}/lobbies/${lobbyId}`);
      setState(callStateResponseSchema.parse(payload));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить звонок",
      );
    }
  }, [hubId, lobbyId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const currentSocket = socket;

    function subscribe() {
      currentSocket.emit("calls.subscribe_lobby", { hubId, lobbyId });
    }

    subscribe();
    currentSocket.on("connect", subscribe);

    return () => {
      currentSocket.off("connect", subscribe);
    };
  }, [socket, hubId, lobbyId]);

  useEffect(() => {
    if (latestSignal?.call.lobbyId !== lobbyId) {
      return;
    }

    if (["DECLINED", "ENDED", "MISSED"].includes(latestSignal.call.status)) {
      setConnection(null);
    }

    void loadState();
  }, [latestSignal, lobbyId, loadState]);

  async function startCall() {
    setPendingAction("start");

    try {
      const payload = await apiClientFetch(
        `/v1/calls/hubs/${hubId}/lobbies/${lobbyId}/start`,
        { method: "POST" },
      );

      callResponseSchema.parse(payload);
      await loadState();
    } finally {
      setPendingAction(null);
    }
  }

  async function joinCall() {
    if (!state?.activeCall) {
      return;
    }

    setPendingAction("join");

    try {
      const payload = await apiClientFetch(`/v1/calls/${state.activeCall.id}/token`, {
        method: "POST",
      });

      const parsed = callTokenResponseSchema.parse(payload);
      setConnection(parsed.connection);
      await loadState();
    } finally {
      setPendingAction(null);
    }
  }

  async function leaveCall() {
    if (!state?.activeCall) {
      return;
    }

    setPendingAction("leave");

    try {
      const payload = await apiClientFetch(`/v1/calls/${state.activeCall.id}/end`, {
        method: "POST",
      });

      callResponseSchema.parse(payload);
      setConnection(null);
      await loadState();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-[18px] border border-[var(--border)] bg-white/[0.03] px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">Voice lobby</span>
              <span className="status-pill">
                {state?.activeCall ? state.activeCall.status : "Ready"}
              </span>
            </div>
            {errorMessage ? (
              <p className="mt-2 text-sm text-rose-200">{errorMessage}</p>
            ) : isViewerMuted ? (
              <p className="mt-2 text-sm text-amber-100">
                Вы можете слушать, но публикация медиа ограничена.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {!state?.activeCall ? (
              <Button size="sm" onClick={() => void startCall()} disabled={pendingAction !== null}>
                <Phone className="h-4 w-4" />
                {pendingAction === "start" ? "Запускаем..." : "Начать"}
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={() => void joinCall()} disabled={pendingAction !== null}>
                  {pendingAction === "join" ? "Подключаем..." : "Подключиться"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void leaveCall()}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === "leave" ? "Завершаем..." : "Завершить"}
                </Button>
              </>
            )}
          </div>
        </div>

        {state?.history.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {state.history.slice(0, 4).map((item) => (
              <span key={item.id} className="glass-badge">
                {item.mode} · {item.status}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <LiveKitCallRoom
        connection={connection}
        mode={state?.activeCall?.mode ?? "AUDIO"}
        title="Активный звонок лобби"
        description="Групповой разговор внутри канала."
        onLeave={async () => {
          await leaveCall();
        }}
      />
    </div>
  );
}
