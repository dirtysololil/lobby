"use client";

import type { CallMode } from "@lobby/shared";
import {
  Monitor,
  MonitorUp,
  MonitorX,
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Waves,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track, type Participant } from "livekit-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CallConnection {
  callId: string;
  url: string;
  roomName: string;
  token: string;
  canPublishMedia: boolean;
}

interface TrackView {
  id: string;
  participantName: string;
  source: string;
  kind: "audio" | "video";
  isLocal: boolean;
  track: Track;
}

interface LiveKitCallRoomProps {
  connection: CallConnection | null;
  mode: CallMode;
  title: string;
  description: string;
  onLeave: () => Promise<void> | void;
}

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
          : "h-full w-full rounded-[18px] object-cover";
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
        emphasis === "stage" ? "min-h-[320px] rounded-[24px]" : "rounded-[20px]",
      )}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {item.kind === "audio" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,rgba(124,140,255,0.16),transparent_42%),rgba(10,13,18,0.82)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/8 bg-white/5 text-lg font-semibold text-white">
            {getParticipantInitials(item.participantName)}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">{item.participantName}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Voice stream active
            </p>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-[linear-gradient(180deg,transparent,rgba(5,8,12,0.82))] px-4 pb-4 pt-10">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {item.participantName}
          </p>
          <p className="truncate text-xs text-[var(--text-soft)]">
            {item.isLocal ? "You" : "Remote"} ·{" "}
            {isScreen ? "Screen share" : item.kind === "video" ? "Camera" : "Audio"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-black/30 px-2 py-1 text-[11px] text-[var(--text-soft)] backdrop-blur-sm">
          {isScreen ? (
            <Monitor size={14} strokeWidth={1.5} />
          ) : item.kind === "video" ? (
            <Video size={14} strokeWidth={1.5} />
          ) : (
            <Mic size={14} strokeWidth={1.5} />
          )}
          {isScreen ? "Share" : item.kind}
        </span>
      </div>
    </div>
  );
}

