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

const iconProps = { size: 18, strokeWidth: 1.5 } as const;

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

  const joinCallById = useCallback(async (callId: string) => {
    const payload = await apiClientFetch(`/v1/calls/${callId}/token`, {
      method: "POST",
    });

    const parsed = callTokenResponseSchema.parse(payload);
    setConnection(parsed.connection);
    return parsed;
  }, []);

  const loadState = useCallback(async () => {
    try {
      const payload = await apiClientFetch(`/v1/calls/dm/${conversationId}`);
      setState(callStateResponseSchema.parse(payload));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load call state.",
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

  useEffect(() => {
    if (!state?.activeCall && connection) {
      setConnection(null);
      return;
    }

    if (state?.activeCall && connection && state.activeCall.id !== connection.callId) {
      setConnection(null);
    }
  }, [connection, state?.activeCall]);

  useEffect(() => {
    const activeCall = state?.activeCall;
    const viewerParticipant = activeCall?.participants.find(
      (participant) => participant.user.id === viewerId,
    );

    if (
      !activeCall ||
      connection ||
      pendingAction ||
      isBlocked ||
      activeCall.status !== "ACCEPTED" ||
      !viewerParticipant ||
      !["ACCEPTED", "JOINED"].includes(viewerParticipant.state)
    ) {
      return;
    }

    void joinCallById(activeCall.id).catch(() => undefined);
  }, [connection, isBlocked, joinCallById, pendingAction, state, viewerId]);

  async function startCall(mode: "AUDIO" | "VIDEO") {
    setPendingAction(`start:${mode}`);

    try {
      const payload = await apiClientFetch(`/v1/calls/dm/${conversationId}/start`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });

      const parsed = callResponseSchema.parse(payload);
      await joinCallById(parsed.call.id);
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
      await joinCallById(parsed.call.id);
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
      await joinCallById(state.activeCall.id);
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
  const connectedParticipants =
    activeCall?.participants.filter((participant) =>
      ["ACCEPTED", "JOINED"].includes(participant.state),
    ).length ?? 0;

  return (
    <div className="grid gap-3">
      <div className="premium-panel rounded-[24px] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="eyebrow-pill">DM call</span>
              <span className="status-pill">
                <PhoneCall {...iconProps} />
                {activeCall ? activeCall.status : "Ready"}
              </span>
              {viewerParticipant ? (
                <span className="status-pill">You: {viewerParticipant.state}</span>
              ) : null}
              {activeCall ? (
                <span className="status-pill">{connectedParticipants} connected</span>
              ) : null}
              {state?.history.length ? (
                <span className="status-pill">{state.history.length} recent</span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-dim)]">
              {activeCall
                ? "Call state, live media and screen share stay anchored inside the DM scene."
                : "Start a voice or video session without leaving the message thread."}
            </p>
            {errorMessage ? (
              <p className="mt-3 text-sm text-rose-200">{errorMessage}</p>
            ) : null}
            {!errorMessage && isBlocked ? (
              <p className="mt-3 text-sm text-amber-100">
                Calling is unavailable in this conversation.
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
                  <Phone {...iconProps} />
                  {pendingAction === "start:AUDIO" ? "Starting..." : "Voice call"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void startCall("VIDEO")}
                  disabled={isBlocked || pendingAction !== null}
                >
                  <Video {...iconProps} />
                  {pendingAction === "start:VIDEO" ? "Starting..." : "Video call"}
                </Button>
              </>
            ) : isIncomingCall ? (
              <>
                <Button
                  size="sm"
                  onClick={() => void acceptCall()}
                  disabled={pendingAction !== null || isBlocked}
                >
                  {pendingAction === "accept" ? "Accepting..." : "Accept"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void declineCall()}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === "decline" ? "Declining..." : "Decline"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={() => void joinCall()}
                  disabled={pendingAction !== null || isBlocked}
                >
                  {pendingAction === "join" ? "Joining..." : "Rejoin"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void endCall()}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === "end" ? "Ending..." : "End call"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <LiveKitCallRoom
        connection={connection}
        mode={activeCall?.mode ?? "AUDIO"}
        title="Live scene"
        description="Voice, camera and screen-share state stay grouped inside the DM."
        onLeave={async () => {
          await endCall();
        }}
      />
    </div>
  );
}
