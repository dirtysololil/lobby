"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Mic,
  MicOff,
  Monitor,
  MonitorUp,
  MonitorX,
  PhoneCall,
  PhoneOff,
  Users2,
  Video,
  VideoOff,
  Waves,
} from "lucide-react";
import type { CallSummary } from "@lobby/shared";
import { callTokenResponseSchema } from "@lobby/shared";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Room, RoomEvent, Track, type Participant } from "livekit-client";
import { apiClientFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/components/realtime/realtime-provider";

type ActiveCallScope = Extract<CallSummary["scope"], "DM" | "HUB_LOBBY">;
type CallConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

interface CallConnection {
  callId: string;
  url: string;
  roomName: string;
  token: string;
  canPublishMedia: boolean;
}

interface ActiveCallSession {
  scope: ActiveCallScope;
  route: string;
  title: string;
  subtitle: string;
  call: CallSummary;
  connection: CallConnection;
}

interface CallConnectRequest {
  callId: string;
  scope: ActiveCallScope;
  route: string;
  title: string;
  subtitle: string;
  call?: CallSummary | null;
}

interface TrackView {
  id: string;
  participantName: string;
  source: string;
  kind: "audio" | "video";
  isLocal: boolean;
  track: Track;
}

interface CallSessionContextValue {
  session: ActiveCallSession | null;
  status: CallConnectionStatus;
  errorMessage: string | null;
  tracks: TrackView[];
  participantCount: number;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  connectToCall: (request: CallConnectRequest) => Promise<void>;
  syncCall: (
    call: CallSummary | null,
    metadata?: Partial<Pick<CallConnectRequest, "route" | "title" | "subtitle">>,
  ) => void;
  isActiveCall: (callId: string | null | undefined) => boolean;
  leaveCall: (callId?: string | null) => Promise<void>;
  dismissCall: (callId?: string | null) => void;
  toggleMicrophone: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
}

const CallSessionContext = createContext<CallSessionContextValue | null>(null);

function collectTrackViews(room: Room) {
  const items: TrackView[] = [];

  function appendParticipantTracks(participant: Participant, isLocal: boolean) {
    for (const publication of participant.trackPublications.values()) {
      if (!publication.track) {
        continue;
      }

      items.push({
        id: `${participant.identity}:${publication.trackSid ?? publication.source}`,
        participantName: participant.name || participant.identity,
        source: String(publication.source ?? "unknown"),
        kind: publication.track.kind === Track.Kind.Video ? "video" : "audio",
        isLocal,
        track: publication.track,
      });
    }
  }

  appendParticipantTracks(room.localParticipant, true);
  for (const participant of room.remoteParticipants.values()) {
    appendParticipantTracks(participant, false);
  }

  const localPublications = [...room.localParticipant.trackPublications.values()];

  return {
    items,
    hasMicrophone: localPublications.some(
      (publication) =>
        publication.source === Track.Source.Microphone && publication.track,
    ),
    hasCamera: localPublications.some(
      (publication) => publication.source === Track.Source.Camera && publication.track,
    ),
    hasScreenShare: localPublications.some(
      (publication) =>
        publication.source === Track.Source.ScreenShare && publication.track,
    ),
  };
}

function isScreenShareTrack(item: TrackView) {
  return item.source.toLowerCase().includes("screen");
}

function isMicrophoneTrack(item: TrackView) {
  return item.source.toLowerCase().includes("microphone");
}

function getParticipantInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getConnectedParticipantCount(call: CallSummary): number {
  return call.participants.filter((participant) => {
    return ["ACCEPTED", "JOINED"].includes(participant.state) && !participant.leftAt;
  }).length;
}

export function CallSessionProvider({ children }: { children: ReactNode }) {
  const { latestSignal } = useRealtime();
  const roomRef = useRef<Room | null>(null);
  const [session, setSession] = useState<ActiveCallSession | null>(null);
  const [status, setStatus] = useState<CallConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackView[]>([]);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);

  const clearRoomSnapshot = useCallback((nextStatus: CallConnectionStatus = "idle") => {
    setStatus(nextStatus);
    setTracks([]);
    setMicrophoneEnabled(false);
    setCameraEnabled(false);
    setScreenShareEnabled(false);
    if (nextStatus !== "error") {
      setErrorMessage(null);
    }
  }, []);

  const dismissCall = useCallback(
    (callId?: string | null) => {
      setSession((current) => {
        if (!current) {
          return current;
        }

        if (callId && current.call.id !== callId) {
          return current;
        }

        roomRef.current?.disconnect();
        roomRef.current = null;
        clearRoomSnapshot();
        return null;
      });
    },
    [clearRoomSnapshot],
  );

  const connectToCall = useCallback(
    async (request: CallConnectRequest) => {
      if (session?.call.id === request.callId && roomRef.current) {
        setSession((current) =>
          current && current.call.id === request.callId
            ? {
                ...current,
                scope: request.scope,
                route: request.route,
                title: request.title,
                subtitle: request.subtitle,
                call: request.call ?? current.call,
              }
            : current,
        );
        return;
      }

      const payload = await apiClientFetch(`/v1/calls/${request.callId}/token`, {
        method: "POST",
      });
      const parsed = callTokenResponseSchema.parse(payload);

      setSession({
        scope: request.scope,
        route: request.route,
        title: request.title,
        subtitle: request.subtitle,
        call: request.call ?? parsed.call,
        connection: parsed.connection,
      });
    },
    [session?.call.id],
  );

  const syncCall = useCallback(
    (
      call: CallSummary | null,
      metadata?: Partial<Pick<CallConnectRequest, "route" | "title" | "subtitle">>,
    ) => {
      if (!call) {
        return;
      }

      setSession((current) =>
        current && current.call.id === call.id
          ? {
              ...current,
              call,
              route: metadata?.route ?? current.route,
              title: metadata?.title ?? current.title,
              subtitle: metadata?.subtitle ?? current.subtitle,
            }
          : current,
      );
    },
    [],
  );

  const isActiveCall = useCallback(
    (callId: string | null | undefined) => {
      return Boolean(callId) && session?.call.id === callId;
    },
    [session?.call.id],
  );

  const leaveCall = useCallback(
    async (callId?: string | null) => {
      const resolvedCallId = callId ?? session?.call.id;

      if (!resolvedCallId) {
        return;
      }

      await apiClientFetch(`/v1/calls/${resolvedCallId}/end`, {
        method: "POST",
      });

      dismissCall(resolvedCallId);
    },
    [dismissCall, session?.call.id],
  );

  useEffect(() => {
    if (!latestSignal || !session || latestSignal.call.id !== session.call.id) {
      return;
    }

    if (["DECLINED", "ENDED", "MISSED"].includes(latestSignal.call.status)) {
      dismissCall(latestSignal.call.id);
      return;
    }

    setSession((current) =>
      current && current.call.id === latestSignal.call.id
        ? {
            ...current,
            call: latestSignal.call,
          }
        : current,
    );
  }, [dismissCall, latestSignal, session?.call.id]);

  useEffect(() => {
    if (!session) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      clearRoomSnapshot();
      return;
    }

    let isCancelled = false;
    const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = nextRoom;
    setStatus("connecting");
    setErrorMessage(null);

    function syncRoomState() {
      if (isCancelled) {
        return;
      }

      const snapshot = collectTrackViews(nextRoom);
      setTracks(snapshot.items);
      setMicrophoneEnabled(snapshot.hasMicrophone);
      setCameraEnabled(snapshot.hasCamera);
      setScreenShareEnabled(snapshot.hasScreenShare);
    }

    const trackedEvents = [
      RoomEvent.Connected,
      RoomEvent.Reconnected,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
    ];

    for (const event of trackedEvents) {
      nextRoom.on(event, syncRoomState);
    }

    nextRoom.on(RoomEvent.Reconnecting, () => {
      if (!isCancelled) {
        setStatus("reconnecting");
      }
    });

    nextRoom.on(RoomEvent.Reconnected, () => {
      if (!isCancelled) {
        syncRoomState();
        setStatus("connected");
      }
    });

    nextRoom.on(RoomEvent.Disconnected, () => {
      if (!isCancelled) {
        clearRoomSnapshot();
      }
    });

    void (async () => {
      try {
        await nextRoom.connect(session.connection.url, session.connection.token);
        await nextRoom.startAudio().catch(() => undefined);

        if (session.connection.canPublishMedia) {
          await nextRoom.localParticipant.setMicrophoneEnabled(true);
          if (session.call.mode === "VIDEO") {
            await nextRoom.localParticipant.setCameraEnabled(true);
          }
        }

        if (isCancelled) {
          nextRoom.disconnect();
          return;
        }

        syncRoomState();
        setStatus("connected");
      } catch (error) {
        if (!isCancelled) {
          setStatus("error");
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to connect to the LiveKit room.",
          );
        }
      }
    })();

    return () => {
      isCancelled = true;
      for (const event of trackedEvents) {
        nextRoom.off(event, syncRoomState);
      }
      nextRoom.disconnect();
      if (roomRef.current === nextRoom) {
        roomRef.current = null;
      }
    };
  }, [
    clearRoomSnapshot,
    session?.call.id,
    session?.call.mode,
    session?.connection.canPublishMedia,
    session?.connection.token,
    session?.connection.url,
  ]);

  async function toggleMicrophone() {
    const room = roomRef.current;

    if (!room || !session?.connection.canPublishMedia) {
      return;
    }

    await room.localParticipant.setMicrophoneEnabled(!microphoneEnabled);
    setMicrophoneEnabled(!microphoneEnabled);
  }

  async function toggleCamera() {
    const room = roomRef.current;

    if (!room || !session?.connection.canPublishMedia) {
      return;
    }

    await room.localParticipant.setCameraEnabled(!cameraEnabled);
    setCameraEnabled(!cameraEnabled);
  }

  async function toggleScreenShare() {
    const room = roomRef.current;

    if (!room || !session?.connection.canPublishMedia) {
      return;
    }

    await room.localParticipant.setScreenShareEnabled(!screenShareEnabled);
    setScreenShareEnabled(!screenShareEnabled);
  }

  const participantCount = useMemo(() => {
    if (!session) {
      return 0;
    }

    const trackParticipantCount = new Set(
      tracks.map((item) => item.participantName),
    ).size;

    return Math.max(trackParticipantCount, getConnectedParticipantCount(session.call), 1);
  }, [session, tracks]);

  const value = useMemo<CallSessionContextValue>(
    () => ({
      session,
      status,
      errorMessage,
      tracks,
      participantCount,
      microphoneEnabled,
      cameraEnabled,
      screenShareEnabled,
      connectToCall,
      syncCall,
      isActiveCall,
      leaveCall,
      dismissCall,
      toggleMicrophone,
      toggleCamera,
      toggleScreenShare,
    }),
    [
      session,
      status,
      errorMessage,
      tracks,
      participantCount,
      microphoneEnabled,
      cameraEnabled,
      screenShareEnabled,
      connectToCall,
      syncCall,
      isActiveCall,
      leaveCall,
      dismissCall,
      toggleMicrophone,
      toggleCamera,
      toggleScreenShare,
    ],
  );

  return (
    <CallSessionContext.Provider value={value}>{children}</CallSessionContext.Provider>
  );
}

