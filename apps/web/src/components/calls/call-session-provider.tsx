"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  LoaderCircle,
  Mic,
  MicOff,
  Monitor,
  MonitorUp,
  MonitorX,
  PhoneCall,
  PhoneOff,
  Settings2,
  Sparkles,
  Users2,
  Video,
  VideoOff,
  Volume2,
  Waves,
} from "lucide-react";
import type { CallParticipant, CallSummary, PublicUser } from "@lobby/shared";
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
import {
  LocalAudioTrack,
  Room,
  RoomEvent,
  Track,
  supportsAudioOutputSelection,
  type Participant,
} from "livekit-client";
import { apiClientFetch } from "@/lib/api-client";
import {
  callModeLabels,
  callParticipantStateLabels,
  callStatusLabels,
} from "@/lib/ui-labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useRealtime } from "@/components/realtime/realtime-provider";
import {
  createVoiceEffectProcessor,
  type VoiceEffectPreset,
  voiceEffectLabels,
} from "./voice-effects";

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
  participantId: string;
  participantName: string;
  source: string;
  kind: "audio" | "video";
  isLocal: boolean;
  track: Track;
}

interface ParticipantPresenceView {
  id: string;
  name: string;
  user: PublicUser | null;
  state: CallParticipant["state"] | null;
  isLocal: boolean;
  isConnected: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  hasAudio: boolean;
  hasCamera: boolean;
  hasScreenShare: boolean;
  audioLevel: number;
  connectionQuality: string;
}

interface CallSessionContextValue {
  session: ActiveCallSession | null;
  status: CallConnectionStatus;
  errorMessage: string | null;
  tracks: TrackView[];
  participants: ParticipantPresenceView[];
  participantCount: number;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  inputDevices: MediaDeviceInfo[];
  outputDevices: MediaDeviceInfo[];
  selectedInputDeviceId: string | null;
  selectedOutputDeviceId: string | null;
  outputSelectionSupported: boolean;
  deviceError: string | null;
  voiceEffect: VoiceEffectPreset;
  effectError: string | null;
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
  setInputDevice: (deviceId: string) => Promise<void>;
  setOutputDevice: (deviceId: string) => Promise<void>;
  setVoiceEffect: (effect: VoiceEffectPreset) => Promise<void>;
}

const CallSessionContext = createContext<CallSessionContextValue | null>(null);

const connectionStatusLabels: Record<CallConnectionStatus, string> = {
  idle: "Не подключено",
  connecting: "Подключаемся",
  connected: "На связи",
  reconnecting: "Переподключаемся",
  error: "Ошибка",
};

const connectionQualityLabels: Record<string, string> = {
  excellent: "Связь отличная",
  good: "Связь нормальная",
  poor: "Связь слабая",
  lost: "Связь потеряна",
  unknown: "Статус неизвестен",
  offline: "Не в комнате",
};

