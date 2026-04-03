"use client";

import {
  callResponseSchema,
  callStateResponseSchema,
  callTokenResponseSchema,
  type CallStateResponse,
} from "@lobby/shared";
import { Phone, PhoneCall, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";
import { LiveKitCallRoom } from "./livekit-call-room";
import { useRealtime } from "../realtime/realtime-provider";

interface DmCallPanelProps {
  conversationId: string;
  viewerId: string;
  isBlocked: boolean;
}

export function DmCallPanel({
  conversationId,
  viewerId,
  isBlocked,
}: DmCallPanelProps) {
  const { socket, latestSignal, clearIncomingCall } = useRealtime();
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
      const payload = await apiClientFetch(`/v1/calls/dm/${conversationId}`);
      setState(callStateResponseSchema.parse(payload));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить состояние звонка",
      );
    }
  }, [conversationId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const currentSocket = socket;

    function subscribe() {
      currentSocket.emit("calls.subscribe_dm", { conversationId });
    }

    subscribe();
    currentSocket.on("connect", subscribe);

    return () => {
      currentSocket.off("connect", subscribe);
    };
  }, [socket, conversationId]);

  useEffect(() => {
    if (latestSignal?.call.dmConversationId !== conversationId) {
      return;
    }

    if (["DECLINED", "ENDED", "MISSED"].includes(latestSignal.call.status)) {
      setConnection(null);
      clearIncomingCall(latestSignal.call.id);
    }

    void loadState();
  }, [latestSignal, conversationId, clearIncomingCall, loadState]);

  async function startCall(mode: "AUDIO" | "VIDEO") {
    setPendingAction(`start:${mode}`);

    try {
      const payload = await apiClientFetch(
        `/v1/calls/dm/${conversationId}/start`,
        {
          method: "POST",
          body: JSON.stringify({ mode }),
        },
      );

      callResponseSchema.parse(payload);
      await loadState();
    } finally {
      setPendingAction(null);
    }
  }

  async function acceptCall() {
    if (!state?.activeCall) {
      return;
    }

    setPendingAction("accept");

    try {
      const payload = await apiClientFetch(`/v1/calls/${state.activeCall.id}/accept`, {
        method: "POST",
      });

      callResponseSchema.parse(payload);
      clearIncomingCall(state.activeCall.id);
      await loadState();
    } finally {
      setPendingAction(null);
    }
  }

  async function declineCall() {
    if (!state?.activeCall) {
      return;
    }

    setPendingAction("decline");

    try {
      const payload = await apiClientFetch(`/v1/calls/${state.activeCall.id}/decline`, {
        method: "POST",
      });

      callResponseSchema.parse(payload);
      clearIncomingCall(state.activeCall.id);
      setConnection(null);
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

  async function endCall() {
    if (!state?.activeCall) {
      return;
    }

    setPendingAction("end");

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

  const activeCall = state?.activeCall ?? null;
  const viewerParticipant =
    activeCall?.participants.find(
      (participant) => participant.user.id === viewerId,
    ) ?? null;
  const isIncomingCall =
    activeCall?.status === "RINGING" && activeCall.initiatedBy.id !== viewerId;

  return (
    <div className="grid gap-3">
      <div className="rounded-[18px] border border-[var(--border)] bg-white/[0.03] px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow-pill">
                <PhoneCall className="h-3.5 w-3.5" />
                Call
              </span>
              {activeCall ? (
                <span className="status-pill">{activeCall.status}</span>
              ) : (
                <span className="status-pill">Ready</span>
              )}
              {viewerParticipant ? (
                <span className="status-pill">you: {viewerParticipant.state}</span>
              ) : null}
            </div>
            {errorMessage ? (
              <p className="mt-2 text-sm text-rose-200">{errorMessage}</p>
            ) : isBlocked ? (
              <p className="mt-2 text-sm text-amber-100">
                Звонки недоступны из-за блокировки.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {!activeCall ? (
              <>
                <Button
                  size="sm"
                  onClick={() => void startCall("AUDIO")}
                  disabled={isBlocked || pendingAction !== null}
                >
                  <Phone className="h-4 w-4" />
                  {pendingAction === "start:AUDIO" ? "Запуск..." : "Audio"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void startCall("VIDEO")}
                  disabled={isBlocked || pendingAction !== null}
                >
                  <Video className="h-4 w-4" />
                  {pendingAction === "start:VIDEO" ? "Запуск..." : "Video"}
                </Button>
              </>
            ) : isIncomingCall ? (
              <>
                <Button
                  size="sm"
                  onClick={() => void acceptCall()}
                  disabled={pendingAction !== null || isBlocked}
                >
                  {pendingAction === "accept" ? "Принимаем..." : "Принять"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void declineCall()}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === "decline" ? "Отклоняем..." : "Отклонить"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={() => void joinCall()}
                  disabled={pendingAction !== null || isBlocked}
                >
                  {pendingAction === "join" ? "Подключаем..." : "Подключиться"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void endCall()}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === "end" ? "Завершаем..." : "Завершить"}
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
        mode={activeCall?.mode ?? "AUDIO"}
        title="Активный звонок"
        description="Управление микрофоном, камерой и экраном без выхода из диалога."
        onLeave={async () => {
          await endCall();
        }}
      />
    </div>
  );
}
