"use client";

import type {
  NotificationSetting,
  UpdateViewerNotificationDefaultsInput,
} from "@lobby/shared";
import {
  directConversationListResponseSchema,
  userNotificationSettingsResponseSchema,
} from "@lobby/shared";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCallSession } from "@/components/calls/call-session-provider";
import { apiClientFetch } from "@/lib/api-client";
import {
  notificationPreferencesEventName,
  type NotificationPreferencesEventDetail,
} from "@/lib/notification-preferences";
import { parseAppPath } from "@/lib/app-shell";
import { useRealtime } from "./realtime-provider";

type AudioPipelineState = "locked" | "ready" | "unsupported";
type SoundBucket = "fx" | "ringtone";
type ToneSpec = {
  frequency: number;
  duration: number;
  gap?: number;
  gain?: number;
  type?: OscillatorType;
};

interface NotificationSoundManagerProps {
  viewerId: string;
}

const debugStorageKey = "lobby:debug-sound";
const handledMessageLimit = 120;
const fallbackDefaults: UpdateViewerNotificationDefaultsInput = {
  dmNotificationDefault: "ALL",
  hubNotificationDefault: "ALL",
  lobbyNotificationDefault: "ALL",
};

function getAudioContextCtor() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "unknown";
}

function notificationAllowsSound(setting: NotificationSetting | null | undefined) {
  return setting === "ALL" || setting === "MENTIONS_ONLY";
}

