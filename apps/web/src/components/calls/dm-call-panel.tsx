"use client";

import {
  callResponseSchema,
  callStateResponseSchema,
  callTokenResponseSchema,
  type CallStateResponse,
} from "@lobby/shared";
import { Phone, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      currentSocket.emit("calls.subscribe_dm", {
        conversationId,
      });
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
      const payload = await apiClientFetch(
        `/v1/calls/${state.activeCall.id}/accept`,
        {
          method: "POST",
        },
      );

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
      const payload = await apiClientFetch(
        `/v1/calls/${state.activeCall.id}/decline`,
        {
          method: "POST",
        },
      );

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
      const payload = await apiClientFetch(
        `/v1/calls/${state.activeCall.id}/token`,
        {
          method: "POST",
        },
      );

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
      const payload = await apiClientFetch(
        `/v1/calls/${state.activeCall.id}/end`,
        {
          method: "POST",
        },
      );

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Звонок</CardTitle>
          <CardDescription>
            Голосовые и видеозвонки LiveKit внутри личного диалога.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {errorMessage ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          {isBlocked ? (
            <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-50">
              Звонки недоступны: один из пользователей заблокирован.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {!activeCall ? (
              <>
                <Button
                  onClick={() => void startCall("AUDIO")}
                  disabled={isBlocked || pendingAction !== null}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  {pendingAction === "start:AUDIO"
                    ? "Запуск..."
                    : "Аудиозвонок"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void startCall("VIDEO")}
                  disabled={isBlocked || pendingAction !== null}
                >
                  <Video className="mr-2 h-4 w-4" />
                  {pendingAction === "start:VIDEO"
                    ? "Запуск..."
                    : "Видеозвонок"}
                </Button>
              </>
            ) : (
              <>
                {isIncomingCall ? (
                  <>
                    <Button
                      onClick={() => void acceptCall()}
                      disabled={pendingAction !== null || isBlocked}
                    >
                      {pendingAction === "accept" ? "Принимаем..." : "Принять"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void declineCall()}
                      disabled={pendingAction !== null}
                    >
                      {pendingAction === "decline"
                        ? "Отклоняем..."
                        : "Отклонить"}
                    </Button>
                  </>
                ) : null}

                <Button
                  onClick={() => void joinCall()}
                  disabled={pendingAction !== null || isBlocked}
                >
                  {pendingAction === "join" ? "Подключаем..." : "Подключиться"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void endCall()}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === "end" ? "Завершаем..." : "Завершить"}
                </Button>
              </>
            )}
          </div>

          {activeCall ? (
            <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-5">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/10 px-3 py-1 text-[var(--text-soft)]">
                  {activeCall.mode}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
                  {activeCall.status}
                </span>
                {viewerParticipant ? (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
                    вы: {viewerParticipant.state}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {state?.history.length ? (
            <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-5">
              <p className="text-sm font-medium text-white">История звонков</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {state.history.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3"
                  >
                    <span>
                      {item.mode} / {item.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <LiveKitCallRoom
        connection={connection}
        mode={activeCall?.mode ?? "AUDIO"}
        title="Активный личный звонок"
        description="Микрофон, камера и демонстрация экрана публикуются через LiveKit внутри приватного диалога."
        onLeave={async () => {
          await endCall();
        }}
      />
    </div>
  );
}
