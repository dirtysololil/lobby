"use client";

import {
  callResponseSchema,
  callStateResponseSchema,
  type CallStateResponse,
  type CallSummary,
} from "@lobby/shared";
import { Mic, MicOff, Phone, PhoneCall, Users2, Video } from "lucide-react";
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
  const {
    connectToCall,
    dismissCall,
    isActiveCall,
    leaveCall,
    syncCall,
    tracks,
    microphoneEnabled,
    toggleMicrophone,
  } = useCallSession();
  const [state, setState] = useState<CallStateResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showExpandedCallView, setShowExpandedCallView] = useState(false);

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
  const visualTracks = useMemo(
    () =>
      isCurrentSession
        ? tracks.filter((item) => item.kind === "video")
        : [],
    [isCurrentSession, tracks],
  );
  const hasVisualTracks = visualTracks.length > 0;
  const canToggleExpandedStage = isCurrentSession && !hasVisualTracks;
  const showExpandedStage = Boolean(
    activeCall && isCurrentSession && (hasVisualTracks || showExpandedCallView),
  );
  const expandedCallId = showExpandedStage ? activeCall?.id ?? null : null;
  const participantPreview = useMemo(() => {
    if (!activeCall) {
      return null;
    }

    const names = activeCall.participants
      .filter((participant) => ["ACCEPTED", "JOINED"].includes(participant.state))
      .map((participant) => participant.user.profile.displayName)
      .slice(0, 3);

    if (names.length === 0) {
      return null;
    }

    return names.join(", ");
  }, [activeCall]);
  const summaryText = activeCall
    ? showExpandedStage
      ? "Сцена открыта, чат остается главным контентом ниже."
      : hasVisualTracks
        ? "Видео или screen-share активны, сцену можно открыть без потери чата."
        : "Аудиозвонок остается компактным и не вытесняет переписку."
    : "Запуск звонка не забирает экран у переписки.";

  useEffect(() => {
    setShowExpandedCallView(false);
  }, [activeCall?.id]);

  useEffect(() => {
    if (!activeCall || !isCurrentSession) {
      setShowExpandedCallView(false);
    }
  }, [activeCall, isCurrentSession]);

  return (
    <div className="grid gap-2">
      <div className="premium-panel rounded-[18px] px-3 py-2.5">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
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
                {activeCall ? (
                  <span className="status-pill">
                    <Users2 {...iconProps} />
                    {connectedParticipants}
                  </span>
                ) : null}
                {isCurrentSession ? <span className="status-pill">Закреплен</span> : null}
              </div>

              <p className="mt-1.5 text-sm text-[var(--text-dim)]">
                {participantPreview ? `${participantPreview}. ` : null}
                {summaryText}
              </p>

              {errorMessage ? <p className="mt-2 text-sm text-rose-200">{errorMessage}</p> : null}
              {!errorMessage && isBlocked ? (
                <p className="mt-2 text-sm text-amber-100">
                  Звонки недоступны в этом диалоге.
                </p>
              ) : null}
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
                  <Button
                    size="sm"
                    onClick={() => {
                      if (canToggleExpandedStage) {
                        setShowExpandedCallView((value) => !value);
                        return;
                      }

                      if (!isCurrentSession) {
                        void joinCall();
                      }
                    }}
                    disabled={
                      pendingAction !== null ||
                      isBlocked ||
                      (isCurrentSession && hasVisualTracks)
                    }
                  >
                    <PhoneCall {...iconProps} />
                    {pendingAction === "join"
                      ? "Подключаем..."
                      : isCurrentSession
                        ? hasVisualTracks
                          ? "Комната открыта"
                          : showExpandedStage
                            ? "Свернуть комнату"
                            : "Открыть комнату"
                        : "Подключиться"}
                  </Button>
                  {isCurrentSession ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void toggleMicrophone()}
                      disabled={pendingAction !== null}
                    >
                      {microphoneEnabled ? (
                        <Mic {...iconProps} />
                      ) : (
                        <MicOff {...iconProps} />
                      )}
                      {microphoneEnabled ? "Выключить микрофон" : "Включить микрофон"}
                    </Button>
                  ) : null}
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
      </div>

      {expandedCallId ? (
        <LiveKitCallRoom
          callId={expandedCallId}
          title="Комната ЛС"
          description="Сцена раскрывается только когда это действительно нужно и не отнимает экран у переписки."
          variant="conversation"
        />
      ) : null}
    </div>
  );
}