export function useCallSession() {
  const value = useContext(CallSessionContext);

  if (!value) {
    throw new Error("useCallSession must be used inside CallSessionProvider");
  }

  return value;
}

function TrackSurface({
  item,
  emphasis = "tile",
}: {
  item: TrackView;
  emphasis?: "stage" | "tile";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const element =
      item.kind === "video"
        ? document.createElement("video")
        : document.createElement("audio");

    element.autoplay = true;
    element.setAttribute("playsinline", "true");
    element.muted = item.isLocal;
    element.defaultMuted = item.isLocal;
    element.volume = item.isLocal ? 0 : 1;

    if (element instanceof HTMLVideoElement) {
      element.className =
        emphasis === "stage"
          ? "h-full w-full object-cover"
          : "h-full w-full rounded-[16px] object-cover";
      element.playsInline = true;
    } else {
      element.className = "hidden";
    }

    item.track.attach(element);
    container.appendChild(element);
    void element.play().catch(() => undefined);

    return () => {
      item.track.detach(element);
      element.remove();
    };
  }, [emphasis, item]);

  const isScreen = isScreenShareTrack(item);

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-white/6 bg-[var(--bg-panel-muted)]",
        emphasis === "stage" ? "min-h-[240px] rounded-[20px]" : "rounded-[18px]",
      )}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {item.kind === "audio" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.14),transparent_42%),rgba(10,13,18,0.84)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/8 bg-white/5 text-sm font-semibold text-white">
            {getParticipantInitials(item.participantName)}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">{item.participantName}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Voice stream live</p>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-[linear-gradient(180deg,transparent,rgba(5,8,12,0.84))] px-3 pb-3 pt-8">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{item.participantName}</p>
          <p className="truncate text-xs text-[var(--text-soft)]">
            {item.isLocal ? "You" : "Remote"} ·{" "}
            {isScreen ? "Screen share" : item.kind === "video" ? "Camera" : "Audio"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-black/30 px-2 py-1 text-[11px] text-[var(--text-soft)] backdrop-blur-sm">
          {isScreen ? (
            <Monitor size={13} strokeWidth={1.5} />
          ) : item.kind === "video" ? (
            <Video size={13} strokeWidth={1.5} />
          ) : (
            <Mic size={13} strokeWidth={1.5} />
          )}
          {isScreen ? "Share" : item.kind}
        </span>
      </div>
    </div>
  );
}