export function LiveKitCallRoom({
  connection,
  mode,
  title,
  description,
  onLeave,
}: LiveKitCallRoomProps) {
  const iconProps = { size: 18, strokeWidth: 1.5 } as const;
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackView[]>([]);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!connection) {
      roomRef.current?.disconnect();
      roomRef.current = null;
      setStatus("idle");
      setTracks([]);
      setMicrophoneEnabled(false);
      setCameraEnabled(false);
      setScreenShareEnabled(false);
      setErrorMessage(null);
      return;
    }

    let isCancelled = false;
    const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = nextRoom;
    setStatus("connecting");
    setErrorMessage(null);

    function syncRoomState() {
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
        setStatus("connecting");
      }
    });

    nextRoom.on(RoomEvent.Disconnected, () => {
      if (!isCancelled) {
        setStatus("idle");
        setTracks([]);
      }
    });

    void (async () => {
      try {
        await nextRoom.connect(connection.url, connection.token);
        await nextRoom.startAudio().catch(() => undefined);

        if (connection.canPublishMedia) {
          await nextRoom.localParticipant.setMicrophoneEnabled(true);
          if (mode === "VIDEO") {
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
  }, [connection, mode]);

  async function toggleMicrophone() {
    const room = roomRef.current;
    if (!room || !connection?.canPublishMedia) {
      return;
    }

    await room.localParticipant.setMicrophoneEnabled(!microphoneEnabled);
    setMicrophoneEnabled(!microphoneEnabled);
  }

  async function toggleCamera() {
    const room = roomRef.current;
    if (!room || !connection?.canPublishMedia) {
      return;
    }

    await room.localParticipant.setCameraEnabled(!cameraEnabled);
    setCameraEnabled(!cameraEnabled);
  }

  async function toggleScreenShare() {
    const room = roomRef.current;
    if (!room || !connection?.canPublishMedia) {
      return;
    }

    await room.localParticipant.setScreenShareEnabled(!screenShareEnabled);
    setScreenShareEnabled(!screenShareEnabled);
  }

  async function leaveRoom() {
    const room = roomRef.current;
    setIsLeaving(true);

    try {
      if (room) {
        room.disconnect();
      }
      await onLeave();
      setStatus("idle");
      setTracks([]);
    } finally {
      setIsLeaving(false);
    }
  }

  const screenTracks = useMemo(
    () => tracks.filter((item) => item.kind === "video" && isScreenShareTrack(item)),
    [tracks],
  );
  const cameraTracks = useMemo(
    () => tracks.filter((item) => item.kind === "video" && !isScreenShareTrack(item)),
    [tracks],
  );
  const audioTracks = useMemo(
    () =>
      tracks.filter(
        (item) =>
          item.kind === "audio" &&
          (isMicrophoneTrack(item) || !item.source.toLowerCase().includes("screen")),
      ),
    [tracks],
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

  if (!connection) {
    return null;
  }

  return (
    <div className="premium-panel rounded-[24px] p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">{title}</span>
            <span className="status-pill">{mode}</span>
            <span className="status-pill">{status}</span>
            {screenTracks.length > 0 ? (
              <span className="status-pill">
                <Monitor {...iconProps} />
                Screen share active
              </span>
            ) : null}
            {!connection.canPublishMedia ? (
              <span className="status-pill">Listen only</span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            size="sm"
            variant={microphoneEnabled ? "secondary" : "ghost"}
            onClick={() => void toggleMicrophone()}
            disabled={!connection.canPublishMedia}
            className="justify-start"
          >
            {microphoneEnabled ? <Mic {...iconProps} /> : <MicOff {...iconProps} />}
            {microphoneEnabled ? "Mic on" : "Mic off"}
          </Button>
          <Button
            size="sm"
            variant={cameraEnabled ? "secondary" : "ghost"}
            onClick={() => void toggleCamera()}
            disabled={!connection.canPublishMedia}
            className="justify-start"
          >
            {cameraEnabled ? <Video {...iconProps} /> : <VideoOff {...iconProps} />}
            {cameraEnabled ? "Camera" : "Camera off"}
          </Button>
          <Button
            size="sm"
            variant={screenShareEnabled ? "secondary" : "ghost"}
            onClick={() => void toggleScreenShare()}
            disabled={!connection.canPublishMedia}
            className="justify-start"
          >
            {screenShareEnabled ? (
              <MonitorX {...iconProps} />
            ) : (
              <MonitorUp {...iconProps} />
            )}
            {screenShareEnabled ? "Stop share" : "Share"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void leaveRoom()}
            disabled={isLeaving}
            className="justify-start"
          >
            <PhoneOff {...iconProps} />
            {isLeaving ? "Leaving..." : "Leave"}
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_320px]">
        <div className="space-y-3">
          {primaryTrack ? (
            <TrackSurface item={primaryTrack} emphasis="stage" />
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-white/6 bg-[radial-gradient(circle_at_top,rgba(124,140,255,0.12),transparent_28%),var(--bg-panel-muted)] px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/8 bg-white/5 text-[var(--accent)]">
                <Waves size={24} strokeWidth={1.5} />
              </div>
              <p className="mt-4 text-sm font-medium text-white">Call scene is ready</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-dim)]">
                As soon as a camera or screen track is published, it will appear here.
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

        <div className="space-y-3">
          <div className="surface-subtle rounded-[22px] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Participants</p>
              <span className="text-xs text-[var(--text-muted)]">
                {new Set(tracks.map((item) => item.participantName)).size || 1} live
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {audioTracks.length === 0 && cameraTracks.length === 0 && screenTracks.length === 0 ? (
                <div className="rounded-[18px] border border-white/6 bg-black/10 px-3 py-4 text-center text-sm text-[var(--text-dim)]">
                  Waiting for participants...
                </div>
              ) : (
                audioTracks.map((item) => (
                  <TrackSurface key={item.id} item={item} />
                ))
              )}
            </div>
          </div>

          <div className="surface-subtle rounded-[22px] p-3">
            <p className="text-sm font-medium text-white">Live state</p>
            <div className="mt-3 grid gap-2 text-sm text-[var(--text-dim)]">
              <div className="flex items-center justify-between gap-3 rounded-[16px] border border-white/6 bg-black/10 px-3 py-2.5">
                <span>Connection</span>
                <span className="text-[var(--text-soft)]">{status}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[16px] border border-white/6 bg-black/10 px-3 py-2.5">
                <span>Microphone</span>
                <span className="text-[var(--text-soft)]">
                  {microphoneEnabled ? "Live" : "Muted"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[16px] border border-white/6 bg-black/10 px-3 py-2.5">
                <span>Camera</span>
                <span className="text-[var(--text-soft)]">
                  {cameraEnabled ? "Publishing" : "Off"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[16px] border border-white/6 bg-black/10 px-3 py-2.5">
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