function collectTrackViews(room: Room) {
  const items: TrackView[] = [];

  function appendParticipantTracks(participant: Participant, isLocal: boolean) {
    for (const publication of participant.trackPublications.values()) {
      if (!publication.track) {
        continue;
      }

      items.push({
        id: `${participant.identity}:${publication.trackSid ?? publication.source}`,
        participantId: participant.identity,
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


function getConnectionQualityLabel(value: string) {
  return connectionQualityLabels[value] ?? "Статус неизвестен";
}

function getDeviceLabel(
  device: MediaDeviceInfo,
  fallbackPrefix: string,
  index: number,
) {
  return device.label || `${fallbackPrefix} ${index + 1}`;
}

function getSinkableAudioElement(element: HTMLAudioElement) {
  return element as HTMLAudioElement & {
    setSinkId?: (deviceId: string) => Promise<void>;
  };
}

async function applySinkIdToAudioElement(
  element: HTMLAudioElement,
  deviceId: string | null,
) {
  if (!deviceId) {
    return;
  }

  const sinkableElement = getSinkableAudioElement(element);
  if (typeof sinkableElement.setSinkId !== "function") {
    return;
  }

  await sinkableElement.setSinkId(deviceId);
}

function findCallParticipant(
  call: CallSummary,
  participant: Participant,
): CallParticipant | null {
  const candidateName = participant.name?.trim() ?? null;

  return (
    call.participants.find((item) => {
      return (
        item.user.id === participant.identity ||
        item.user.username === participant.identity ||
        item.user.username === candidateName ||
        item.user.profile.displayName === candidateName
      );
    }) ?? null
  );
}

function collectParticipantViews(room: Room, call: CallSummary) {
  const connectedParticipants: ParticipantPresenceView[] = [];
  const liveParticipants: Participant[] = [
    room.localParticipant,
    ...room.remoteParticipants.values(),
  ];

  for (const participant of liveParticipants) {
    const callParticipant = findCallParticipant(call, participant);
    const microphonePublication =
      participant.getTrackPublication(Track.Source.Microphone) ??
      participant.audioTrackPublications.values().next().value ??
      undefined;
    const cameraPublication = participant.getTrackPublication(Track.Source.Camera);
    const screenPublication = participant.getTrackPublication(Track.Source.ScreenShare);

    connectedParticipants.push({
      id: callParticipant?.user.id ?? participant.identity,
      name:
        callParticipant?.user.profile.displayName ??
        participant.name ??
        participant.identity,
      user: callParticipant?.user ?? null,
      state: callParticipant?.state ?? null,
      isLocal: participant === room.localParticipant,
      isConnected: true,
      isSpeaking: participant.isSpeaking,
      isMuted: microphonePublication?.isMuted ?? !microphonePublication?.track,
      hasAudio: Boolean(microphonePublication?.track),
      hasCamera: Boolean(cameraPublication?.track),
      hasScreenShare: Boolean(screenPublication?.track),
      audioLevel: participant.audioLevel,
      connectionQuality: String(participant.connectionQuality ?? "unknown").toLowerCase(),
    });
  }

  const seenIds = new Set(connectedParticipants.map((participant) => participant.id));

  const waitingParticipants = call.participants
    .filter((participant) => !seenIds.has(participant.user.id))
    .map<ParticipantPresenceView>((participant) => ({
      id: participant.user.id,
      name: participant.user.profile.displayName,
      user: participant.user,
      state: participant.state,
      isLocal: false,
      isConnected: false,
      isSpeaking: false,
      isMuted: true,
      hasAudio: false,
      hasCamera: false,
      hasScreenShare: false,
      audioLevel: 0,
      connectionQuality: "offline",
    }));

  return [...connectedParticipants, ...waitingParticipants].sort((left, right) => {
    if (left.isLocal !== right.isLocal) {
      return left.isLocal ? -1 : 1;
    }

    if (left.isConnected !== right.isConnected) {
      return left.isConnected ? -1 : 1;
    }

    if (left.isSpeaking !== right.isSpeaking) {
      return left.isSpeaking ? -1 : 1;
    }

    if (left.hasScreenShare !== right.hasScreenShare) {
      return left.hasScreenShare ? -1 : 1;
    }

    if (left.hasCamera !== right.hasCamera) {
      return left.hasCamera ? -1 : 1;
    }

    return left.name.localeCompare(right.name, "ru-RU");
  });
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

function getLocalMicrophoneTrack(room: Room | null) {
  const publication = room?.localParticipant.getTrackPublication(Track.Source.Microphone);

  if (!publication?.track || publication.track.kind !== Track.Kind.Audio) {
    return null;
  }

  return publication.track as LocalAudioTrack;
}

export function CallSessionProvider({ children }: { children: ReactNode }) {
  const { latestSignal } = useRealtime();
  const roomRef = useRef<Room | null>(null);
  const desiredVoiceEffectRef = useRef<VoiceEffectPreset>("normal");
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<ActiveCallSession | null>(null);
  const statusRef = useRef<CallConnectionStatus>("idle");
  const selectedInputDeviceIdRef = useRef<string | null>(null);
  const selectedOutputDeviceIdRef = useRef<string | null>(null);
  const roomStateSyncRef = useRef<(() => void) | null>(null);
  const pendingConnectCallIdRef = useRef<string | null>(null);
  const [session, setSession] = useState<ActiveCallSession | null>(null);
  const [status, setStatus] = useState<CallConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackView[]>([]);
  const [participants, setParticipants] = useState<ParticipantPresenceView[]>([]);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState<string | null>(
    null,
  );
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string | null>(
    null,
  );
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [voiceEffect, setVoiceEffectState] = useState<VoiceEffectPreset>("normal");
  const [effectError, setEffectError] = useState<string | null>(null);
  const outputSelectionSupported = useMemo(() => supportsAudioOutputSelection(), []);
  const connectionKey = useMemo(() => {
    if (!session) {
      return null;
    }

    return [
      session.call.id,
      session.connection.callId,
      session.connection.url,
      session.connection.roomName,
      session.connection.token,
    ].join(":");
  }, [
    session?.call.id,
    session?.connection.callId,
    session?.connection.roomName,
    session?.connection.token,
    session?.connection.url,
  ]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    selectedInputDeviceIdRef.current = selectedInputDeviceId;
  }, [selectedInputDeviceId]);

  useEffect(() => {
    selectedOutputDeviceIdRef.current = selectedOutputDeviceId;
  }, [selectedOutputDeviceId]);

  const clearRoomSnapshot = useCallback((nextStatus: CallConnectionStatus = "idle") => {
    setStatus(nextStatus);
    setTracks([]);
    setParticipants([]);
    setMicrophoneEnabled(false);
    setCameraEnabled(false);
    setScreenShareEnabled(false);
    setInputDevices([]);
    setOutputDevices([]);
    if (nextStatus !== "error") {
      setErrorMessage(null);
      setDeviceError(null);
      setEffectError(null);
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

        pendingConnectCallIdRef.current = null;
        roomStateSyncRef.current = null;
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
      const currentSession = sessionRef.current;
      const sameCall = currentSession?.call.id === request.callId;
      const connectionInProgress = ["connecting", "connected", "reconnecting"].includes(
        statusRef.current,
      );

      if (sameCall && (roomRef.current || connectionInProgress)) {
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

      if (pendingConnectCallIdRef.current === request.callId) {
        return;
      }

      pendingConnectCallIdRef.current = request.callId;

      try {
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
      } finally {
        if (pendingConnectCallIdRef.current === request.callId) {
          pendingConnectCallIdRef.current = null;
        }
      }
    },
    [],
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
    (callId: string | null | undefined) => Boolean(callId) && session?.call.id === callId,
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

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextCtor) {
      return null;
    }

    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContextCtor();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume().catch(() => undefined);
    }

    return audioContextRef.current;
  }, []);

  const refreshDevices = useCallback(
    async (currentRoom = roomRef.current) => {
      if (!currentRoom) {
        setInputDevices([]);
        setOutputDevices([]);
        return;
      }

      try {
        const [nextInputs, nextOutputs] = await Promise.all([
          Room.getLocalDevices("audioinput", false),
          outputSelectionSupported
            ? Room.getLocalDevices("audiooutput", false)
            : Promise.resolve([]),
        ]);

        setInputDevices(nextInputs);
        setOutputDevices(nextOutputs);

        const microphoneTrack = getLocalMicrophoneTrack(currentRoom);
        const activeInputDeviceId =
          (await microphoneTrack?.getDeviceId(true).catch(() => undefined)) ??
          selectedInputDeviceIdRef.current ??
          nextInputs[0]?.deviceId ??
          null;

        setSelectedInputDeviceId(activeInputDeviceId);

        if (outputSelectionSupported) {
          setSelectedOutputDeviceId((current) => current ?? nextOutputs[0]?.deviceId ?? null);
        }

        setDeviceError(null);
      } catch (error) {
        setDeviceError(
          error instanceof Error
            ? error.message
            : "Не удалось обновить список устройств.",
        );
      }
    },
    [outputSelectionSupported],
  );

  const applyVoiceEffect = useCallback(
    async (
      nextEffect: VoiceEffectPreset,
      currentRoom = roomRef.current,
      updateSelection = true,
    ) => {
      desiredVoiceEffectRef.current = nextEffect;

      if (updateSelection) {
        setVoiceEffectState(nextEffect);
      }

      const microphoneTrack = getLocalMicrophoneTrack(currentRoom);

      if (!microphoneTrack) {
        setEffectError(null);
        return;
      }

      try {
        if (nextEffect === "normal") {
          await microphoneTrack.stopProcessor().catch(() => undefined);
          setEffectError(null);
          return;
        }

        const audioContext = await ensureAudioContext();
        if (!audioContext) {
          throw new Error(
            "Этот браузер не поддерживает обработку голоса. Используется обычный микрофон.",
          );
        }

        microphoneTrack.setAudioContext(audioContext);
        await microphoneTrack.setProcessor(createVoiceEffectProcessor(nextEffect));
        setEffectError(null);
      } catch (error) {
        setEffectError(
          error instanceof Error
            ? error.message
            : "Не удалось включить эффект голоса. Оставляем обычный микрофон.",
        );
        desiredVoiceEffectRef.current = "normal";
        setVoiceEffectState("normal");
        await microphoneTrack.stopProcessor().catch(() => undefined);
      }
    },
    [ensureAudioContext],
  );

  const setInputDevice = useCallback(
    async (deviceId: string) => {
      setSelectedInputDeviceId(deviceId);
      setDeviceError(null);

      const room = roomRef.current;
      if (!room || !session?.connection.canPublishMedia || !microphoneEnabled) {
        return;
      }

      try {
        const switched = await room.switchActiveDevice("audioinput", deviceId, true);
        if (!switched) {
          throw new Error("Браузер не дал переключить микрофон.");
        }

        await refreshDevices(room);
        await applyVoiceEffect(desiredVoiceEffectRef.current, room, false);
      } catch (error) {
        setDeviceError(
          error instanceof Error ? error.message : "Не удалось переключить микрофон.",
        );
      }
    },
    [
      applyVoiceEffect,
      microphoneEnabled,
      refreshDevices,
      session?.connection.canPublishMedia,
    ],
  );

  const setOutputDevice = useCallback(
    async (deviceId: string) => {
      setSelectedOutputDeviceId(deviceId);

      if (!outputSelectionSupported) {
        setDeviceError(
          "Переключение вывода недоступно в этом браузере. Используем системный динамик.",
        );
        return;
      }

      const room = roomRef.current;
      if (!room) {
        return;
      }

      try {
        const switched = await room.switchActiveDevice("audiooutput", deviceId);
        if (!switched) {
          throw new Error("Браузер не дал переключить устройство вывода.");
        }

        setDeviceError(null);
      } catch (error) {
        setDeviceError(
          error instanceof Error
            ? error.message
            : "Не удалось переключить устройство вывода.",
        );
      }
    },
    [outputSelectionSupported],
  );

  const setVoiceEffect = useCallback(
    async (effect: VoiceEffectPreset) => {
      await applyVoiceEffect(effect);
    },
    [applyVoiceEffect],
  );

  useEffect(() => {
    if (!latestSignal || !session?.call.id || latestSignal.call.id !== session.call.id) {
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
    if (!connectionKey) {
      roomStateSyncRef.current = null;
      roomRef.current?.disconnect();
      roomRef.current = null;
      clearRoomSnapshot();
      return;
    }

    const activeSession = sessionRef.current;
    if (!activeSession) {
      return;
    }

    const activeSessionCallId = activeSession.call.id;
    const activeSessionMode = activeSession.call.mode;
    const activeSessionConnection = activeSession.connection;
    let isCancelled = false;
    const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = nextRoom;
    setStatus("connecting");
    setErrorMessage(null);

    function syncRoomState() {
      if (isCancelled) {
        return;
      }

      const currentSession = sessionRef.current;
      if (!currentSession || currentSession.call.id !== activeSessionCallId) {
        return;
      }

      const snapshot = collectTrackViews(nextRoom);
      setTracks(snapshot.items);
      setParticipants(collectParticipantViews(nextRoom, currentSession.call));
      setMicrophoneEnabled(snapshot.hasMicrophone);
      setCameraEnabled(snapshot.hasCamera);
      setScreenShareEnabled(snapshot.hasScreenShare);
    }

    roomStateSyncRef.current = syncRoomState;

    const trackedEvents = [
      RoomEvent.Connected,
      RoomEvent.Reconnected,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.ActiveSpeakersChanged,
      RoomEvent.ConnectionQualityChanged,
    ];

    for (const event of trackedEvents) {
      nextRoom.on(event, syncRoomState);
    }

    const handleMediaDevicesChanged = () => {
      void refreshDevices(nextRoom);
    };

    const handleLocalTrackChanged = () => {
      syncRoomState();
      void refreshDevices(nextRoom);

      if (desiredVoiceEffectRef.current !== "normal") {
        void applyVoiceEffect(desiredVoiceEffectRef.current, nextRoom, false);
      }
    };

    nextRoom.on(RoomEvent.LocalTrackPublished, handleLocalTrackChanged);
    nextRoom.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackChanged);
    nextRoom.on(RoomEvent.MediaDevicesChanged, handleMediaDevicesChanged);
    nextRoom.on(RoomEvent.MediaDevicesError, (error) => {
      if (!isCancelled) {
        setDeviceError(error.message);
      }
    });

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
        await nextRoom.connect(
          activeSessionConnection.url,
          activeSessionConnection.token,
        );
        await nextRoom.startAudio().catch(() => undefined);

        if (selectedOutputDeviceIdRef.current && outputSelectionSupported) {
          await nextRoom
            .switchActiveDevice("audiooutput", selectedOutputDeviceIdRef.current)
            .catch(() => false);
        }

        if (activeSessionConnection.canPublishMedia) {
          try {
            await nextRoom.localParticipant.setMicrophoneEnabled(
              true,
              selectedInputDeviceIdRef.current
                ? { deviceId: { exact: selectedInputDeviceIdRef.current } }
                : undefined,
            );
          } catch {
            await nextRoom.localParticipant.setMicrophoneEnabled(true);
          }

          if (activeSessionMode === "VIDEO") {
            await nextRoom.localParticipant.setCameraEnabled(true);
          }
        }

        if (isCancelled) {
          nextRoom.disconnect();
          return;
        }

        await refreshDevices(nextRoom);
        await applyVoiceEffect(desiredVoiceEffectRef.current, nextRoom, false);
        syncRoomState();
        setStatus("connected");
      } catch (error) {
        if (!isCancelled) {
          setStatus("error");
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось подключиться к голосовой комнате.",
          );
        }
      }
    })();

    return () => {
      isCancelled = true;
      for (const event of trackedEvents) {
        nextRoom.off(event, syncRoomState);
      }
      nextRoom.off(RoomEvent.LocalTrackPublished, handleLocalTrackChanged);
      nextRoom.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackChanged);
      nextRoom.off(RoomEvent.MediaDevicesChanged, handleMediaDevicesChanged);
      if (roomStateSyncRef.current === syncRoomState) {
        roomStateSyncRef.current = null;
      }
      nextRoom.disconnect();
      if (roomRef.current === nextRoom) {
        roomRef.current = null;
      }
    };
  }, [
    applyVoiceEffect,
    clearRoomSnapshot,
    connectionKey,
    outputSelectionSupported,
    refreshDevices,
  ]);

  useEffect(() => {
    roomStateSyncRef.current?.();
  }, [session?.call]);

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      roomRef.current = null;
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;

    if (!room || !session?.connection.canPublishMedia) {
      return;
    }

    if (!microphoneEnabled) {
      try {
        await room.localParticipant.setMicrophoneEnabled(
          true,
          selectedInputDeviceId ? { deviceId: { exact: selectedInputDeviceId } } : undefined,
        );
      } catch {
        await room.localParticipant.setMicrophoneEnabled(true);
      }

      setMicrophoneEnabled(true);
      await refreshDevices(room);
      await applyVoiceEffect(desiredVoiceEffectRef.current, room, false);
      return;
    }

    await room.localParticipant.setMicrophoneEnabled(false);
    setMicrophoneEnabled(false);
  }, [
    applyVoiceEffect,
    microphoneEnabled,
    refreshDevices,
    selectedInputDeviceId,
    session?.connection.canPublishMedia,
  ]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;

    if (!room || !session?.connection.canPublishMedia) {
      return;
    }

    await room.localParticipant.setCameraEnabled(!cameraEnabled);
    setCameraEnabled(!cameraEnabled);
  }, [cameraEnabled, session?.connection.canPublishMedia]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;

    if (!room || !session?.connection.canPublishMedia) {
      return;
    }

    await room.localParticipant.setScreenShareEnabled(!screenShareEnabled);
    setScreenShareEnabled(!screenShareEnabled);
  }, [screenShareEnabled, session?.connection.canPublishMedia]);

  const participantCount = useMemo(() => {
    if (!session) {
      return 0;
    }

    const connectedBySnapshot = participants.filter((participant) => participant.isConnected)
      .length;

    return Math.max(connectedBySnapshot, getConnectedParticipantCount(session.call), 1);
  }, [participants, session]);

  const value = useMemo<CallSessionContextValue>(
    () => ({
      session,
      status,
      errorMessage,
      tracks,
      participants,
      participantCount,
      microphoneEnabled,
      cameraEnabled,
      screenShareEnabled,
      inputDevices,
      outputDevices,
      selectedInputDeviceId,
      selectedOutputDeviceId,
      outputSelectionSupported,
      deviceError,
      voiceEffect,
      effectError,
      connectToCall,
      syncCall,
      isActiveCall,
      leaveCall,
      dismissCall,
      toggleMicrophone,
      toggleCamera,
      toggleScreenShare,
      setInputDevice,
      setOutputDevice,
      setVoiceEffect,
    }),
    [
      session,
      status,
      errorMessage,
      tracks,
      participants,
      participantCount,
      microphoneEnabled,
      cameraEnabled,
      screenShareEnabled,
      inputDevices,
      outputDevices,
      selectedInputDeviceId,
      selectedOutputDeviceId,
      outputSelectionSupported,
      deviceError,
      voiceEffect,
      effectError,
      connectToCall,
      syncCall,
      isActiveCall,
      leaveCall,
      dismissCall,
      toggleMicrophone,
      toggleCamera,
      toggleScreenShare,
      setInputDevice,
      setOutputDevice,
      setVoiceEffect,
    ],
  );

  return (
    <CallSessionContext.Provider value={value}>
      {children}
      <PersistentAudioSink />
    </CallSessionContext.Provider>
  );
}

