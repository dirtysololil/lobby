"use client";

import {
  callResponseSchema,
  callStateResponseSchema,
  type CallStateResponse,
  type CallSummary,
} from "@lobby/shared";
import { Phone, PhoneCall, Users2, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";
import {
  callModeLabels,
  callParticipantStateLabels,
  callStatusLabels,
} from "@/lib/ui-labels";
import { LiveKitCallRoom } from "./livekit-call-room";
import { useRealtime } from "../realtime/realtime-provider";
import { useCallSession } from "./call-session-provider";

interface DmCallPanelProps {
  conversationId: string;
  viewerId: string;
  isBlocked: boolean;
  counterpartName: string;
  counterpartUsername: string;
}

const iconProps = { size: 16, strokeWidth: 1.5 } as const;

export function DmCallPanel({
  conversationId,
  viewerId,
  isBlocked,
  counterpartName,
  counterpartUsername,
}: DmCallPanelProps) {
  const { socket, latestSignal, clearIncomingCall } = useRealtime();
  const { connectToCall, dismissCall, isActiveCall, leaveCall, syncCall } =
    useCallSession();
  const [state, setState] = useState<CallStateResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const callRoute = `/app/messages/${conversationId}`;
  const callTitle = `Звонок с ${counterpartName}`;
  const callSubtitle = `ЛС · @${counterpartUsername}`;

  const connectToResolvedCall = useCallback(
    async (call: CallSummary) => {
      await connectToCall({
        callId: call.id,
        scope: "DM",
        route: callRoute,
        title: callTitle,
        subtitle: callSubtitle,
        call,
      });
    },
    [callRoute, callSubtitle, callTitle, connectToCall],
  );

  const loadState = useCallback(async () => {
    try {
      const payload = await apiClientFetch(`/v1/calls/dm/${conversationId}`);
      const parsed = callStateResponseSchema.parse(payload);
      setState(parsed);
      if (parsed.activeCall) {
        syncCall(parsed.activeCall, {
          route: callRoute,
          title: callTitle,
          subtitle: callSubtitle,
        });
      }
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить состояние звонка.",
      );
    }
  }, [callRoute, callSubtitle, callTitle, conversationId, syncCall]);

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
      dismissCall(latestSignal.call.id);
      clearIncomingCall(latestSignal.call.id);
    }

    void loadState();
  }, [clearIncomingCall, conversationId, dismissCall, latestSignal, loadState]);

  useEffect(() => {
    const activeCall = state?.activeCall;
    const viewerParticipant = activeCall?.participants.find(
      (participant) => participant.user.id === viewerId,
    );

    if (
      !activeCall ||
      pendingAction ||
      isBlocked ||
      isActiveCall(activeCall.id) ||
      activeCall.status !== "ACCEPTED" ||
      !viewerParticipant ||
      !["ACCEPTED", "JOINED"].includes(viewerParticipant.state)
    ) {
      return;
    }

    void connectToResolvedCall(activeCall).catch(() => undefined);
  }, [
    connectToResolvedCall,
    isActiveCall,
    isBlocked,
    pendingAction,
    state?.activeCall,
    viewerId,
  ]);

  async function startCall(mode: "AUDIO" | "VIDEO") {
    setPendingAction(`start:${mode}`);

    try {
      const payload = await apiClientFetch(`/v1/calls/dm/${conversationId}/start`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });

      const parsed = callResponseSchema.parse(payload);
      await connectToResolvedCall(parsed.call);
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

      const parsed = callResponseSchema.parse(payload);
      await connectToResolvedCall(parsed.call);
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
      dismissCall(state.activeCall.id);
      clearIncomingCall(state.activeCall.id);
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
      await connectToResolvedCall(state.activeCall);
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
      await leaveCall(state.activeCall.id);
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
  const connectedParticipants =
    activeCall?.participants.filter((participant) =>
      ["ACCEPTED", "JOINED"].includes(participant.state),
    ).length ?? 0;
  const isCurrentSession = isActiveCall(activeCall?.id ?? null);
  const metrics = useMemo(
    () => [
      {
        label: "Сеанс",
        value: activeCall ? "Уже открыт" : "Готов к старту",
      },
      {
        label: "Участники",
        value: `${connectedParticipants} на связи`,
      },
      {
        label: "История",
        value: `${state?.history.length ?? 0} вызовов`,
      },
    ],
    [activeCall, connectedParticipants, state?.history.length],
  );

  return (
    <div className="grid gap-2.5">
      <div className="premium-panel rounded-[20px] p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="eyebrow-pill">Личный звонок</span>
              <span className="status-pill">
                <PhoneCall {...iconProps} />
                {activeCall ? callStatusLabels[activeCall.status] : "Готов"}
              </span>
              {activeCall ? (
                <span className="status-pill">{callModeLabels[activeCall.mode]}</span>
              ) : null}
              {viewerParticipant ? (
                <span className="status-pill">
                  Вы: {callParticipantStateLabels[viewerParticipant.state]}
                </span>
              ) : null}
              {isCurrentSession ? <span className="status-pill">Закреплён</span> : null}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="surface-subtle rounded-[16px] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">{metric.value}</p>
                </div>
              ))}
            </div>

            {errorMessage ? <p className="mt-2 text-sm text-rose-200">{errorMessage}</p> : null}
            {!errorMessage && isBlocked ? (
              <p className="mt-2 text-sm text-amber-100">
                Звонки недоступны в этом диалоге.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 rounded-[18px] border border-white/6 bg-white/[0.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            {!activeCall ? (
              <>
                <Button
                  size="sm"
                  onClick={() => void startCall("AUDIO")}
                  disabled={isBlocked || pendingAction !== null}
                >
                  <Phone {...iconProps} />
                  {pendingAction === "start:AUDIO" ? "Запускаем..." : "Голос"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void startCall("VIDEO")}
                  disabled={isBlocked || pendingAction !== null}
                >
                  <Video {...iconProps} />
                  {pendingAction === "start:VIDEO" ? "Запускаем..." : "Видео"}
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
                  <Users2 {...iconProps} />
                  {pendingAction === "join"
                    ? "Подключаем..."
                    : isCurrentSession
                      ? "Вернуться в комнату"
                      : "Подключиться"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void endCall()}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === "end" ? "Завершаем..." : "Выйти"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <LiveKitCallRoom
        callId={activeCall?.id ?? null}
        title="Комната ЛС"
        description="Сеанс остаётся активным во всём приложении и не рвётся при навигации."
      />
    </div>
  );
}
