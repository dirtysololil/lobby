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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClientFetch } from "@/lib/api-client";
import { LiveKitCallRoom } from "./livekit-call-room";
import { useRealtime } from "../realtime/realtime-provider";

interface LobbyCallPanelProps {
  hubId: string;
  lobbyId: string;
  isViewerMuted: boolean;
}

export function LobbyCallPanel({ hubId, lobbyId, isViewerMuted }: LobbyCallPanelProps) {
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
      setErrorMessage(error instanceof Error ? error.message : "Unable to load lobby call state");
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
      currentSocket.emit("calls.subscribe_lobby", {
        hubId,
        lobbyId,
      });
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
      const payload = await apiClientFetch(`/v1/calls/hubs/${hubId}/lobbies/${lobbyId}/start`, {
        method: "POST",
      });

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Group call</CardTitle>
          <CardDescription>Voice lobby media is issued through LiveKit access tokens from the API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {errorMessage ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          {isViewerMuted ? (
            <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 px-5 py-4 text-sm text-amber-50">
              You can still join the room, but media publishing is restricted while the hub mute is active.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {!state?.activeCall ? (
              <Button onClick={() => void startCall()} disabled={pendingAction !== null}>
                <Phone className="mr-2 h-4 w-4" />
                {pendingAction === "start" ? "Starting..." : "Start group call"}
              </Button>
            ) : (
              <>
                <Button onClick={() => void joinCall()} disabled={pendingAction !== null}>
                  {pendingAction === "join" ? "Joining..." : "Join"}
                </Button>
                <Button variant="secondary" onClick={() => void leaveCall()} disabled={pendingAction !== null}>
                  {pendingAction === "leave" ? "Leaving..." : "Leave"}
                </Button>
              </>
            )}
          </div>

          {state?.activeCall ? (
            <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-5">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-white/10 px-3 py-1 text-sky-200/70">
                  {state.activeCall.mode}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
                  {state.activeCall.status}
                </span>
              </div>
            </div>
          ) : null}

          {state?.history.length ? (
            <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-5">
              <p className="text-sm font-medium text-white">Recent sessions</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {state.history.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3">
                    <span>
                      {item.mode} / {item.status}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <LiveKitCallRoom
        connection={connection}
        mode={state?.activeCall?.mode ?? "AUDIO"}
        title="Active lobby call"
        description="Join, mute, toggle camera and screen share directly inside this voice lobby."
        onLeave={async () => {
          await leaveCall();
        }}
      />
    </div>
  );
}
