"use client";

import type { CallMode } from "@lobby/shared";
import { Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type Participant } from "livekit-client";
import { Button } from "@/components/ui/button";

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

function TrackTile({ item }: { item: TrackView }) {
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

    if (element instanceof HTMLVideoElement) {
      element.className = "h-full w-full rounded-[16px] object-cover";
      element.playsInline = true;
      element.muted = item.isLocal;
    } else {
      element.className = "hidden";
    }

    item.track.attach(element);
    container.appendChild(element);

    return () => {
      item.track.detach(element);
      element.remove();
    };
  }, [item]);

  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-white/[0.03] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{item.participantName}</p>
          <p className="truncate text-xs text-[var(--text-dim)]">
            {item.isLocal ? "local" : "remote"} · {item.source}
          </p>
        </div>
        <span className="glass-badge">{item.kind}</span>
      </div>
      <div
        ref={containerRef}
        className="relative flex min-h-[136px] items-center justify-center overflow-hidden rounded-[14px] bg-black/30"
      >
        {item.kind === "audio" ? (
          <span className="text-sm text-[var(--text-dim)]">Аудиопоток активен</span>
        ) : null}
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
          await nextRoom.disconnect();
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
              : "Не удалось подключиться к комнате LiveKit",
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

  if (!connection) {
    return null;
  }

  return (
    <div className="premium-panel rounded-[18px] p-3">
      <div className="compact-toolbar">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-[var(--text-dim)]">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="glass-badge">{mode}</span>
          <span className="glass-badge">{status}</span>
          {!connection.canPublishMedia ? (
            <span className="glass-badge">listen only</span>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-2.5 rounded-[14px] border border-rose-400/20 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-2.5 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void toggleMicrophone()}
          disabled={!connection.canPublishMedia}
        >
          {microphoneEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          {microphoneEnabled ? "Mic on" : "Mic off"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void toggleCamera()}
          disabled={!connection.canPublishMedia}
        >
          {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          {cameraEnabled ? "Camera on" : "Camera off"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void toggleScreenShare()}
          disabled={!connection.canPublishMedia}
        >
          {screenShareEnabled ? (
            <MonitorX className="h-4 w-4" />
          ) : (
            <MonitorUp className="h-4 w-4" />
          )}
          {screenShareEnabled ? "Stop share" : "Share screen"}
        </Button>
        <Button size="sm" onClick={() => void leaveRoom()} disabled={isLeaving}>
          <PhoneOff className="h-4 w-4" />
          {isLeaving ? "Выходим..." : "Выйти"}
        </Button>
      </div>

      {tracks.length === 0 ? (
        <div className="mt-2.5 rounded-[14px] border border-[var(--border)] bg-white/[0.03] p-3 text-sm text-[var(--text-dim)]">
          Ожидаем медиапотоки...
        </div>
      ) : (
        <div className="mt-2.5 grid gap-2.5 xl:grid-cols-2">
          {tracks.map((item) => (
            <TrackTile key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
