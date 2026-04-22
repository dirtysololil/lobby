"use client";

import {
  callResponseSchema,
  callStateResponseSchema,
  type CallStateResponse,
  type CallSummary,
} from "@lobby/shared";
import {
  Maximize2,
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
import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { apiClientFetch } from "@/lib/api-client";
import {
  getAudioContextCtor,
  playToneSequence,
  type ToneSequencePlayback,
} from "@/lib/tone-sequence";
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
  counterpartAvailabilityLabel: string | null;
  counterpartIsOnline: boolean;
  variant?: "panel" | "header";
  stageHostRef?: RefObject<HTMLDivElement | null>;
}

const iconProps = { size: 16, strokeWidth: 1.5 } as const;
const dmCallModeLabels = {
  AUDIO: "Звонок",
  VIDEO: "Видео",
} as const;
const outgoingCallRingbackLoopMs = 5_000;
const outgoingCallRingbackGain = 0.038;
const outgoingCallRingbackSequence = [
  {
    duration: 3,
    frequency: 425,
    gain: outgoingCallRingbackGain,
    type: "sine",
  },
] as const;

export function DmCallPanel({
  conversationId,
  viewerId,
  isBlocked,
  counterpartName,
  counterpartUsername,
  counterpartAvailabilityLabel,
  counterpartIsOnline,
  variant = "panel",
  stageHostRef,
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
    status,
    syncCall,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
    tracks,
  } = useCallSession();
  const [state, setState] = useState<CallStateResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const loadRequestIdRef = useRef(0);
  const stageShellRef = useRef<HTMLDivElement | null>(null);
  const ringbackAudioContextRef = useRef<AudioContext | null>(null);
  const ringbackPlaybackRef = useRef<ToneSequencePlayback | null>(null);
  const ringbackIntervalRef = useRef<number | null>(null);
  const ringbackCallIdRef = useRef<string | null>(null);

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

  const stopOutgoingRingback = useCallback(() => {
    if (ringbackIntervalRef.current !== null) {
      window.clearInterval(ringbackIntervalRef.current);
      ringbackIntervalRef.current = null;
    }

    ringbackPlaybackRef.current?.stop();
    ringbackPlaybackRef.current = null;
    ringbackCallIdRef.current = null;
  }, []);

  const ensureRingbackAudioContext = useCallback(async () => {
    const AudioContextCtor = getAudioContextCtor();

    if (!AudioContextCtor) {
      return null;
    }

    let audioContext = ringbackAudioContextRef.current;

    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContextCtor();
      ringbackAudioContextRef.current = audioContext;
    }

    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch {
        return null;
      }
    }

    return audioContext.state === "running" ? audioContext : null;
  }, []);

  const primeOutgoingRingbackAudio = useCallback(async () => {
    await ensureRingbackAudioContext();
  }, [ensureRingbackAudioContext]);

  const startOutgoingRingback = useCallback(
    async (callId: string) => {
      if (ringbackCallIdRef.current === callId) {
        return;
      }

      stopOutgoingRingback();

      const audioContext = await ensureRingbackAudioContext();

      if (!audioContext) {
        return;
      }

      const playBurst = () => {
        ringbackPlaybackRef.current?.stop();
        ringbackPlaybackRef.current = playToneSequence(
          audioContext,
          [...outgoingCallRingbackSequence],
          { defaultGain: outgoingCallRingbackGain },
        );
      };

      playBurst();
      ringbackCallIdRef.current = callId;
      ringbackIntervalRef.current = window.setInterval(
        playBurst,
        outgoingCallRingbackLoopMs,
      );
    },
    [ensureRingbackAudioContext, stopOutgoingRingback],
  );

  const loadState = useCallback(async (): Promise<CallStateResponse | null> => {
    const requestId = ++loadRequestIdRef.current;

    try {
      const payload = await apiClientFetch(`/v1/calls/dm/${conversationId}`);
      const parsed = callStateResponseSchema.parse(payload);

      if (requestId !== loadRequestIdRef.current) {
        return null;
      }

      setState(parsed);

      if (parsed.activeCall) {
        syncCall(parsed.activeCall, {
          route: callRoute,
          title: callTitle,
          subtitle: callSubtitle,
        });
      }

      setErrorMessage(null);
      return parsed;
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) {
        return null;
      }

      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить состояние звонка.",
      );
      return null;
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

    if (
      latestSignal.call.initiatedBy.id === viewerId &&
      latestSignal.call.status !== "RINGING"
    ) {
      stopOutgoingRingback();
    }

    if (["DECLINED", "ENDED", "MISSED"].includes(latestSignal.call.status)) {
      dismissCall(latestSignal.call.id);
      clearIncomingCall(latestSignal.call.id);
    }

    void loadState();
  }, [
    clearIncomingCall,
    conversationId,
    dismissCall,
    latestSignal,
    loadState,
    stopOutgoingRingback,
    viewerId,
  ]);

  const sessionCall = useMemo(
    () => (session?.call.dmConversationId === conversationId ? session.call : null),
    [conversationId, session?.call],
  );
  const activeCall = state?.activeCall ?? sessionCall ?? null;
  const isIncomingCall =
    activeCall?.status === "RINGING" && activeCall.initiatedBy.id !== viewerId;
  const isOutgoingRingingCall =
    activeCall?.status === "RINGING" && activeCall.initiatedBy.id === viewerId;
  const isCurrentSession = isActiveCall(activeCall?.id ?? null);
  const isJoiningCurrentSession =
    isCurrentSession && ["connecting", "reconnecting"].includes(status);
  const viewerParticipant =
    activeCall?.participants.find((participant) => participant.user.id === viewerId) ?? null;
  const connectedParticipants =
    activeCall?.participants.filter((participant) =>
      ["ACCEPTED", "JOINED"].includes(participant.state),
    ).length ?? 0;
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

  useEffect(() => {
    if (
      !activeCall ||
      pendingAction ||
      isBlocked ||
      isCurrentSession ||
      activeCall.status !== "ACCEPTED" ||
      !viewerParticipant ||
      !["ACCEPTED", "JOINED"].includes(viewerParticipant.state)
    ) {
      return;
    }

    void connectToResolvedCall(activeCall).catch(() => undefined);
  }, [
    activeCall,
    connectToResolvedCall,
    isBlocked,
    isCurrentSession,
    pendingAction,
    viewerParticipant,
  ]);

  useEffect(() => {
    if (!activeCall?.id || !isOutgoingRingingCall) {
      stopOutgoingRingback();
      return;
    }

    void startOutgoingRingback(activeCall.id);
  }, [
    activeCall?.id,
    isOutgoingRingingCall,
    startOutgoingRingback,
    stopOutgoingRingback,
  ]);

  async function startCall(mode: "AUDIO" | "VIDEO") {
    setPendingAction(`start:${mode}`);
    void primeOutgoingRingbackAudio();

    try {
      const payload = await apiClientFetch(`/v1/calls/dm/${conversationId}/start`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });

      const parsed = callResponseSchema.parse(payload);
      setState((current) => ({
        activeCall: parsed.call,
        history: current?.history ?? [],
      }));
      await connectToResolvedCall(parsed.call);
      await loadState();
      setErrorMessage(null);
    } catch (error) {
      stopOutgoingRingback();
      const recoveredState = await loadState();
      const recoveredCall = recoveredState?.activeCall ?? null;

      if (recoveredCall) {
        try {
          await connectToResolvedCall(recoveredCall);
          setErrorMessage(null);
          return;
        } catch {
          // Keep the original error handling below if recovery could not reconnect.
        }
      }

      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось запустить звонок.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function acceptCall() {
    if (!activeCall) {
      return;
    }

    setPendingAction("accept");

    try {
      const payload = await apiClientFetch(`/v1/calls/${activeCall.id}/accept`, {
        method: "POST",
      });

      const parsed = callResponseSchema.parse(payload);
      setState((current) => ({
        activeCall: parsed.call,
        history: current?.history ?? [],
      }));
      await connectToResolvedCall(parsed.call);
      clearIncomingCall(activeCall.id);
      await loadState();
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось принять звонок.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function declineCall() {
    if (!activeCall) {
      return;
    }

    setPendingAction("decline");
    stopOutgoingRingback();

    try {
      const payload = await apiClientFetch(`/v1/calls/${activeCall.id}/decline`, {
        method: "POST",
      });

      callResponseSchema.parse(payload);
      dismissCall(activeCall.id);
      clearIncomingCall(activeCall.id);
      setState((current) =>
        current
          ? {
              ...current,
              activeCall: null,
            }
          : current,
      );
      await loadState();
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось отклонить звонок.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function joinCall() {
    if (!activeCall) {
      return;
    }

    setPendingAction("join");

    try {
      await connectToResolvedCall(activeCall);
      await loadState();
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось открыть звонок.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function endCall() {
    if (!activeCall) {
      return;
    }

    setPendingAction("end");
    stopOutgoingRingback();

    try {
      await leaveCall(activeCall.id);
      setState((current) =>
        current
          ? {
              ...current,
              activeCall: null,
            }
          : current,
      );
      await loadState();
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось завершить звонок.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function openStageFullscreen() {
    const element = stageShellRef.current;

    if (!element || typeof element.requestFullscreen !== "function") {
      return;
    }

    try {
      await element.requestFullscreen();
    } catch {
      // Ignore fullscreen failures triggered by browser restrictions.
    }
  }

  const readinessLabel = isBlocked
    ? "Звонки недоступны"
    : activeCall
      ? isIncomingCall
        ? "Входящий звонок"
        : isCurrentSession
          ? isJoiningCurrentSession
            ? "Подключаем..."
            : "Вы в звонке"
          : "Идёт звонок"
      : counterpartIsOnline
        ? "Можно позвонить"
        : "Не в сети";
  const readinessToneClassName = isBlocked
    ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
    : activeCall
      ? isCurrentSession
        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
        : "border-[rgba(106,168,248,0.22)] bg-[rgba(106,168,248,0.12)] text-[var(--accent-strong)]"
      : counterpartIsOnline
        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
        : "text-[var(--text-muted)]";
  const secondaryLabel =
    !activeCall &&
    !counterpartIsOnline &&
    counterpartAvailabilityLabel &&
    counterpartAvailabilityLabel !== "Не в сети"
      ? counterpartAvailabilityLabel
      : null;
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
  const summaryLabel =
    activeCall?.mode === "VIDEO"
      ? "Видеозвонок"
      : screenShareVisible
        ? "Звонок с экраном"
        : "Звонок";
  const screenShareButtonLabel = screenShareEnabled ? "Остановить показ" : "Показать экран";
  const cameraButtonLabel = cameraEnabled ? "Камера" : "Включить камеру";
  const canStopOwnScreenShare = Boolean(
    isCurrentSession && screenShareEnabled && canPublishMedia,
  );
  const stageMarkup =
    mounted && stageHostRef?.current && expandedCallId
      ? createPortal(
          <div ref={stageShellRef} className="mt-2 border-t border-white/6 px-3 pb-3 pt-2">
            {screenShareVisible ? (
              <div className="dm-screen-share-strip mb-2">
                <button type="button" className="dm-screen-share-chip dm-screen-share-chip-active" disabled>
                  <Monitor {...iconProps} />
                  Р’ РґРёР°Р»РѕРіРµ
                </button>
                <button
                  type="button"
                  className="dm-screen-share-chip"
                  onClick={() => void openStageFullscreen()}
                >
                  <Maximize2 {...iconProps} />
                  РќР° РІРµСЃСЊ СЌРєСЂР°РЅ
                </button>
                {canStopOwnScreenShare ? (
                  <button
                    type="button"
                    className="dm-screen-share-chip dm-screen-share-chip-danger"
                    onClick={() => void toggleScreenShare()}
                  >
                    <MonitorX {...iconProps} />
                    РћСЃС‚Р°РЅРѕРІРёС‚СЊ РїРѕРєР°Р·
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="overflow-hidden rounded-[22px] border border-white/6 bg-[rgba(8,12,18,0.82)] shadow-[0_20px_42px_rgba(4,8,16,0.22)]">
              <LiveKitCallRoom
                callId={expandedCallId}
                title="DM stage"
                description=""
                variant="conversation"
              />
            </div>
          </div>,
          stageHostRef.current,
        )
      : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      stopOutgoingRingback();
      const audioContext = ringbackAudioContextRef.current;
      ringbackAudioContextRef.current = null;
      void audioContext?.close().catch(() => undefined);
    };
  }, [stopOutgoingRingback]);

  if (variant === "header") {
    return (
      <>
        <div className="flex items-center gap-2.5">
          {!activeCall ? (
            <>
              <HeaderActionButton
                label={pendingAction === "start:AUDIO" ? "Запускаем звонок" : "Аудиозвонок"}
                disabled={isBlocked || pendingAction !== null}
                onClick={() => void startCall("AUDIO")}
                active={false}
              >
                <Phone {...iconProps} />
              </HeaderActionButton>
              <HeaderActionButton
                label={pendingAction === "start:VIDEO" ? "Запускаем видеозвонок" : "Видеозвонок"}
                disabled={isBlocked || pendingAction !== null}
                onClick={() => void startCall("VIDEO")}
                active={false}
              >
                <Video {...iconProps} />
              </HeaderActionButton>
            </>
          ) : isIncomingCall ? (
            <>
              <Button
                size="sm"
                className="h-8 rounded-full px-3"
                onClick={() => void acceptCall()}
                disabled={pendingAction !== null || isBlocked}
              >
                <PhoneCall {...iconProps} />
                {pendingAction === "accept" ? "Подключаем..." : "Принять"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 rounded-full px-3"
                onClick={() => void declineCall()}
                disabled={pendingAction !== null}
              >
                {pendingAction === "decline" ? "..." : "Отклонить"}
              </Button>
            </>
          ) : (
            <>
              {!isCurrentSession ? (
                <HeaderActionButton
                  label={pendingAction === "join" ? "Открываем звонок" : "Открыть звонок"}
                  disabled={pendingAction !== null || isBlocked}
                  onClick={() => void joinCall()}
                  active
                >
                  <PhoneCall {...iconProps} />
                </HeaderActionButton>
              ) : null}
              {isCurrentSession ? (
                <HeaderActionButton
                  label={microphoneEnabled ? "Выключить микрофон" : "Включить микрофон"}
                  disabled={pendingAction !== null || !canPublishMedia}
                  onClick={() => void toggleMicrophone()}
                  active={microphoneEnabled}
                >
                  {microphoneEnabled ? <Mic {...iconProps} /> : <MicOff {...iconProps} />}
                </HeaderActionButton>
              ) : null}
              {isCurrentSession ? (
                <HeaderActionButton
                  label={cameraEnabled ? "Выключить камеру" : "Включить камеру"}
                  disabled={pendingAction !== null || !canPublishMedia}
                  onClick={() => void toggleCamera()}
                  active={cameraEnabled}
                >
                  {cameraEnabled ? <Video {...iconProps} /> : <VideoOff {...iconProps} />}
                </HeaderActionButton>
              ) : null}
              {isCurrentSession && !screenShareVisible ? (
                <HeaderActionButton
                  label={screenShareButtonLabel}
                  disabled={pendingAction !== null || !canPublishMedia}
                  onClick={() => void toggleScreenShare()}
                  active={screenShareEnabled}
                >
                  {screenShareEnabled ? (
                    <MonitorX {...iconProps} />
                  ) : (
                    <MonitorUp {...iconProps} />
                  )}
                </HeaderActionButton>
              ) : null}
              <HeaderActionButton
                label={pendingAction === "end" ? "Завершаем звонок" : "Завершить звонок"}
                disabled={pendingAction !== null}
                onClick={() => void endCall()}
                tone="danger"
              >
                <Phone {...iconProps} />
              </HeaderActionButton>
            </>
          )}
        </div>
        {stageMarkup}
      </>
    );
  }

  return (
    <div className="grid gap-1.5">
      <div className="premium-panel rounded-[16px] px-2.5 py-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="call-summary-leading items-start md:items-center">
            <div className="call-summary-icon h-9 w-9 rounded-[12px]">
              {screenShareVisible ? <Monitor {...iconProps} /> : <PhoneCall {...iconProps} />}
            </div>

            <div className="call-summary-body gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="call-summary-title text-sm font-medium tracking-tight text-white">
                  <span className="truncate">{summaryLabel}</span>
                </p>
                <span className={cn("status-pill", readinessToneClassName)}>{readinessLabel}</span>
                {activeCall ? (
                  <span className="status-pill">{dmCallModeLabels[activeCall.mode]}</span>
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
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span>@{counterpartUsername}</span>
                {secondaryLabel ? (
                  <>
                    <span>•</span>
                    <span>{secondaryLabel}</span>
                  </>
                ) : null}
              </div>

              {infoText ? (
                <p className={cn("text-xs leading-relaxed", infoToneClassName)}>{infoText}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
            {!activeCall ? (
              <>
                <Button
                  size="sm"
                  onClick={() => void startCall("AUDIO")}
                  disabled={isBlocked || pendingAction !== null}
                >
                  <Phone {...iconProps} />
                  {pendingAction === "start:AUDIO" ? "Запускаем..." : "Звонок"}
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
                    {pendingAction === "join" ? "Открываем..." : "Открыть звонок"}
                  </Button>
                ) : null}
                {isCurrentSession ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void toggleMicrophone()}
                    disabled={pendingAction !== null || !canPublishMedia}
                  >
                    {microphoneEnabled ? <Mic {...iconProps} /> : <MicOff {...iconProps} />}
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
                    {cameraEnabled ? <Video {...iconProps} /> : <VideoOff {...iconProps} />}
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

function HeaderActionButton({
  active = false,
  children,
  disabled,
  label,
  onClick,
  tone = "default",
}: {
  active?: boolean;
  children: ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "dm-header-tool-button",
        tone === "danger"
          ? "dm-header-tool-button-danger"
          : active
            ? "dm-header-tool-button-active"
            : "",
      )}
    >
      {children}
    </button>
  );
}