export function useCallSession() {
  const value = useContext(CallSessionContext);

  if (!value) {
    throw new Error("useCallSession must be used inside CallSessionProvider");
  }

  return value;
}

function AvatarOrInitials({
  user,
  name,
  size = "sm",
}: {
  user: PublicUser | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  if (user) {
    return <UserAvatar user={user} size={size} />;
  }

  const sizeClasses = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-9 w-9 text-[11px]",
    lg: "h-12 w-12 text-sm",
  } as const;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border border-white/8 bg-white/6 font-semibold uppercase tracking-[0.06em] text-white",
        sizeClasses[size],
      )}
    >
      {getParticipantInitials(name)}
    </div>
  );
}

function PersistentAudioSink() {
  const { session, tracks, selectedOutputDeviceId } = useCallSession();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const attachedElementsRef = useRef(
    new Map<string, { element: HTMLAudioElement; track: Track }>(),
  );

  const remoteAudioTracks = tracks.filter((item) => item.kind === "audio" && !item.isLocal);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !session) {
      return;
    }

    let cancelled = false;
    const activeTrackIds = new Set(remoteAudioTracks.map((track) => track.id));

    void (async () => {
      for (const [trackId, attachment] of attachedElementsRef.current.entries()) {
        if (activeTrackIds.has(trackId)) {
          continue;
        }

        attachment.track.detach(attachment.element);
        attachment.element.remove();
        attachedElementsRef.current.delete(trackId);
      }

      for (const item of remoteAudioTracks) {
        if (cancelled) {
          return;
        }

        const existingAttachment = attachedElementsRef.current.get(item.id);

        if (!existingAttachment) {
          const element = document.createElement("audio");
          element.autoplay = true;
          element.setAttribute("playsinline", "true");
          element.className = "hidden";
          await applySinkIdToAudioElement(element, selectedOutputDeviceId).catch(
            () => undefined,
          );
          item.track.attach(element);
          container.appendChild(element);
          void element.play().catch(() => undefined);
          attachedElementsRef.current.set(item.id, { element, track: item.track });
          continue;
        }

        if (existingAttachment.track !== item.track) {
          existingAttachment.track.detach(existingAttachment.element);
          item.track.attach(existingAttachment.element);
          attachedElementsRef.current.set(item.id, {
            element: existingAttachment.element,
            track: item.track,
          });
        }

        await applySinkIdToAudioElement(
          existingAttachment.element,
          selectedOutputDeviceId,
        ).catch(() => undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [remoteAudioTracks, selectedOutputDeviceId, session]);

  useEffect(() => {
    if (session) {
      return;
    }

    for (const attachment of attachedElementsRef.current.values()) {
      attachment.track.detach(attachment.element);
      attachment.element.remove();
    }

    attachedElementsRef.current.clear();
  }, [session]);

  return <div ref={containerRef} className="hidden" aria-hidden="true" />;
}

function TrackSurface({
  item,
  emphasis = "tile",
}: {
  item: TrackView;
  emphasis?: "stage" | "conversation" | "tile";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isScreen = isScreenShareTrack(item);
  const isVideoTrack = item.kind === "video";

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !isVideoTrack) {
      return;
    }

    const element = document.createElement("video");
    element.autoplay = true;
    element.setAttribute("playsinline", "true");
    element.muted = item.isLocal;
    element.defaultMuted = item.isLocal;
    element.volume = item.isLocal ? 0 : 1;
    element.playsInline = true;
    element.className =
      emphasis === "stage"
        ? "h-full w-full object-cover"
        : "h-full w-full rounded-[16px] object-cover";

    item.track.attach(element);
    container.appendChild(element);
    void element.play().catch(() => undefined);

    return () => {
      item.track.detach(element);
      element.remove();
    };
  }, [emphasis, isVideoTrack, item]);

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_48%),rgba(8,12,18,0.96)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        emphasis === "stage"
          ? "min-h-[300px] rounded-[22px] xl:min-h-[420px]"
          : emphasis === "conversation"
            ? "min-h-[180px] rounded-[20px] lg:min-h-[240px]"
          : "min-h-[170px] rounded-[18px]",
      )}
    >
      {isVideoTrack ? <div ref={containerRef} className="absolute inset-0" /> : null}

      {!isVideoTrack ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.16),transparent_42%),rgba(9,14,20,0.96)] px-5 text-center">
          <AvatarOrInitials user={null} name={item.participantName} size="lg" />
          <div>
            <p className="text-base font-semibold text-white">{item.participantName}</p>
            <p className="mt-1 text-sm text-[var(--text-dim)]">Голосовой поток активен</p>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-[linear-gradient(180deg,transparent,rgba(5,8,12,0.88))] px-3 pb-3 pt-10">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{item.participantName}</p>
          <p className="truncate text-xs text-[var(--text-soft)]">
            {item.isLocal ? "Вы" : "Участник"} ·{" "}
            {isScreen ? "Демонстрация экрана" : isVideoTrack ? "Камера" : "Голос"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-black/30 px-2 py-1 text-[11px] text-[var(--text-soft)] backdrop-blur-sm">
          {isScreen ? (
            <Monitor size={13} strokeWidth={1.5} />
          ) : isVideoTrack ? (
            <Video size={13} strokeWidth={1.5} />
          ) : (
            <Mic size={13} strokeWidth={1.5} />
          )}
          {isScreen ? "Экран" : isVideoTrack ? "Видео" : "Аудио"}
        </span>
      </div>
    </div>
  );
}