export function NotificationSoundManager({
  viewerId,
}: NotificationSoundManagerProps) {
  const pathname = usePathname();
  const route = useMemo(() => parseAppPath(pathname ?? ""), [pathname]);
  const { latestDmSignal, latestSignal, incomingCalls } = useRealtime();
  const { session } = useCallSession();
  const [defaults, setDefaults] =
    useState<UpdateViewerNotificationDefaultsInput>(fallbackDefaults);
  const [audioState, setAudioState] = useState<AudioPipelineState>("locked");
  const [settingsVersion, setSettingsVersion] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const debugEnabledRef = useRef(false);
  const warningKeysRef = useRef(new Set<string>());
  const conversationSettingsRef = useRef(new Map<string, NotificationSetting>());
  const handledMessageIdsRef = useRef(new Set<string>());
  const handledMessageOrderRef = useRef<string[]>([]);
  const fxCleanupRef = useRef(new Set<() => void>());
  const ringtoneCleanupRef = useRef(new Set<() => void>());
  const ringtoneIntervalRef = useRef<number | null>(null);
  const ringtoneCallIdRef = useRef<string | null>(null);

  const logDebug = useCallback((message: string, payload?: Record<string, unknown>) => {
    if (!debugEnabledRef.current) {
      return;
    }

    console.info("[notify/sound]", message, payload ?? {});
  }, []);

  const warnOnce = useCallback(
    (key: string, message: string, payload?: Record<string, unknown>) => {
      if (warningKeysRef.current.has(key)) {
        return;
      }

      warningKeysRef.current.add(key);
      console.warn("[notify/sound]", message, payload ?? {});
    },
    [],
  );

  const getOrCreateAudioContext = useCallback(() => {
    const existingContext = audioContextRef.current;

    if (existingContext) {
      return existingContext;
    }

    const AudioContextCtor = getAudioContextCtor();

    if (!AudioContextCtor) {
      setAudioState("unsupported");
      warnOnce("unsupported", "Web Audio API is unavailable in this browser.");
      return null;
    }

    const nextContext = new AudioContextCtor();
    audioContextRef.current = nextContext;

    const syncAudioState = () => {
      const nextState =
        nextContext.state === "running" ? "ready" : "locked";
      setAudioState(nextState);
      logDebug("audio-state", { state: nextContext.state });
    };

    nextContext.addEventListener?.("statechange", syncAudioState);
    syncAudioState();

    return nextContext;
  }, [logDebug, warnOnce]);

  const clearSoundBucket = useCallback((bucket: SoundBucket) => {
    const cleanupBucket =
      bucket === "ringtone" ? ringtoneCleanupRef.current : fxCleanupRef.current;

    for (const cleanup of cleanupBucket) {
      cleanup();
    }

    cleanupBucket.clear();
  }, []);

  const unlockAudio = useCallback(
    async (reason: string) => {
      const audioContext = getOrCreateAudioContext();

      if (!audioContext) {
        return false;
      }

      if (audioContext.state !== "running") {
        try {
          await audioContext.resume();
        } catch (error) {
          setAudioState("locked");
          warnOnce("unlock-failed", "Audio unlock failed.", {
            reason,
            error: normalizeErrorMessage(error),
          });
          return false;
        }
      }

      const ready = audioContext.state === "running";
      setAudioState(ready ? "ready" : "locked");

      if (ready) {
        logDebug("audio-unlocked", { reason });
      }

      return ready;
    },
    [getOrCreateAudioContext, logDebug, warnOnce],
  );

  const scheduleToneSequence = useCallback(
    (sequence: ToneSpec[], soundType: "message" | "ringtone", bucket: SoundBucket) => {
      const audioContext = getOrCreateAudioContext();

      if (!audioContext) {
        return false;
      }

      if (audioContext.state !== "running") {
        void unlockAudio(`play:${soundType}`);
        warnOnce(`audio-locked:${soundType}`, "Audio pipeline is still locked.", {
          soundType,
          state: audioContext.state,
        });
        return false;
      }

      const cleanupBucket =
        bucket === "ringtone" ? ringtoneCleanupRef.current : fxCleanupRef.current;
      const startAt = audioContext.currentTime + 0.02;
      let cursor = startAt;
      const nodes: Array<{ oscillator: OscillatorNode; gain: GainNode }> = [];

      for (const tone of sequence) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const peakGain = tone.gain ?? (soundType === "ringtone" ? 0.03 : 0.018);
        const fadeInAt = cursor + 0.01;
        const endAt = cursor + tone.duration;

        oscillator.type = tone.type ?? "sine";
        oscillator.frequency.setValueAtTime(tone.frequency, cursor);
        gain.gain.setValueAtTime(0.0001, cursor);
        gain.gain.exponentialRampToValueAtTime(peakGain, fadeInAt);
        gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(cursor);
        oscillator.stop(endAt + 0.03);

        nodes.push({ oscillator, gain });
        cursor = endAt + (tone.gap ?? 0.08);
      }

      const totalDurationMs = Math.max(0, (cursor - startAt) * 1000 + 120);
      let cleanedUp = false;
      let cleanupTimer = 0;
      const cleanup = () => {
        if (cleanedUp) {
          return;
        }

        cleanedUp = true;
        window.clearTimeout(cleanupTimer);

        for (const node of nodes) {
          try {
            node.gain.gain.cancelScheduledValues(audioContext.currentTime);
            node.gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
            node.oscillator.stop();
          } catch {
            // Ignore already stopped nodes.
          }

          node.oscillator.disconnect();
          node.gain.disconnect();
        }

        cleanupBucket.delete(cleanup);
      };

      cleanupBucket.add(cleanup);
      cleanupTimer = window.setTimeout(cleanup, totalDurationMs);
      logDebug("sound-played", { soundType, bucket, totalDurationMs });

      return true;
    },
    [getOrCreateAudioContext, logDebug, unlockAudio, warnOnce],
  );

  const stopRingtone = useCallback(
    (reason: string) => {
      if (ringtoneIntervalRef.current !== null) {
        window.clearInterval(ringtoneIntervalRef.current);
        ringtoneIntervalRef.current = null;
      }

      clearSoundBucket("ringtone");

      if (ringtoneCallIdRef.current) {
        logDebug("ringtone-stopped", {
          callId: ringtoneCallIdRef.current,
          reason,
        });
      }

      ringtoneCallIdRef.current = null;
    },
    [clearSoundBucket, logDebug],
  );

  const startRingtone = useCallback(
    (callId: string) => {
      if (ringtoneCallIdRef.current === callId) {
        return;
      }

      stopRingtone("replace");

      const ringtoneSequence: ToneSpec[] = [
        { frequency: 587, duration: 0.16, gap: 0.08, gain: 0.028, type: "triangle" },
        { frequency: 740, duration: 0.22, gap: 0.16, gain: 0.032, type: "triangle" },
        { frequency: 659, duration: 0.16, gap: 0.08, gain: 0.028, type: "triangle" },
        { frequency: 880, duration: 0.28, gap: 0.42, gain: 0.034, type: "triangle" },
      ];

      const playBurst = () =>
        scheduleToneSequence(ringtoneSequence, "ringtone", "ringtone");

      const started = playBurst();

      if (!started) {
        return;
      }

      ringtoneCallIdRef.current = callId;
      ringtoneIntervalRef.current = window.setInterval(playBurst, 1800);
      logDebug("ringtone-started", { callId });
    },
    [logDebug, scheduleToneSequence, stopRingtone],
  );

  const playMessageSound = useCallback(() => {
    const messageSequence: ToneSpec[] = [
      { frequency: 880, duration: 0.07, gap: 0.05, gain: 0.014, type: "sine" },
      { frequency: 1174, duration: 0.05, gap: 0.03, gain: 0.01, type: "sine" },
    ];

    return scheduleToneSequence(messageSequence, "message", "fx");
  }, [scheduleToneSequence]);

  const markMessageHandled = useCallback((messageId: string) => {
    if (handledMessageIdsRef.current.has(messageId)) {
      return false;
    }

    handledMessageIdsRef.current.add(messageId);
    handledMessageOrderRef.current.push(messageId);

    if (handledMessageOrderRef.current.length > handledMessageLimit) {
      const droppedMessageId = handledMessageOrderRef.current.shift();

      if (droppedMessageId) {
        handledMessageIdsRef.current.delete(droppedMessageId);
      }
    }

    return true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const debugFromSearch =
        new URLSearchParams(window.location.search).get("debugSound") === "1";
      const debugFromStorage = window.localStorage.getItem(debugStorageKey) === "1";
      debugEnabledRef.current = debugFromSearch || debugFromStorage;
    } catch {
      debugEnabledRef.current = false;
    }

    if (!getAudioContextCtor()) {
      setAudioState("unsupported");
    }
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [settingsResult, conversationsResult] = await Promise.allSettled([
        apiClientFetch("/v1/users/me/notification-settings"),
        apiClientFetch("/v1/direct-messages"),
      ]);

      if (!active) {
        return;
      }

      if (settingsResult.status === "fulfilled") {
        try {
          const parsedSettings = userNotificationSettingsResponseSchema.parse(
            settingsResult.value,
          );
          setDefaults(parsedSettings.settings.defaults);
          logDebug("notification-defaults-loaded", {
            dmNotificationDefault: parsedSettings.settings.defaults.dmNotificationDefault,
          });
        } catch (error) {
          warnOnce("settings-parse", "Failed to parse viewer notification settings.", {
            error: normalizeErrorMessage(error),
          });
        }
      } else {
        warnOnce("settings-fetch", "Failed to load viewer notification settings.", {
          error: normalizeErrorMessage(settingsResult.reason),
        });
      }

      if (conversationsResult.status === "fulfilled") {
        try {
          const parsedConversations = directConversationListResponseSchema.parse(
            conversationsResult.value,
          );
          conversationSettingsRef.current = new Map(
            parsedConversations.items.map((conversation) => [
              conversation.id,
              conversation.settings.notificationSetting,
            ]),
          );
          setSettingsVersion((current) => current + 1);
          logDebug("conversation-settings-loaded", {
            count: parsedConversations.items.length,
          });
        } catch (error) {
          warnOnce("dm-list-parse", "Failed to parse DM conversations for audio settings.", {
            error: normalizeErrorMessage(error),
          });
        }
      } else {
        warnOnce("dm-list-fetch", "Failed to load DM conversations for audio settings.", {
          error: normalizeErrorMessage(conversationsResult.reason),
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [logDebug, warnOnce]);

  useEffect(() => {
    if (typeof window === "undefined" || audioState === "ready") {
      return;
    }

    const unlockFromGesture = () => {
      void unlockAudio("user-gesture");
    };

    const listenerOptions = { passive: true } as const;
    window.addEventListener("pointerdown", unlockFromGesture, listenerOptions);
    window.addEventListener("touchstart", unlockFromGesture, listenerOptions);
    window.addEventListener("mousedown", unlockFromGesture, listenerOptions);
    window.addEventListener("keydown", unlockFromGesture);

    return () => {
      window.removeEventListener("pointerdown", unlockFromGesture);
      window.removeEventListener("touchstart", unlockFromGesture);
      window.removeEventListener("mousedown", unlockFromGesture);
      window.removeEventListener("keydown", unlockFromGesture);
    };
  }, [audioState, unlockAudio]);

  useEffect(() => {
    if (!latestDmSignal) {
      return;
    }

    conversationSettingsRef.current.set(
      latestDmSignal.conversationId,
      latestDmSignal.conversation.settings.notificationSetting,
    );
    setSettingsVersion((current) => current + 1);

    if (latestDmSignal.event !== "MESSAGE_CREATED" || !latestDmSignal.message) {
      return;
    }

    if (!markMessageHandled(latestDmSignal.message.id)) {
      logDebug("skip-message-duplicate", {
        messageId: latestDmSignal.message.id,
      });
      return;
    }

    const isOwnMessage =
      latestDmSignal.actorUserId === viewerId ||
      latestDmSignal.message.author.id === viewerId;

    if (isOwnMessage) {
      logDebug("skip-message-own", {
        messageId: latestDmSignal.message.id,
      });
      return;
    }

    const notificationSetting =
      latestDmSignal.conversation.settings.notificationSetting ??
      defaults.dmNotificationDefault;

    if (!notificationAllowsSound(notificationSetting)) {
      logDebug("skip-message-by-setting", {
        conversationId: latestDmSignal.conversationId,
        notificationSetting,
      });
      return;
    }

    const sameConversationInFocus =
      route.section === "messages" &&
      route.conversationId === latestDmSignal.conversationId &&
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      document.hasFocus();

    if (sameConversationInFocus) {
      logDebug("skip-message-active-thread", {
        conversationId: latestDmSignal.conversationId,
      });
      return;
    }

    if (ringtoneCallIdRef.current) {
      logDebug("skip-message-ringtone-active", {
        messageId: latestDmSignal.message.id,
        ringingCallId: ringtoneCallIdRef.current,
      });
      return;
    }

    const played = playMessageSound();

    if (!played) {
      warnOnce("message-playback", "Message notification sound did not start.", {
        audioState,
        conversationId: latestDmSignal.conversationId,
      });
      return;
    }

    logDebug("message-sound-triggered", {
      messageId: latestDmSignal.message.id,
      conversationId: latestDmSignal.conversationId,
    });
  }, [
    audioState,
    defaults.dmNotificationDefault,
    latestDmSignal,
    logDebug,
    markMessageHandled,
    playMessageSound,
    route.conversationId,
    route.section,
    viewerId,
    warnOnce,
  ]);

  useEffect(() => {
    if (session) {
      stopRingtone("active-session");
      return;
    }

    const incomingCall = incomingCalls[0] ?? null;

    if (!incomingCall) {
      stopRingtone("no-incoming-call");
      return;
    }

    const notificationSetting =
      (incomingCall.dmConversationId
        ? conversationSettingsRef.current.get(incomingCall.dmConversationId)
        : null) ?? defaults.dmNotificationDefault;

    if (!notificationAllowsSound(notificationSetting)) {
      stopRingtone("call-muted-by-setting");
      logDebug("skip-ringtone-by-setting", {
        callId: incomingCall.id,
        notificationSetting,
      });
      return;
    }

    startRingtone(incomingCall.id);
  }, [
    audioState,
    defaults.dmNotificationDefault,
    incomingCalls,
    logDebug,
    settingsVersion,
    session,
    startRingtone,
    stopRingtone,
  ]);

  useEffect(() => {
    if (!latestSignal || latestSignal.call.id !== ringtoneCallIdRef.current) {
      return;
    }

    const viewerParticipant = latestSignal.call.participants.find(
      (participant) => participant.user.id === viewerId,
    );
    const shouldContinueRinging =
      latestSignal.call.status === "RINGING" &&
      viewerParticipant?.state === "INVITED";

    if (!shouldContinueRinging) {
      stopRingtone("call-signal-updated");
    }
  }, [latestSignal, stopRingtone, viewerId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePreferencesUpdate = (
      event: Event,
    ) => {
      const detail = (
        event as CustomEvent<NotificationPreferencesEventDetail>
      ).detail;

      if (!detail) {
        return;
      }

      if (detail.scope === "defaults") {
        setDefaults(detail.defaults);
        logDebug("notification-defaults-updated", {
          dmNotificationDefault: detail.defaults.dmNotificationDefault,
        });
        return;
      }

      conversationSettingsRef.current.set(
        detail.conversationId,
        detail.notificationSetting,
      );
      setSettingsVersion((current) => current + 1);
      logDebug("conversation-notification-updated", {
        conversationId: detail.conversationId,
        notificationSetting: detail.notificationSetting,
      });
    };

    window.addEventListener(
      notificationPreferencesEventName,
      handlePreferencesUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        notificationPreferencesEventName,
        handlePreferencesUpdate as EventListener,
      );
    };
  }, [logDebug]);

  useEffect(() => {
    return () => {
      stopRingtone("unmount");
      clearSoundBucket("fx");

      const audioContext = audioContextRef.current;
      audioContextRef.current = null;
      void audioContext?.close().catch(() => undefined);
    };
  }, [clearSoundBucket, stopRingtone]);

  return null;
}
