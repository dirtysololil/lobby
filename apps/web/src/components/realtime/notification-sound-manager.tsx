"use client";

import type {
  NotificationSetting,
  PublicUser,
  UpdateViewerNotificationDefaultsInput,
} from "@lobby/shared";
import {
  directConversationListResponseSchema,
  userNotificationSettingsResponseSchema,
} from "@lobby/shared";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCallSession } from "@/components/calls/call-session-provider";
import { apiClientFetch, apiClientFetchBlob } from "@/lib/api-client";
import {
  messageNotificationSoundAssetPath,
  messageNotificationSoundEventName,
  notificationSettingAllowsSound,
  type MessageNotificationSoundEventDetail,
} from "@/lib/message-notification-sound";
import {
  notificationPreferencesEventName,
  type NotificationPreferencesEventDetail,
} from "@/lib/notification-preferences";
import {
  getBuiltInRingtone,
  getCurrentRingtoneMode,
  getCustomRingtoneApiPath,
} from "@/lib/ringtones";
import { parseAppPath } from "@/lib/app-shell";
import { useRealtime } from "./realtime-provider";

type AudioPipelineState = "locked" | "ready" | "unsupported";
type BrowserNotificationState = NotificationPermission | "unsupported";
type SoundBucket = "fx" | "ringtone";
type ToneSpec = {
  frequency: number;
  duration: number;
  gap?: number;
  gain?: number;
  type?: OscillatorType;
};

interface NotificationSoundManagerProps {
  viewer: PublicUser;
}

interface ActiveDesktopNotification {
  closeTimer: number | null;
  notification: Notification;
  route: string;
}

const debugStorageKey = "lobby:debug-sound";
const handledMessageLimit = 120;
const desktopMessageDurationMs = 8_000;
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

function getBrowserNotificationState(): BrowserNotificationState {
  if (
    typeof window === "undefined" ||
    typeof window.Notification === "undefined"
  ) {
    return "unsupported";
  }

  return window.Notification.permission;
}