function ParticipantRow({ participant }: { participant: ParticipantPresenceView }) {
  const secondaryLabel = participant.isConnected
    ? participant.isSpeaking
      ? "Говорит сейчас"
      : participant.isLocal
        ? "Вы в комнате"
        : getConnectionQualityLabel(participant.connectionQuality)
    : participant.state
      ? callParticipantStateLabels[participant.state]
      : "Ожидает подключения";

  return (
    <div className="rounded-[16px] border border-white/6 bg-black/10 px-3 py-2.5">
      <div className="flex items-start gap-3">
        <AvatarOrInitials user={participant.user} name={participant.name} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium text-white">{participant.name}</p>
            {participant.isLocal ? <span className="status-pill">Вы</span> : null}
            {participant.isSpeaking ? (
              <span className="status-pill border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                Говорит
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-dim)]">{secondaryLabel}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "status-pill",
                participant.hasAudio && !participant.isMuted
                  ? "text-emerald-200"
                  : "text-[var(--text-muted)]",
              )}
            >
              {participant.hasAudio && !participant.isMuted ? (
                <Mic size={13} strokeWidth={1.5} />
              ) : (
                <MicOff size={13} strokeWidth={1.5} />
              )}
              {participant.hasAudio && !participant.isMuted ? "Микрофон" : "Без микрофона"}
            </span>
            {participant.hasCamera ? (
              <span className="status-pill">
                <Video size={13} strokeWidth={1.5} />
                Камера
              </span>
            ) : null}
            {participant.hasScreenShare ? (
              <span className="status-pill">
                <Monitor size={13} strokeWidth={1.5} />
                Экран
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function VoicePresenceStage({
  participants,
  participantCount,
  variant = "default",
}: {
  participants: ParticipantPresenceView[];
  participantCount: number;
  variant?: "default" | "conversation";
}) {
  const isConversation = variant === "conversation";

  if (participants.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center border border-white/6 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.12),transparent_28%),rgba(12,18,24,0.96)] text-center",
          isConversation
            ? "min-h-[180px] rounded-[20px] px-5 py-8"
            : "min-h-[300px] rounded-[22px] px-6 xl:min-h-[420px]",
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/8 bg-white/5 text-[var(--accent)]">
          <Waves size={24} strokeWidth={1.5} />
        </div>
        <p className="mt-3 text-base font-semibold text-white">Комната готова</p>
        <p className="mt-1.5 max-w-sm text-sm text-[var(--text-dim)]">
          Подключение уже живёт на уровне приложения. Ждём участников или видео.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border border-white/6 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.12),transparent_26%),rgba(12,18,24,0.96)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        isConversation ? "rounded-[20px] p-3.5" : "rounded-[22px] p-4",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Голосовая сцена</p>
          <p className="mt-1 text-xs text-[var(--text-dim)]">
            {participantCount} участников в комнате
          </p>
        </div>
        <span className="status-pill">
          <Waves size={13} strokeWidth={1.5} />
          Активный звук
        </span>
      </div>

      <div
        className={cn(
          "grid gap-3",
          isConversation
            ? "mt-3 sm:grid-cols-2 xl:grid-cols-2"
            : "mt-4 sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {participants.map((participant) => (
          <div
            key={participant.id}
            className={cn(
              "border border-white/6 bg-black/12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
              isConversation ? "rounded-[16px] px-3 py-3" : "rounded-[18px] px-4 py-4",
              participant.isSpeaking && "border-emerald-400/25 bg-emerald-400/8",
            )}
          >
            <div className="mx-auto flex w-fit flex-col items-center">
              <div
                className={cn(
                  "rounded-full p-1.5",
                  participant.isSpeaking && "bg-emerald-400/10 shadow-[0_0_0_6px_rgba(16,185,129,0.08)]",
                )}
              >
                <AvatarOrInitials
                  user={participant.user}
                  name={participant.name}
                  size="lg"
                />
              </div>
            </div>
            <p className="mt-3 truncate text-sm font-medium text-white">{participant.name}</p>
            <p className="mt-1 text-xs text-[var(--text-dim)]">
              {participant.isSpeaking
                ? "Говорит"
                : participant.isConnected
                  ? participant.isLocal
                    ? "Вы в комнате"
                    : getConnectionQualityLabel(participant.connectionQuality)
                  : participant.state
                    ? callParticipantStateLabels[participant.state]
                    : "Ожидает подключения"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AudioAndDeviceCard() {
  const {
    session,
    status,
    microphoneEnabled,
    inputDevices,
    outputDevices,
    selectedInputDeviceId,
    selectedOutputDeviceId,
    outputSelectionSupported,
    deviceError,
    voiceEffect,
    effectError,
    setInputDevice,
    setOutputDevice,
    setVoiceEffect,
  } = useCallSession();
  const [pendingAction, setPendingAction] = useState<"input" | "output" | "effect" | null>(
    null,
  );

  if (!session) {
    return null;
  }

  async function handleInputChange(deviceId: string) {
    setPendingAction("input");
    try {
      await setInputDevice(deviceId);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleOutputChange(deviceId: string) {
    setPendingAction("output");
    try {
      await setOutputDevice(deviceId);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleEffectChange(effect: VoiceEffectPreset) {
    setPendingAction("effect");
    try {
      await setVoiceEffect(effect);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="surface-subtle rounded-[20px] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Звук и устройства</p>
          <p className="mt-1 text-xs text-[var(--text-dim)]">
            Меняются без выхода из комнаты
          </p>
        </div>
        {pendingAction ? (
          <LoaderCircle className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
        ) : (
          <Settings2 className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        <div className="rounded-[14px] border border-white/6 bg-black/10 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-dim)]">Связь</span>
            <span className="text-xs text-white">{connectionStatusLabels[status]}</span>
          </div>
        </div>
        <div className="rounded-[14px] border border-white/6 bg-black/10 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-dim)]">Микрофон</span>
            <span className="inline-flex items-center gap-1 text-xs text-white">
              {microphoneEnabled ? (
                <Mic size={13} strokeWidth={1.5} />
              ) : (
                <MicOff size={13} strokeWidth={1.5} />
              )}
              {microphoneEnabled ? "Включён" : "Выключен"}
            </span>
          </div>
        </div>
        <div className="rounded-[14px] border border-white/6 bg-black/10 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[var(--text-dim)]">Вывод</span>
            <span className="inline-flex items-center gap-1 text-xs text-white">
              <Volume2 size={13} strokeWidth={1.5} />
              {outputSelectionSupported ? "Управляется из приложения" : "Системный"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="grid gap-1.5">
          <label className="section-kicker">Вход</label>
          <select
            className="field-select text-sm"
            value={selectedInputDeviceId ?? ""}
            onChange={(event) => void handleInputChange(event.target.value)}
            disabled={!session.connection.canPublishMedia || inputDevices.length === 0}
          >
            {inputDevices.length === 0 ? (
              <option value="">Микрофоны не найдены</option>
            ) : null}
            {inputDevices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {getDeviceLabel(device, "Микрофон", index)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <label className="section-kicker">Вывод</label>
          <select
            className="field-select text-sm"
            value={selectedOutputDeviceId ?? ""}
            onChange={(event) => void handleOutputChange(event.target.value)}
            disabled={!outputSelectionSupported || outputDevices.length === 0}
          >
            {outputDevices.length === 0 ? (
              <option value="">
                {outputSelectionSupported
                  ? "Устройства вывода не найдены"
                  : "Используется системный динамик"}
              </option>
            ) : null}
            {outputDevices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {getDeviceLabel(device, "Вывод", index)}
              </option>
            ))}
          </select>
          {!outputSelectionSupported ? (
            <p className="text-xs text-[var(--text-dim)]">
              Этот браузер не даёт выбрать устройство вывода. Звук идёт через системный
              динамик.
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <label className="section-kicker">Эффект голоса</label>
          <select
            className="field-select text-sm"
            value={voiceEffect}
            onChange={(event) =>
              void handleEffectChange(event.target.value as VoiceEffectPreset)
            }
            disabled={!session.connection.canPublishMedia}
          >
            {(Object.keys(voiceEffectLabels) as VoiceEffectPreset[]).map((effect) => (
              <option key={effect} value={effect}>
                {voiceEffectLabels[effect]}
              </option>
            ))}
          </select>
          <div className="inline-flex items-center gap-2 rounded-[14px] border border-white/6 bg-black/10 px-3 py-2 text-xs text-[var(--text-dim)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            {voiceEffect === "normal"
              ? "Обычный голос без обработки."
              : `Активен пресет «${voiceEffectLabels[voiceEffect]}».`}
          </div>
        </div>
      </div>

      {deviceError ? (
        <div className="mt-3 rounded-[14px] border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
          {deviceError}
        </div>
      ) : null}

      {effectError ? (
        <div className="mt-2 rounded-[14px] border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
          {effectError}
        </div>
      ) : voiceEffect === "normal" ? (
        <div className="mt-2 inline-flex items-center gap-2 rounded-[14px] border border-emerald-400/15 bg-emerald-400/8 px-3 py-2 text-xs text-emerald-100">
          <Check className="h-3.5 w-3.5" />
          Базовый микрофон работает без эффектов.
        </div>
      ) : null}
    </div>
  );
}

function ParticipantsCard({
  participants,
  participantCount,
}: {
  participants: ParticipantPresenceView[];
  participantCount: number;
}) {
  return (
    <div className="surface-subtle flex min-h-0 flex-col rounded-[20px] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Участники</p>
          <p className="mt-1 text-xs text-[var(--text-dim)]">
            {participantCount} в голосовой комнате
          </p>
        </div>
        <span className="status-pill">
          <Users2 size={13} strokeWidth={1.5} />
          Онлайн
        </span>
      </div>

      <div className="mt-3 min-h-0 space-y-2 overflow-y-auto">
        {participants.length === 0 ? (
          <div className="rounded-[16px] border border-white/6 bg-black/10 px-3 py-4 text-center text-sm text-[var(--text-dim)]">
            Пока никого не видно. Подключение уже поднято, ждём участников.
          </div>
        ) : (
          participants.map((participant) => (
            <ParticipantRow key={participant.id} participant={participant} />
          ))
        )}
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
      <div className="pointer-events-auto w-full max-w-[430px] rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_34%),rgba(11,16,24,0.94)] p-3 shadow-[0_24px_60px_rgba(4,8,16,0.42)] backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(106,168,248,0.24)] bg-[rgba(106,168,248,0.14)] text-[var(--accent-strong)]">
            <PhoneCall size={18} strokeWidth={1.5} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-white">{session.title}</p>
              <span className="status-pill">{connectionStatusLabels[status]}</span>
              <span className="status-pill">{callModeLabels[session.call.mode]}</span>
              <span className="status-pill">
                <Users2 size={14} strokeWidth={1.5} />
                {participantCount}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-[var(--text-dim)]">{session.subtitle}</p>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/6 bg-white/[0.03] px-2 py-1 text-[11px] text-[var(--text-soft)]">
              {microphoneEnabled ? (
                <Mic size={13} strokeWidth={1.5} />
              ) : (
                <MicOff size={13} strokeWidth={1.5} />
              )}
              {microphoneEnabled ? "Микрофон включён" : "Микрофон выключен"}
            </div>
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
            Микрофон
          </Button>

          <Link
            href={session.route}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-white/8 bg-white/5 px-3 text-xs font-medium text-white transition-colors hover:bg-white/10"
          >
            <ArrowUpRight size={15} strokeWidth={1.5} />
            Вернуться в звонок
          </Link>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => void leaveCall(session.call.id)}
            className="ml-auto"
          >
            <PhoneOff size={15} strokeWidth={1.5} />
            Выйти
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
  variant = "default",
}: {
  callId: string | null;
  title: string;
  description: string;
  variant?: "default" | "conversation";
}) {
  const {
    session,
    status,
    errorMessage,
    tracks,
    participants,
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

  const primaryTrack =
    screenTracks.find((item) => !item.isLocal) ??
    screenTracks[0] ??
    cameraTracks.find((item) => !item.isLocal) ??
    cameraTracks[0] ??
    null;

  const secondaryVideoTracks = [...screenTracks, ...cameraTracks].filter(
    (item) => item.id !== primaryTrack?.id,
  );
  const isConversation = variant === "conversation";

  const stageSubtitle = screenTracks.length > 0
    ? "Демонстрация экрана получает главный экран, а участники уходят в боковую колонку."
    : description;

  return (
    <div
      className={cn(
        "premium-panel flex min-h-0 flex-col p-3",
        isConversation ? "shrink-0 rounded-[20px]" : "flex-1 rounded-[24px]",
      )}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow-pill">{title}</span>
            <span className="status-pill">{callModeLabels[session.call.mode]}</span>
            <span className="status-pill">{callStatusLabels[session.call.status]}</span>
            <span className="status-pill">{connectionStatusLabels[status]}</span>
            <span className="status-pill">
              <Users2 size={14} strokeWidth={1.5} />
              {participantCount}
            </span>
            {!session.connection.canPublishMedia ? (
              <span className="status-pill">Только прослушивание</span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-[var(--text-dim)]">{stageSubtitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-white/6 bg-white/[0.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:grid-cols-4">
          <Button
            size="sm"
            variant={microphoneEnabled ? "secondary" : "ghost"}
            onClick={() => void toggleMicrophone()}
            disabled={!session.connection.canPublishMedia}
            className="justify-start"
          >
            {microphoneEnabled ? (
              <Mic size={15} strokeWidth={1.5} />
            ) : (
              <MicOff size={15} strokeWidth={1.5} />
            )}
            {microphoneEnabled ? "Микрофон" : "Включить микрофон"}
          </Button>
          <Button
            size="sm"
            variant={cameraEnabled ? "secondary" : "ghost"}
            onClick={() => void toggleCamera()}
            disabled={!session.connection.canPublishMedia}
            className="justify-start"
          >
            {cameraEnabled ? (
              <Video size={15} strokeWidth={1.5} />
            ) : (
              <VideoOff size={15} strokeWidth={1.5} />
            )}
            {cameraEnabled ? "Камера" : "Включить камеру"}
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
            {screenShareEnabled ? "Остановить показ" : "Показать экран"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void leaveCall(session.call.id)}
            className="justify-start"
          >
            <PhoneOff size={15} strokeWidth={1.5} />
            Выйти
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-3 rounded-[16px] border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}

      <div
        className={cn(
          "mt-3 grid min-h-0 gap-3",
          isConversation
            ? "lg:grid-cols-[minmax(0,1fr)_280px]"
            : "flex-1 xl:grid-cols-[minmax(0,1fr)_320px]",
        )}
      >
        <div className="min-h-0 space-y-3">
          {primaryTrack ? (
            <TrackSurface
              item={primaryTrack}
              emphasis={isConversation ? "conversation" : "stage"}
            />
          ) : (
            <VoicePresenceStage
              participants={participants.filter((participant) => participant.isConnected)}
              participantCount={participantCount}
              variant={variant}
            />
          )}

          {secondaryVideoTracks.length > 0 ? (
            <div
              className={cn(
                "grid gap-2 md:grid-cols-2",
                isConversation ? "xl:grid-cols-2" : "xl:grid-cols-3",
              )}
            >
              {secondaryVideoTracks.map((item) => (
                <TrackSurface key={item.id} item={item} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <AudioAndDeviceCard />
          <ParticipantsCard participants={participants} participantCount={participantCount} />
        </div>
      </div>
    </div>
  );
}