export function PersistentCallDock() {
  const pathname = usePathname();
  const {
    session,
    status,
    participantCount,
    microphoneEnabled,
    leaveCall,
    toggleMicrophone,
  } = useCallSession();

  if (!session) {
    return null;
  }

  const safePathname = pathname ?? "";
  const onActiveRoute = safePathname === session.route;

  if (onActiveRoute) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-end px-3 md:bottom-4 md:px-4">
      <div className="pointer-events-auto w-full max-w-[420px] rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_34%),rgba(11,16,24,0.94)] p-3 shadow-[0_24px_60px_rgba(4,8,16,0.42)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(106,168,248,0.24)] bg-[rgba(106,168,248,0.14)] text-[var(--accent-strong)]">
            <PhoneCall size={18} strokeWidth={1.5} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-white">{session.title}</p>
              <span className="status-pill">{status}</span>
              <span className="status-pill">
                <Users2 size={14} strokeWidth={1.5} />
                {participantCount}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-[var(--text-dim)]">{session.subtitle}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={microphoneEnabled ? "secondary" : "ghost"}
            onClick={() => void toggleMicrophone()}
            disabled={!session.connection.canPublishMedia}
          >
            {microphoneEnabled ? (
              <Mic size={15} strokeWidth={1.5} />
            ) : (
              <MicOff size={15} strokeWidth={1.5} />
            )}
            {microphoneEnabled ? "Mute" : "Unmute"}
          </Button>

          <Link
            href={session.route}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-white/8 bg-white/5 px-3 text-xs font-medium text-white transition-colors hover:bg-white/10"
          >
            <ArrowUpRight size={15} strokeWidth={1.5} />
            Return to call
          </Link>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => void leaveCall(session.call.id)}
            className="ml-auto"
          >
            <PhoneOff size={15} strokeWidth={1.5} />
            Leave
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CallRoomCanvas({
  callId,
  title,
  description,
}: {
  callId: string | null;
  title: string;
  description: string;
}) {
  const {
    session,
    status,
    errorMessage,
    tracks,
    participantCount,
    microphoneEnabled,
    cameraEnabled,
    screenShareEnabled,
    leaveCall,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
  } = useCallSession();

  if (!callId || !session || session.call.id !== callId) {
    return null;
  }

  const screenTracks = tracks.filter(
    (item) => item.kind === "video" && isScreenShareTrack(item),
  );
  const cameraTracks = tracks.filter(
    (item) => item.kind === "video" && !isScreenShareTrack(item),
  );
  const audioTracks = tracks.filter(
    (item) =>
      item.kind === "audio" &&
      (isMicrophoneTrack(item) || !item.source.toLowerCase().includes("screen")),
  );

  const primaryTrack =
    screenTracks.find((item) => !item.isLocal) ??
    screenTracks[0] ??
    cameraTracks.find((item) => !item.isLocal) ??
    cameraTracks[0] ??
    null;

  const secondaryVideoTracks = [...screenTracks, ...cameraTracks].filter(
    (item) => item.id !== primaryTrack?.id,
  );

  return (
    <div className="premium-panel flex min-h-0 flex-1 flex-col rounded-[24px] p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">{title}</span>
            <span className="status-pill">{session.call.mode}</span>
            <span className="status-pill">{status}</span>
            <span className="status-pill">
              <Users2 size={14} strokeWidth={1.5} />
              {participantCount}
            </span>
            {!session.connection.canPublishMedia ? (
              <span className="status-pill">Listen only</span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-[var(--text-dim)]">{description}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-white/6 bg-white/[0.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:grid-cols-4">
          <Button
            size="sm"
            variant={microphoneEnabled ? "secondary" : "ghost"}
            onClick={() => void toggleMicrophone()}
            disabled={!session.connection.canPublishMedia}
            className="justify-start"
          >
            {microphoneEnabled ? <Mic size={15} strokeWidth={1.5} /> : <MicOff size={15} strokeWidth={1.5} />}
            {microphoneEnabled ? "Mic on" : "Mic off"}
          </Button>
          <Button
            size="sm"
            variant={cameraEnabled ? "secondary" : "ghost"}
            onClick={() => void toggleCamera()}
            disabled={!session.connection.canPublishMedia}
            className="justify-start"
          >
            {cameraEnabled ? <Video size={15} strokeWidth={1.5} /> : <VideoOff size={15} strokeWidth={1.5} />}
            {cameraEnabled ? "Camera" : "Camera off"}
          </Button>
          <Button
            size="sm"
            variant={screenShareEnabled ? "secondary" : "ghost"}
            onClick={() => void toggleScreenShare()}
            disabled={!session.connection.canPublishMedia}
            className="justify-start"
          >
            {screenShareEnabled ? (
              <MonitorX size={15} strokeWidth={1.5} />
            ) : (
              <MonitorUp size={15} strokeWidth={1.5} />
            )}
            {screenShareEnabled ? "Stop share" : "Share"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void leaveCall(session.call.id)}
            className="justify-start"
          >
            <PhoneOff size={15} strokeWidth={1.5} />
            Leave
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-3 rounded-[16px] border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-3 grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_280px]">
        <div className="min-h-0 space-y-3">
          {primaryTrack ? (
            <TrackSurface item={primaryTrack} emphasis="stage" />
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[20px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.1),transparent_28%),var(--bg-panel-muted)] px-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/8 bg-white/5 text-[var(--accent)]">
                <Waves size={22} strokeWidth={1.5} />
              </div>
              <p className="mt-3 text-sm font-medium text-white">Call scene is ready</p>
              <p className="mt-2 max-w-sm text-sm text-[var(--text-dim)]">
                Camera and screen-share tracks will appear here without dropping the active session.
              </p>
            </div>
          )}

          {secondaryVideoTracks.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {secondaryVideoTracks.map((item) => (
                <TrackSurface key={item.id} item={item} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 space-y-3">
          <div className="surface-subtle rounded-[20px] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Participants</p>
              <span className="text-xs text-[var(--text-muted)]">{participantCount} live</span>
            </div>
            <div className="mt-3 grid gap-2">
              {audioTracks.length === 0 && cameraTracks.length === 0 && screenTracks.length === 0 ? (
                <div className="rounded-[16px] border border-white/6 bg-black/10 px-3 py-4 text-center text-sm text-[var(--text-dim)]">
                  Waiting for participants...
                </div>
              ) : (
                audioTracks.map((item) => <TrackSurface key={item.id} item={item} />)
              )}
            </div>
          </div>

          <div className="surface-subtle rounded-[20px] p-3">
            <p className="text-sm font-medium text-white">Live state</p>
            <div className="mt-3 grid gap-2 text-sm text-[var(--text-dim)]">
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/6 bg-black/10 px-3 py-2">
                <span>Connection</span>
                <span className="text-[var(--text-soft)]">{status}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/6 bg-black/10 px-3 py-2">
                <span>Microphone</span>
                <span className="text-[var(--text-soft)]">
                  {microphoneEnabled ? "Live" : "Muted"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/6 bg-black/10 px-3 py-2">
                <span>Camera</span>
                <span className="text-[var(--text-soft)]">
                  {cameraEnabled ? "Publishing" : "Off"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/6 bg-black/10 px-3 py-2">
                <span>Screen share</span>
                <span className="text-[var(--text-soft)]">
                  {screenShareEnabled ? "Publishing" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
