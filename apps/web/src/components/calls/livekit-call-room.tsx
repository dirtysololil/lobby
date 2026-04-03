"use client";

import type { CallMode } from "@lobby/shared";
import { Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type Participant } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      if (!publication.track) continue;
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
  for (const participant of room.remoteParticipants.values()) appendParticipantTracks(participant, false);

  const localPublications = [...room.localParticipant.trackPublications.values()];

  return {
    items,
    hasMicrophone: localPublications.some((publication) => publication.source === Track.Source.Microphone && publication.track),
    hasCamera: localPublications.some((publication) => publication.source === Track.Source.Camera && publication.track),
    hasScreenShare: localPublications.some((publication) => publication.source === Track.Source.ScreenShare && publication.track),
  };
}

function TrackTile({ item }: { item: TrackView }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const element = item.kind === "video" ? document.createElement("video") : document.createElement("audio");
    element.autoplay = true;
    element.setAttribute("playsinline", "true");

    if (element instanceof HTMLVideoElement) {
      element.className = "h-full w-full rounded-[20px] object-cover";
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
    <div className="rounded-2xl border border-[var(--border)] bg-slate-950/45 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{item.participantName}</p>
          <p className="text-xs text-slate-400">{item.isLocal ? "локальный" : "удалённый"} / {item.source}</p>
        </div>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] uppercase tracking-[0.15em] text-[var(--text-soft)]">{item.kind}</span>
      </div>
      <div ref={containerRef} className="relative flex min-h-[170px] items-center justify-center overflow-hidden rounded-[16px] bg-slate-900/80">
        {item.kind === "audio" ? <span className="text-sm text-slate-400">Аудиопоток активен</span> : null}
      </div>
    </div>
  );
}

export function LiveKitCallRoom({ connection, mode, title, description, onLeave }: LiveKitCallRoomProps) {
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
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

    const trackedEvents = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted];
    for (const event of trackedEvents) nextRoom.on(event, syncRoomState);

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
          if (mode === "VIDEO") await nextRoom.localParticipant.setCameraEnabled(true);
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
          setErrorMessage(error instanceof Error ? error.message : "Не удалось подключиться к комнате LiveKit");
        }
      }
    })();

    return () => {
      isCancelled = true;
      for (const event of trackedEvents) nextRoom.off(event, syncRoomState);
      nextRoom.disconnect();
      if (roomRef.current === nextRoom) roomRef.current = null;
    };
  }, [connection, mode]);

  async function toggleMicrophone() {
    const room = roomRef.current;
    if (!room || !connection?.canPublishMedia) return;
    await room.localParticipant.setMicrophoneEnabled(!microphoneEnabled);
    setMicrophoneEnabled(!microphoneEnabled);
  }

  async function toggleCamera() {
    const room = roomRef.current;
    if (!room || !connection?.canPublishMedia) return;
    await room.localParticipant.setCameraEnabled(!cameraEnabled);
    setCameraEnabled(!cameraEnabled);
  }

  async function toggleScreenShare() {
    const room = roomRef.current;
    if (!room || !connection?.canPublishMedia) return;
    await room.localParticipant.setScreenShareEnabled(!screenShareEnabled);
    setScreenShareEnabled(!screenShareEnabled);
  }

  async function leaveRoom() {
    const room = roomRef.current;
    setIsLeaving(true);
    try {
      if (room) room.disconnect();
      await onLeave();
      setStatus("idle");
      setTracks([]);
    } finally {
      setIsLeaving(false);
    }
  }

  if (!connection) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[var(--text-soft)]">{mode}</span>
          <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-slate-300">{status}</span>
          {!connection.canPublishMedia ? <span className="rounded-full border border-amber-300/20 px-2.5 py-1 text-amber-100/80">только прослушивание</span> : null}
        </div>

        {errorMessage ? <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div> : null}

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Button variant="secondary" onClick={() => void toggleMicrophone()} disabled={!connection.canPublishMedia}>{microphoneEnabled ? <Mic className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}{microphoneEnabled ? "Выключить микрофон" : "Включить микрофон"}</Button>
          <Button variant="secondary" onClick={() => void toggleCamera()} disabled={!connection.canPublishMedia}>{cameraEnabled ? <Video className="mr-2 h-4 w-4" /> : <VideoOff className="mr-2 h-4 w-4" />}{cameraEnabled ? "Выключить камеру" : "Включить камеру"}</Button>
          <Button variant="secondary" onClick={() => void toggleScreenShare()} disabled={!connection.canPublishMedia}>{screenShareEnabled ? <MonitorX className="mr-2 h-4 w-4" /> : <MonitorUp className="mr-2 h-4 w-4" />}{screenShareEnabled ? "Остановить показ" : "Показать экран"}</Button>
          <Button onClick={() => void leaveRoom()} disabled={isLeaving}><PhoneOff className="mr-2 h-4 w-4" />{isLeaving ? "Выходим..." : "Выйти"}</Button>
        </div>

        {tracks.length === 0 ? <div className="rounded-2xl border border-[var(--border)] bg-slate-950/40 p-4 text-sm text-slate-400">Ожидаем медиапотоки...</div> : <div className="grid gap-3 xl:grid-cols-2">{tracks.map((item) => <TrackTile key={item.id} item={item} />)}</div>}
      </CardContent>
    </Card>
  );
}
