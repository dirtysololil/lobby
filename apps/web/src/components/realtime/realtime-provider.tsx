"use client";

import {
  callSignalSchema,
  dmSignalSchema,
  type CallSignal,
  type CallSummary,
  type DmSignal,
  type PublicUser,
} from "@lobby/shared";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { resolveRealtimeBaseUrlForBrowser, runtimeConfig } from "@/lib/runtime-config";

interface RealtimeContextValue {
  socket: Socket | null;
  latestSignal: CallSignal | null;
  latestDmSignal: DmSignal | null;
  incomingCalls: CallSummary[];
  clearIncomingCall: (callId: string) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
  viewer: PublicUser;
  children: ReactNode;
}

export function RealtimeProvider({ viewer, children }: RealtimeProviderProps) {
  const [socket] = useState<Socket>(() =>
    io(resolveRealtimeBaseUrlForBrowser(), {
      withCredentials: true,
      transports: ["websocket"],
      path: runtimeConfig.realtimePath,
    }),
  );
  const [latestSignal, setLatestSignal] = useState<CallSignal | null>(null);
  const [latestDmSignal, setLatestDmSignal] = useState<DmSignal | null>(null);
  const [incomingCalls, setIncomingCalls] = useState<CallSummary[]>([]);
  const clearIncomingCall = useCallback((callId: string) => {
    setIncomingCalls((current) => current.filter((item) => item.id !== callId));
  }, []);

  useEffect(() => {
    function handleSignal(rawPayload: unknown) {
      const payload = callSignalSchema.parse(rawPayload);
      setLatestSignal(payload);

      const viewerParticipant = payload.call.participants.find((participant) => participant.user.id === viewer.id);
      const isIncomingDm =
        payload.call.scope === "DM" &&
        payload.call.status === "RINGING" &&
        viewerParticipant?.state === "INVITED";

      setIncomingCalls((current) => {
        if (isIncomingDm) {
          const nextItems = current.filter((item) => item.id !== payload.call.id);
          return [payload.call, ...nextItems];
        }

        return current.filter((item) => item.id !== payload.call.id);
      });
    }

    function handleDmSignal(rawPayload: unknown) {
      setLatestDmSignal(dmSignalSchema.parse(rawPayload));
    }

    socket.on("calls.signal", handleSignal);
    socket.on("dm.signal", handleDmSignal);

    return () => {
      socket.off("calls.signal", handleSignal);
      socket.off("dm.signal", handleDmSignal);
      socket.disconnect();
    };
  }, [socket, viewer.id]);

  return (
    <RealtimeContext.Provider
      value={{
        socket,
        latestSignal,
        latestDmSignal,
        incomingCalls,
        clearIncomingCall,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const value = useContext(RealtimeContext);

  if (!value) {
    throw new Error("useRealtime must be used inside RealtimeProvider");
  }

  return value;
}
