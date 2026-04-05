"use client";

import {
  callResponseSchema,
  callStateResponseSchema,
  type CallStateResponse,
  type CallSummary,
} from "@lobby/shared";
import {
  Mic,
  MicOff,
  Monitor,
  MonitorUp,
  MonitorX,
  Phone,
  PhoneCall,
  Users2,
  Video,
  VideoOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";
import { callModeLabels, callStatusLabels } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";
import { useCallSession } from "./call-session-provider";
import { LiveKitCallRoom } from "./livekit-call-room";
import { useRealtime } from "../realtime/realtime-provider";

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
  const {
    cameraEnabled,
    connectToCall,
    dismissCall,
    isActiveCall,
    leaveCall,
    microphoneEnabled,
    participants,
    screenShareEnabled,
    session,
    syncCall,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
    tracks,
  } = useCallSession();
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
  }, [conversationId, socket]);

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
  const isIncomingCall =
    activeCall?.status === "RINGING" && activeCall.initiatedBy.id !== viewerId;
  const connectedParticipants =
    activeCall?.participants.filter((participant) =>
      ["ACCEPTED", "JOINED"].includes(participant.state),
    ).length ?? 0;
  const isCurrentSession = isActiveCall(activeCall?.id ?? null);
  const canPublishMedia = Boolean(isCurrentSession && session?.connection.canPublishMedia);
  const visualTracks = useMemo(
    () => (isCurrentSession ? tracks.filter((item) => item.kind === "video") : []),
    [isCurrentSession, tracks],
  );
  const hasVisualTracks = visualTracks.length > 0;
  const hasParticipantScreenShare = participants.some((participant) => participant.hasScreenShare);
  const screenShareVisible =
    screenShareEnabled ||
    hasParticipantScreenShare ||
    visualTracks.some((item) => item.source.toLowerCase().includes("screen"));
  const showExpandedStage = Boolean(
    activeCall && isCurrentSession && (hasVisualTracks || screenShareVisible),
  );
  const expandedCallId = showExpandedStage ? activeCall?.id ?? null : null;
  const infoText = errorMessage
    ? errorMessage
    : isBlocked
      ? "Звонки недоступны в этом диалоге."
      : null;
  const infoToneClassName = errorMessage
    ? "text-rose-200"
    : isBlocked
      ? "text-amber-100"
      : "text-[var(--text-dim)]";
  const summaryLabel = !activeCall
    ? `Звонок с ${counterpartName}`
    : isIncomingCall
      ? `Входящий вызов от ${counterpartName}`
      : screenShareVisible
        ? "Показ экрана в звонке"
        : activeCall.mode === "VIDEO"
          ? "Видеозвонок"
          : "Голосовой звонок";
  const screenShareButtonLabel = screenShareEnabled ? "Остановить показ" : "Показать экран";
  const cameraButtonLabel = cameraEnabled ? "Камера" : "Включить камеру";

  return (
    <div className="grid gap-1.5">
      <div className="premium-panel rounded-[18px] px-3 py-2">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(106,168,248,0.2)] bg-[rgba(106,168,248,0.12)] text-[var(--accent-strong)]">
                {screenShareVisible ? <Monitor {...iconProps} /> : <PhoneCall {...iconProps} />}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium tracking-tight text-white">
                  {summaryLabel}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="status-pill">
                    <PhoneCall {...iconProps} />
                    {activeCall ? callStatusLabels[activeCall.status] : "Готов"}
                  </span>
                  {activeCall ? (
                    <span className="status-pill">{callModeLabels[activeCall.mode]}</span>
                  ) : null}
                  {activeCall ? (
                    <span className="status-pill">
                      <Users2 {...iconProps} />
                      {connectedParticipants}
                    </span>
                  ) : null}
                  {screenShareVisible ? (
                    <span className="status-pill">
                      <Monitor {...iconProps} />
                      Экран
                    </span>
                  ) : null}
                  {isCurrentSession && !hasVisualTracks ? (
                    <span className="status-pill">Вы в звонке</span>
                  ) : null}
                </div>

                {infoText ? (
                  <p className={cn("mt-1.5 text-sm", infoToneClassName)}>{infoText}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
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
                  {!isCurrentSession ? (
                    <Button
                      size="sm"
                      onClick={() => void joinCall()}
                      disabled={pendingAction !== null || isBlocked}
                    >
                      <PhoneCall {...iconProps} />
                      {pendingAction === "join" ? "Подключаем..." : "Подключиться"}
                    </Button>
                  ) : null}
                  {isCurrentSession ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void toggleMicrophone()}
                      disabled={pendingAction !== null || !canPublishMedia}
                    >
                      {microphoneEnabled ? (
                        <Mic {...iconProps} />
                      ) : (
                        <MicOff {...iconProps} />
                      )}
                      {microphoneEnabled ? "Микрофон" : "Без микрофона"}
                    </Button>
                  ) : null}
                  {isCurrentSession ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void toggleCamera()}
                      disabled={pendingAction !== null || !canPublishMedia}
                    >
                      {cameraEnabled ? (
                        <Video {...iconProps} />
                      ) : (
                        <VideoOff {...iconProps} />
                      )}
                      {cameraButtonLabel}
                    </Button>
                  ) : null}
                  {isCurrentSession ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void toggleScreenShare()}
                      disabled={pendingAction !== null || !canPublishMedia}
                    >
                      {screenShareEnabled ? (
                        <MonitorX {...iconProps} />
                      ) : (
                        <MonitorUp {...iconProps} />
                      )}
                      {screenShareButtonLabel}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="call-danger-button"
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
      </div>

      {expandedCallId ? (
        <LiveKitCallRoom
          callId={expandedCallId}
          title="DM stage"
          description=""
          variant="conversation"
        />
      ) : null}
    </div>
  );
}