function trimNotificationBody(
  value: string | null | undefined,
  fallback: string,
) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return fallback;
  }

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117).trimEnd()}...`;
}

export function NotificationSoundManager({
  viewer,
}: NotificationSoundManagerProps) {
  const viewerId = viewer.id;
  const pathname = usePathname();
  const route = useMemo(() => parseAppPath(pathname ?? ""), [pathname]);
  const { latestDmSignal, latestSignal, incomingCalls } = useRealtime();
  const { session } = useCallSession();
  const [defaults, setDefaults] =
    useState<UpdateViewerNotificationDefaultsInput>(fallbackDefaults);
  const [audioState, setAudioState] = useState<AudioPipelineState>(() =>
    getAudioContextCtor() ? "locked" : "unsupported",
  );
  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationState>(getBrowserNotificationState);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const debugEnabledRef = useRef(false);
  const notificationPermissionRequestedRef = useRef(false);
  const warningKeysRef = useRef(new Set<string>());
  const conversationSettingsRef = useRef(
    new Map<string, NotificationSetting>(),
  );
  const desktopNotificationsRef = useRef(
    new Map<string, ActiveDesktopNotification>(),
  );
  const handledMessageIdsRef = useRef(new Set<string>());
  const handledMessageOrderRef = useRef<string[]>([]);
  const fxCleanupRef = useRef(new Set<() => void>());
  const ringtoneCleanupRef = useRef(new Set<() => void>());
  const ringtoneIntervalRef = useRef<number | null>(null);
  const ringtoneCallIdRef = useRef<string | null>(null);
  const ringtonePlaybackKeyRef = useRef<string | null>(null);
  const ringtonePendingKeyRef = useRef<string | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneAudioUrlRef = useRef<string | null>(null);
  const messageSoundBufferRef = useRef<AudioBuffer | null>(null);
  const messageSoundLoadPromiseRef = useRef<Promise<AudioBuffer | null> | null>(
    null,
  );

  const storeConversationNotificationSetting = useCallback(
    (
      conversationId: string,
      notificationSetting: NotificationSetting | null | undefined,
    ) => {
      if (!notificationSetting) {
        return false;
      }

      const currentSetting =
        conversationSettingsRef.current.get(conversationId);

      if (currentSetting === notificationSetting) {
        return false;
      }

      conversationSettingsRef.current.set(conversationId, notificationSetting);
      setSettingsVersion((current) => current + 1);
      return true;
    },
    [],
  );

  const logDebug = useCallback(
    (message: string, payload?: Record<string, unknown>) => {
      if (!debugEnabledRef.current) {
        return;
      }

      console.info("[notify/sound]", message, payload ?? {});
    },
    [],
  );

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

  const closeDesktopNotification = useCallback(
    (key: string, reason: string) => {
      const activeNotification = desktopNotificationsRef.current.get(key);

      if (!activeNotification) {
        return;
      }

      if (activeNotification.closeTimer !== null) {
        window.clearTimeout(activeNotification.closeTimer);
      }

      activeNotification.notification.close();
      desktopNotificationsRef.current.delete(key);
      logDebug("desktop-notification-closed", { key, reason });
    },
    [logDebug],
  );

  const closeDesktopNotificationsByPrefix = useCallback(
    (prefix: string, reason: string) => {
      for (const key of desktopNotificationsRef.current.keys()) {
        if (key.startsWith(prefix)) {
          closeDesktopNotification(key, reason);
        }
      }
    },
    [closeDesktopNotification],
  );

  const requestNotificationPermission = useCallback(
    async (reason: string) => {
      const currentPermission = getBrowserNotificationState();
      setNotificationPermission(currentPermission);

      if (
        currentPermission === "unsupported" ||
        currentPermission !== "default"
      ) {
        return currentPermission;
      }

      if (notificationPermissionRequestedRef.current) {
        return currentPermission;
      }

      notificationPermissionRequestedRef.current = true;

      try {
        const nextPermission = await window.Notification.requestPermission();
        setNotificationPermission(nextPermission);
        logDebug("notification-permission", {
          reason,
          permission: nextPermission,
        });
        return nextPermission;
      } catch (error) {
        warnOnce(
          "notification-permission-request",
          "Browser notification permission request failed.",
          {
            reason,
            error: normalizeErrorMessage(error),
          },
        );
        return "default";
      }
    },
    [logDebug, warnOnce],
  );

  const showDesktopNotification = useCallback(
    (args: {
      body: string;
      key: string;
      requireInteraction?: boolean;
      route: string;
      title: string;
    }) => {
      const currentPermission =
        notificationPermission === "granted"
          ? notificationPermission
          : getBrowserNotificationState();

      if (currentPermission !== "granted") {
        logDebug("desktop-notification-skipped", {
          key: args.key,
          permission: currentPermission,
        });
        return false;
      }

      closeDesktopNotification(args.key, "replace");

      try {
        const notification = new window.Notification(args.title, {
          body: args.body,
          requireInteraction: args.requireInteraction ?? false,
          silent: true,
          tag: args.key,
        });

        const closeTimer =
          args.requireInteraction === true
            ? null
            : window.setTimeout(() => {
                closeDesktopNotification(args.key, "timeout");
              }, desktopMessageDurationMs);

        desktopNotificationsRef.current.set(args.key, {
          closeTimer,
          notification,
          route: args.route,
        });

        notification.onclick = () => {
          closeDesktopNotification(args.key, "click");
          window.focus();

          if (window.location.pathname !== args.route) {
            window.location.assign(args.route);
          }
        };

        notification.onclose = () => {
          const activeNotification = desktopNotificationsRef.current.get(
            args.key,
          );

          if (
            !activeNotification ||
            activeNotification.notification !== notification
          ) {
            return;
          }

          if (activeNotification.closeTimer !== null) {
            window.clearTimeout(activeNotification.closeTimer);
          }

          desktopNotificationsRef.current.delete(args.key);
        };

        logDebug("desktop-notification-shown", {
          key: args.key,
          requireInteraction: args.requireInteraction ?? false,
          route: args.route,
        });

        return true;
      } catch (error) {
        warnOnce(
          `desktop-notification:${args.key}`,
          "Browser notification failed to show.",
          {
            error: normalizeErrorMessage(error),
            key: args.key,
          },
        );
        return false;
      }
    },
    [closeDesktopNotification, logDebug, notificationPermission, warnOnce],
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
      const nextState = nextContext.state === "running" ? "ready" : "locked";
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

  const loadMessageSoundBuffer = useCallback(async () => {
    if (messageSoundBufferRef.current) {
      return messageSoundBufferRef.current;
    }

    if (messageSoundLoadPromiseRef.current) {
      return messageSoundLoadPromiseRef.current;
    }

    const audioContext = getOrCreateAudioContext();

    if (!audioContext) {
      return null;
    }

    const loadPromise = (async () => {
      try {
        const response = await fetch(messageNotificationSoundAssetPath, {
          cache: "force-cache",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const encodedAudio = await response.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(
          encodedAudio.slice(0),
        );
        messageSoundBufferRef.current = decoded;
        return decoded;
      } catch (error) {
        warnOnce(
          "message-sound-asset",
          "Message notification sound failed to load, falling back to synthesized tone.",
          {
            error: normalizeErrorMessage(error),
            path: messageNotificationSoundAssetPath,
          },
        );
        return null;
      } finally {
        messageSoundLoadPromiseRef.current = null;
      }
    })();

    messageSoundLoadPromiseRef.current = loadPromise;
    return loadPromise;
  }, [getOrCreateAudioContext, warnOnce]);

  const scheduleToneSequence = useCallback(
    (
      sequence: ToneSpec[],
      soundType: "message" | "ringtone",
      bucket: SoundBucket,
    ) => {
      const audioContext = getOrCreateAudioContext();

      if (!audioContext) {
        return false;
      }

      if (audioContext.state !== "running") {
        void unlockAudio(`play:${soundType}`);
        warnOnce(
          `audio-locked:${soundType}`,
          "Audio pipeline is still locked.",
          {
            soundType,
            state: audioContext.state,
          },
        );
        return false;
      }

      const cleanupBucket =
        bucket === "ringtone"
          ? ringtoneCleanupRef.current
          : fxCleanupRef.current;
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
      ringtonePendingKeyRef.current = null;

      if (ringtoneIntervalRef.current !== null) {
        window.clearInterval(ringtoneIntervalRef.current);
        ringtoneIntervalRef.current = null;
      }

      clearSoundBucket("ringtone");

      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
        ringtoneAudioRef.current = null;
      }

      if (ringtoneAudioUrlRef.current) {
        URL.revokeObjectURL(ringtoneAudioUrlRef.current);
        ringtoneAudioUrlRef.current = null;
      }

      if (ringtoneCallIdRef.current) {
        closeDesktopNotification(`call:${ringtoneCallIdRef.current}`, reason);
        logDebug("ringtone-stopped", {
          callId: ringtoneCallIdRef.current,
          reason,
        });
      }

      ringtoneCallIdRef.current = null;
      ringtonePlaybackKeyRef.current = null;
    },
    [clearSoundBucket, closeDesktopNotification, logDebug],
  );

  const startBuiltInRingtone = useCallback(
    (
      callId: string,
      preset: PublicUser["profile"]["callRingtonePreset"],
      playbackKey: string,
    ) => {
      const ringtone = getBuiltInRingtone(preset);
      const playBurst = () =>
        scheduleToneSequence(ringtone.sequence, "ringtone", "ringtone");

      const started = playBurst();

      if (!started) {
        return false;
      }

      ringtoneCallIdRef.current = callId;
      ringtonePlaybackKeyRef.current = playbackKey;
      ringtoneIntervalRef.current = window.setInterval(
        playBurst,
        ringtone.loopIntervalMs,
      );
      logDebug("ringtone-started", {
        callId,
        preset: ringtone.id,
        source: "builtin",
      });

      return true;
    },
    [logDebug, scheduleToneSequence],
  );

  const startRingtone = useCallback(
    async (callId: string, profile: PublicUser["profile"]) => {
      const source = getCurrentRingtoneMode(profile);
      const playbackKey = [
        callId,
        source,
        profile.callRingtonePreset,
        profile.callRingtoneMode,
        profile.customRingtone.fileKey ?? "none",
        profile.updatedAt,
      ].join(":");

      if (
        ringtonePlaybackKeyRef.current === playbackKey ||
        ringtonePendingKeyRef.current === playbackKey
      ) {
        return;
      }

      stopRingtone("replace");

      if (source !== "custom" || !profile.customRingtone.fileKey) {
        startBuiltInRingtone(callId, profile.callRingtonePreset, playbackKey);
        return;
      }

      ringtonePendingKeyRef.current = playbackKey;

      try {
        const blob = await apiClientFetchBlob(
          getCustomRingtoneApiPath(profile.updatedAt),
        );

        if (ringtonePendingKeyRef.current !== playbackKey) {
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);
        audio.loop = true;
        audio.preload = "auto";

        await audio.play();

        if (ringtonePendingKeyRef.current !== playbackKey) {
          audio.pause();
          URL.revokeObjectURL(objectUrl);
          return;
        }

        ringtonePendingKeyRef.current = null;
        ringtoneAudioRef.current = audio;
        ringtoneAudioUrlRef.current = objectUrl;
        ringtoneCallIdRef.current = callId;
        ringtonePlaybackKeyRef.current = playbackKey;
        logDebug("ringtone-started", {
          callId,
          mimeType: profile.customRingtone.mimeType,
          source: "custom",
        });
        return;
      } catch (error) {
        if (ringtonePendingKeyRef.current === playbackKey) {
          ringtonePendingKeyRef.current = null;
        }

        warnOnce(
          `custom-ringtone:${playbackKey}`,
          "Custom ringtone failed to load, falling back to builtin preset.",
          {
            callId,
            error: normalizeErrorMessage(error),
          },
        );
      }

      startBuiltInRingtone(callId, profile.callRingtonePreset, playbackKey);
    },
    [logDebug, startBuiltInRingtone, stopRingtone, warnOnce],
  );

  const playMessageSound = useCallback(async () => {
    const audioContext = getOrCreateAudioContext();

    if (!audioContext) {
      return false;
    }

    if (audioContext.state !== "running") {
      void unlockAudio("play:message");
      warnOnce("audio-locked:message", "Audio pipeline is still locked.", {
        soundType: "message",
        state: audioContext.state,
      });
      return false;
    }

    const fallbackSequence: ToneSpec[] = [
      { frequency: 880, duration: 0.07, gap: 0.05, gain: 0.014, type: "sine" },
      { frequency: 1174, duration: 0.05, gap: 0.03, gain: 0.01, type: "sine" },
    ];
    const messageSound = await loadMessageSoundBuffer();

    if (!messageSound) {
      return scheduleToneSequence(fallbackSequence, "message", "fx");
    }

    clearSoundBucket("fx");

    const cleanupBucket = fxCleanupRef.current;
    const startAt = audioContext.currentTime + 0.01;
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    let cleanedUp = false;

    source.buffer = messageSound;
    gain.gain.setValueAtTime(1, startAt);
    source.connect(gain);
    gain.connect(audioContext.destination);

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;

      try {
        source.stop();
      } catch {
        // Ignore already stopped nodes.
      }

      source.onended = null;
      source.disconnect();
      gain.disconnect();
      cleanupBucket.delete(cleanup);
    };

    cleanupBucket.add(cleanup);
    source.onended = cleanup;
    source.start(startAt);

    logDebug("sound-played", {
      soundType: "message",
      bucket: "fx",
      totalDurationMs: Math.round(messageSound.duration * 1000),
      asset: messageNotificationSoundAssetPath,
    });

    return true;
  }, [
    clearSoundBucket,
    getOrCreateAudioContext,
    loadMessageSoundBuffer,
    logDebug,
    scheduleToneSequence,
    unlockAudio,
    warnOnce,
  ]);

  const isAppInForeground = useCallback(() => {
    if (typeof document === "undefined") {
      return true;
    }

    return document.visibilityState === "visible" && document.hasFocus();
  }, []);

  const buildCallNotificationRoute = useCallback(
    (call: (typeof incomingCalls)[number]) => {
      if (call.dmConversationId) {
        return `/app/messages/${call.dmConversationId}`;
      }

      if (call.hubId && call.lobbyId) {
        return `/app/hubs/${call.hubId}/lobbies/${call.lobbyId}`;
      }

      return "/app";
    },
    [],
  );

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
      const debugFromStorage =
        window.localStorage.getItem(debugStorageKey) === "1";
      debugEnabledRef.current = debugFromSearch || debugFromStorage;
    } catch {
      debugEnabledRef.current = false;
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
            dmNotificationDefault:
              parsedSettings.settings.defaults.dmNotificationDefault,
          });
        } catch (error) {
          warnOnce(
            "settings-parse",
            "Failed to parse viewer notification settings.",
            {
              error: normalizeErrorMessage(error),
            },
          );
        }
      } else {
        warnOnce(
          "settings-fetch",
          "Failed to load viewer notification settings.",
          {
            error: normalizeErrorMessage(settingsResult.reason),
          },
        );
      }

      if (conversationsResult.status === "fulfilled") {
        try {
          const parsedConversations =
            directConversationListResponseSchema.parse(
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
          warnOnce(
            "dm-list-parse",
            "Failed to parse DM conversations for audio settings.",
            {
              error: normalizeErrorMessage(error),
            },
          );
        }
      } else {
        warnOnce(
          "dm-list-fetch",
          "Failed to load DM conversations for audio settings.",
          {
            error: normalizeErrorMessage(conversationsResult.reason),
          },
        );
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
      void requestNotificationPermission("user-gesture");
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
  }, [audioState, requestNotificationPermission, unlockAudio]);

  useEffect(() => {
    if (audioState !== "ready") {
      return;
    }

    void loadMessageSoundBuffer();
  }, [audioState, loadMessageSoundBuffer]);

  useEffect(() => {
    if (!latestDmSignal) {
      return;
    }

    if (latestDmSignal.conversation.settings.notificationSetting) {
      conversationSettingsRef.current.set(
        latestDmSignal.conversationId,
        latestDmSignal.conversation.settings.notificationSetting,
      );
    }

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

    if (!notificationSettingAllowsSound(notificationSetting)) {
      logDebug("skip-message-by-setting", {
        conversationId: latestDmSignal.conversationId,
        notificationSetting,
      });
      return;
    }

    const isForeground = isAppInForeground();
    const sameConversationOpen =
      route.section === "messages" &&
      route.conversationId === latestDmSignal.conversationId;
    const sameConversationInFocus = sameConversationOpen && isForeground;

    if (!sameConversationInFocus) {
      const author = latestDmSignal.message.author;

      void showDesktopNotification({
        body: trimNotificationBody(
          latestDmSignal.message.content,
          `Новое сообщение от @${author.username}`,
        ),
        key: `message:${latestDmSignal.message.id}`,
        route: `/app/messages/${latestDmSignal.conversationId}`,
        title: author.profile.displayName,
      });
    }

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

    const playbackTimer = window.setTimeout(() => {
      void playMessageSound().then((played) => {
        if (!played) {
          warnOnce(
            "message-playback",
            "Message notification sound did not start.",
            {
              audioState,
              conversationId: latestDmSignal.conversationId,
            },
          );
          return;
        }

        logDebug("message-sound-triggered", {
          messageId: latestDmSignal.message?.id ?? null,
          conversationId: latestDmSignal.conversationId,
          source: "dm",
        });
      });
    }, 0);

    return () => {
      window.clearTimeout(playbackTimer);
    };
  }, [
    audioState,
    defaults.dmNotificationDefault,
    latestDmSignal,
    logDebug,
    markMessageHandled,
    isAppInForeground,
    playMessageSound,
    route.conversationId,
    route.section,
    showDesktopNotification,
    storeConversationNotificationSetting,
    viewerId,
    warnOnce,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleMessageSoundRequest = (event: Event) => {
      const detail = (event as CustomEvent<MessageNotificationSoundEventDetail>)
        .detail;

      if (ringtoneCallIdRef.current) {
        logDebug("skip-message-ringtone-active", {
          source: detail?.source ?? "external",
          ringingCallId: ringtoneCallIdRef.current,
        });
        return;
      }

      void playMessageSound().then((played) => {
        if (!played) {
          warnOnce(
            `message-playback:${detail?.source ?? "external"}`,
            "Message notification sound did not start.",
            {
              audioState,
              source: detail?.source ?? "external",
            },
          );
          return;
        }

        logDebug("message-sound-triggered", {
          source: detail?.source ?? "external",
        });
      });
    };

    window.addEventListener(
      messageNotificationSoundEventName,
      handleMessageSoundRequest as EventListener,
    );

    return () => {
      window.removeEventListener(
        messageNotificationSoundEventName,
        handleMessageSoundRequest as EventListener,
      );
    };
  }, [audioState, logDebug, playMessageSound, warnOnce]);

  useEffect(() => {
    if (session) {
      closeDesktopNotificationsByPrefix("call:", "active-session");
      stopRingtone("active-session");
      return;
    }

    const incomingCall = incomingCalls[0] ?? null;

    if (!incomingCall) {
      closeDesktopNotificationsByPrefix("call:", "no-incoming-call");
      stopRingtone("no-incoming-call");
      return;
    }

    const notificationSetting =
      (incomingCall.dmConversationId
        ? conversationSettingsRef.current.get(incomingCall.dmConversationId)
        : null) ?? defaults.dmNotificationDefault;

    if (!notificationSettingAllowsSound(notificationSetting)) {
      closeDesktopNotification(
        `call:${incomingCall.id}`,
        "call-muted-by-setting",
      );
      stopRingtone("call-muted-by-setting");
      logDebug("skip-ringtone-by-setting", {
        callId: incomingCall.id,
        notificationSetting,
      });
      return;
    }

    const isForeground = isAppInForeground();
    const targetRoute = buildCallNotificationRoute(incomingCall);
    const sameCallContextVisible =
      isForeground &&
      ((incomingCall.dmConversationId &&
        route.section === "messages" &&
        route.conversationId === incomingCall.dmConversationId) ||
        (incomingCall.hubId &&
          incomingCall.lobbyId &&
          route.section === "hubs" &&
          route.hubId === incomingCall.hubId &&
          route.lobbyId === incomingCall.lobbyId));

    if (!sameCallContextVisible) {
      const caller = incomingCall.initiatedBy;

      void showDesktopNotification({
        body: `${caller.profile.displayName} звонит вам`,
        key: `call:${incomingCall.id}`,
        requireInteraction: true,
        route: targetRoute,
        title: "Входящий звонок",
      });
    } else {
      closeDesktopNotification(
        `call:${incomingCall.id}`,
        "call-context-visible",
      );
    }

    void startRingtone(incomingCall.id, viewer.profile);
  }, [
    audioState,
    buildCallNotificationRoute,
    closeDesktopNotification,
    closeDesktopNotificationsByPrefix,
    defaults.dmNotificationDefault,
    incomingCalls,
    isAppInForeground,
    logDebug,
    route.conversationId,
    route.hubId,
    route.lobbyId,
    route.section,
    settingsVersion,
    session,
    showDesktopNotification,
    startRingtone,
    stopRingtone,
    viewer.profile,
    viewer.profile.callRingtoneMode,
    viewer.profile.callRingtonePreset,
    viewer.profile.customRingtone.fileKey,
    viewer.profile.customRingtone.mimeType,
    viewer.profile.updatedAt,
  ]);

  useEffect(() => {
    if (!latestSignal) {
      return;
    }

    const callNotificationKey = `call:${latestSignal.call.id}`;
    const hasTrackedCallNotification =
      desktopNotificationsRef.current.has(callNotificationKey);

    if (
      latestSignal.call.id !== ringtoneCallIdRef.current &&
      !hasTrackedCallNotification
    ) {
      return;
    }

    const viewerParticipant = latestSignal.call.participants.find(
      (participant) => participant.user.id === viewerId,
    );
    const shouldContinueRinging =
      latestSignal.call.status === "RINGING" &&
      viewerParticipant?.state === "INVITED";

    if (!shouldContinueRinging) {
      closeDesktopNotification(callNotificationKey, "call-signal-updated");
      stopRingtone("call-signal-updated");
    }
  }, [closeDesktopNotification, latestSignal, stopRingtone, viewerId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePreferencesUpdate = (event: Event) => {
      const detail = (event as CustomEvent<NotificationPreferencesEventDetail>)
        .detail;

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

      storeConversationNotificationSetting(
        detail.conversationId,
        detail.notificationSetting,
      );
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
  }, [logDebug, storeConversationNotificationSetting]);

  useEffect(() => {
    return () => {
      closeDesktopNotificationsByPrefix("message:", "unmount");
      closeDesktopNotificationsByPrefix("call:", "unmount");
      stopRingtone("unmount");
      clearSoundBucket("fx");

      const audioContext = audioContextRef.current;
      audioContextRef.current = null;
      void audioContext?.close().catch(() => undefined);
    };
  }, [clearSoundBucket, closeDesktopNotificationsByPrefix, stopRingtone]);

  return null;
}
