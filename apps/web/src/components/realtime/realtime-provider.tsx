"use client";

import {
  callSignalSchema,
  dmSignalSchema,
  presenceSnapshotSchema,
  presenceUpdateSchema,
  type CallSignal,
  type CallSummary,
  type DmSignal,
  type PublicUser,
} from "@lobby/shared";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { resolveRealtimeBaseUrlForBrowser, runtimeConfig } from "@/lib/runtime-config";

type RealtimeTransportMode = "auto" | "polling" | "websocket";

interface RealtimeContextValue {
  socket: Socket | null;
  latestSignal: CallSignal | null;
  latestDmSignal: DmSignal | null;
  incomingCalls: CallSummary[];
  presenceByUserId: Record<string, boolean>;
  clearIncomingCall: (callId: string) => void;
  disconnectRealtime: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
  viewer: PublicUser;
  children: ReactNode;
}

declare global {
  interface Window {
    __lobbySocket?: Socket;
  }
}

const nativeResumeEventName = "lobby:native-resume";

function isRealtimeTransportMode(value: string | null | undefined): value is RealtimeTransportMode {
  return value === "auto" || value === "polling" || value === "websocket";
}

function resolveRealtimeTransportMode(): RealtimeTransportMode {
  if (typeof window === "undefined") {
    return "auto";
  }

  const searchMode = new URLSearchParams(window.location.search).get("socketTransport");

  if (isRealtimeTransportMode(searchMode)) {
    return searchMode;
  }

  try {
    const storedMode = window.localStorage.getItem("lobby:socketTransport");

    if (isRealtimeTransportMode(storedMode)) {
      return storedMode;
    }
  } catch {
    // Ignore localStorage access errors and fall back to runtime config.
  }

  return isRealtimeTransportMode(runtimeConfig.realtimeTransportMode)
    ? runtimeConfig.realtimeTransportMode
    : "auto";
}

function resolveRealtimeTransports(mode: RealtimeTransportMode): Array<"polling" | "websocket"> {
  switch (mode) {
    case "polling":
      return ["polling"];
    case "websocket":
      return ["websocket"];
    default:
      return ["polling", "websocket"];
  }
}

function getTransportName(socket: Socket): string {
  return socket.io.engine?.transport?.name ?? "unknown";
}

export function RealtimeProvider({ viewer, children }: RealtimeProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [latestSignal, setLatestSignal] = useState<CallSignal | null>(null);
  const [latestDmSignal, setLatestDmSignal] = useState<DmSignal | null>(null);
  const [incomingCalls, setIncomingCalls] = useState<CallSummary[]>([]);
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, boolean>>({});
  const clearIncomingCall = useCallback((callId: string) => {
    setIncomingCalls((current) => current.filter((item) => item.id !== callId));
  }, []);
  const disconnectRealtime = useCallback(() => {
    setLatestSignal(null);
    setLatestDmSignal(null);
    setIncomingCalls([]);
    setPresenceByUserId({});

    if (typeof window !== "undefined" && socket && window.__lobbySocket === socket) {
      delete window.__lobbySocket;
    }

    socket?.disconnect();
  }, [socket]);

  useEffect(() => {
    const transportMode = resolveRealtimeTransportMode();
    const transports = resolveRealtimeTransports(transportMode);
    const baseUrl = resolveRealtimeBaseUrlForBrowser();
    const nextSocket = io(baseUrl, {
      withCredentials: true,
      transports,
      path: runtimeConfig.realtimePath,
    });

    console.info("[realtime/client] socket init", {
      baseUrl,
      path: runtimeConfig.realtimePath,
      transportMode,
      transports,
      viewerId: viewer.id,
    });

    if (typeof window !== "undefined") {
      window.__lobbySocket = nextSocket;
    }

    queueMicrotask(() => {
      setSocket(nextSocket);
    });

    return () => {
      if (typeof window !== "undefined" && window.__lobbySocket === nextSocket) {
        delete window.__lobbySocket;
      }

      nextSocket.disconnect();
      setSocket((current) => (current === nextSocket ? null : current));
    };
  }, [viewer.id]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const activeSocket = socket;

    function reconnectAfterResume() {
      if (!activeSocket.connected) {
        activeSocket.connect();
        return;
      }

      activeSocket.emit("presence.sync");
    }

    function handleVisibilityChange() {
      if (typeof document !== "undefined" && !document.hidden) {
        reconnectAfterResume();
      }
    }

    const handleConnect = () => {
      console.info("[realtime/client] connect", {
        socketId: socket.id,
        transport: getTransportName(socket),
        connected: socket.connected,
      });

      setPresenceByUserId((current) => ({
        ...current,
        [viewer.id]: true,
      }));
      socket.emit("presence.sync");
    };

    const handleEngineUpgrade = (transport: { name: string }) => {
      console.info("[realtime/client] engine upgrade", {
        socketId: socket.id,
        transport: transport.name,
      });
    };

    const handleEngineUpgradeError = (error: unknown) => {
      console.error("[realtime/client] engine upgrade_error", {
        error,
        transport: getTransportName(socket),
      });
    };

    const handleConnectError = (
      error: Error & { description?: unknown; context?: unknown },
    ) => {
      console.error("[realtime/client] connect_error", {
        message: error.message,
        description: error.description,
        context: error.context,
        transport: getTransportName(socket),
      });
    };

    const handleDisconnect = (reason: string, details: unknown) => {
      console.warn("[realtime/client] disconnect", {
        reason,
        details,
        transport: getTransportName(socket),
      });
      setPresenceByUserId({});
    };

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

    function handlePresenceSnapshot(rawPayload: unknown) {
      const payload = presenceSnapshotSchema.parse(rawPayload);
      setPresenceByUserId(
        Object.fromEntries(payload.onlineUserIds.map((userId) => [userId, true])),
      );
    }

    function handlePresenceUpdate(rawPayload: unknown) {
      const payload = presenceUpdateSchema.parse(rawPayload);
      setPresenceByUserId((current) => {
        if (payload.isOnline) {
          return {
            ...current,
            [payload.userId]: true,
          };
        }

        const next = { ...current };
        delete next[payload.userId];
        return next;
      });
    }

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);
    socket.on("calls.signal", handleSignal);
    socket.on("dm.signal", handleDmSignal);
    socket.on("presence.snapshot", handlePresenceSnapshot);
    socket.on("presence.updated", handlePresenceUpdate);
    socket.io.engine.on("upgrade", handleEngineUpgrade);
    socket.io.engine.on("upgradeError", handleEngineUpgradeError);
    window.addEventListener(nativeResumeEventName, reconnectAfterResume);
    window.addEventListener("online", reconnectAfterResume);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (typeof window !== "undefined") {
      window.__lobbySocket = socket;
    }

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);
      socket.off("calls.signal", handleSignal);
      socket.off("dm.signal", handleDmSignal);
      socket.off("presence.snapshot", handlePresenceSnapshot);
      socket.off("presence.updated", handlePresenceUpdate);
      socket.io.engine.off("upgrade", handleEngineUpgrade);
      socket.io.engine.off("upgradeError", handleEngineUpgradeError);
      window.removeEventListener(nativeResumeEventName, reconnectAfterResume);
      window.removeEventListener("online", reconnectAfterResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (typeof window !== "undefined" && window.__lobbySocket === socket) {
        delete window.__lobbySocket;
      }

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
        presenceByUserId,
        clearIncomingCall,
        disconnectRealtime,
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

export function useOptionalRealtimePresence() {
  return useContext(RealtimeContext)?.presenceByUserId ?? null;
}
