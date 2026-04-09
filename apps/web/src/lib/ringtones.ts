"use client";

import {
  defaultCallRingtoneMode,
  defaultCallRingtonePreset,
  type CallRingtoneMode,
  type CallRingtonePreset,
  type Profile,
} from "@lobby/shared";
import type { ToneSpec } from "@/lib/tone-sequence";

type SupportedRingtoneExtension = "mp3" | "wav" | "ogg" | "m4a";

export interface BuiltInRingtoneDefinition {
  accent: string;
  id: CallRingtonePreset;
  label: string;
  loopIntervalMs: number;
  sequence: ToneSpec[];
}

const browserMimeCandidates: Record<SupportedRingtoneExtension, string[]> = {
  mp3: ["audio/mpeg"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave"],
  ogg: ["audio/ogg", "audio/ogg; codecs=vorbis"],
  m4a: ['audio/mp4; codecs="mp4a.40.2"', "audio/mp4", "audio/x-m4a"],
};

const allowedExtensions = new Set<SupportedRingtoneExtension>([
  "mp3",
  "wav",
  "ogg",
  "m4a",
]);

export const ringtoneUploadAccept =
  ".mp3,.wav,.ogg,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a";
export const ringtonePreviewMaxDurationMs = 6_000;

export const builtInCallRingtones: BuiltInRingtoneDefinition[] = [
  {
    id: "CLASSIC",
    label: "Классический",
    accent: "Двухтональный звонок",
    loopIntervalMs: 2_550,
    sequence: [
      {
        frequency: 523,
        duration: 0.16,
        gap: 0.06,
        gain: 0.046,
        type: "triangle",
      },
      {
        frequency: 659,
        duration: 0.2,
        gap: 0.08,
        gain: 0.054,
        type: "triangle",
      },
      {
        frequency: 784,
        duration: 0.24,
        gap: 0.12,
        gain: 0.06,
        type: "triangle",
      },
      {
        frequency: 659,
        duration: 0.18,
        gap: 0.08,
        gain: 0.05,
        type: "triangle",
      },
      {
        frequency: 880,
        duration: 0.28,
        gap: 0.46,
        gain: 0.064,
        type: "triangle",
      },
    ],
  },
  {
    id: "SOFT",
    label: "Мягкий",
    accent: "Спокойный и тёплый",
    loopIntervalMs: 2_800,
    sequence: [
      { frequency: 392, duration: 0.28, gap: 0.07, gain: 0.028, type: "sine" },
      { frequency: 523, duration: 0.32, gap: 0.1, gain: 0.03, type: "sine" },
      { frequency: 659, duration: 0.36, gap: 0.12, gain: 0.032, type: "sine" },
      { frequency: 523, duration: 0.3, gap: 0.5, gain: 0.028, type: "sine" },
    ],
  },
  {
    id: "DIGITAL",
    label: "Цифровой",
    accent: "Чёткие электронные импульсы",
    loopIntervalMs: 2_250,
    sequence: [
      {
        frequency: 1046,
        duration: 0.08,
        gap: 0.06,
        gain: 0.022,
        type: "square",
      },
      {
        frequency: 1318,
        duration: 0.08,
        gap: 0.08,
        gain: 0.022,
        type: "square",
      },
      {
        frequency: 1568,
        duration: 0.1,
        gap: 0.08,
        gain: 0.024,
        type: "square",
      },
      {
        frequency: 1318,
        duration: 0.08,
        gap: 0.08,
        gain: 0.022,
        type: "square",
      },
      {
        frequency: 1760,
        duration: 0.12,
        gap: 0.54,
        gain: 0.025,
        type: "square",
      },
    ],
  },
  {
    id: "PULSE",
    label: "Пульс",
    accent: "Ритмичный и собранный",
    loopIntervalMs: 2_300,
    sequence: [
      {
        frequency: 220,
        duration: 0.12,
        gap: 0.05,
        gain: 0.036,
        type: "sawtooth",
      },
      {
        frequency: 220,
        duration: 0.12,
        gap: 0.05,
        gain: 0.042,
        type: "sawtooth",
      },
      {
        frequency: 294,
        duration: 0.15,
        gap: 0.08,
        gain: 0.044,
        type: "sawtooth",
      },
      {
        frequency: 349,
        duration: 0.16,
        gap: 0.08,
        gain: 0.046,
        type: "sawtooth",
      },
      {
        frequency: 294,
        duration: 0.14,
        gap: 0.46,
        gain: 0.042,
        type: "sawtooth",
      },
    ],
  },
  {
    id: "NIGHT",
    label: "Ночной",
    accent: "Низкий и мягкий тембр",
    loopIntervalMs: 3_000,
    sequence: [
      {
        frequency: 293,
        duration: 0.32,
        gap: 0.08,
        gain: 0.022,
        type: "triangle",
      },
      {
        frequency: 349,
        duration: 0.38,
        gap: 0.1,
        gain: 0.024,
        type: "triangle",
      },
      {
        frequency: 440,
        duration: 0.42,
        gap: 0.14,
        gain: 0.026,
        type: "triangle",
      },
      {
        frequency: 349,
        duration: 0.32,
        gap: 0.62,
        gain: 0.022,
        type: "triangle",
      },
    ],
  },
  {
    id: "CLEAR_SIGNAL",
    label: "Чистый сигнал",
    accent: "Прямой высокий сигнал",
    loopIntervalMs: 2_000,
    sequence: [
      { frequency: 988, duration: 0.16, gap: 0.06, gain: 0.03, type: "sine" },
      { frequency: 1174, duration: 0.18, gap: 0.08, gain: 0.032, type: "sine" },
      { frequency: 1396, duration: 0.2, gap: 0.54, gain: 0.034, type: "sine" },
    ],
  },
];

function getFileExtension(fileName: string | null | undefined) {
  const normalized = fileName?.trim().toLowerCase() ?? "";
  const dotIndex = normalized.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
    return null;
  }

  return normalized.slice(dotIndex + 1);
}

export function getBuiltInRingtone(
  preset: CallRingtonePreset | null | undefined,
): BuiltInRingtoneDefinition {
  const fallbackRingtone = builtInCallRingtones[0];

  if (!fallbackRingtone) {
    throw new Error("Built-in ringtone catalog is empty.");
  }

  return (
    builtInCallRingtones.find((item) => item.id === preset) ??
    builtInCallRingtones.find(
      (item) => item.id === defaultCallRingtonePreset,
    ) ??
    fallbackRingtone
  );
}

export function getBuiltInRingtoneLabel(
  preset: CallRingtonePreset | null | undefined,
) {
  return getBuiltInRingtone(preset).label;
}

export function getActiveRingtoneLabel(profile: Profile) {
  if (getCurrentRingtoneMode(profile) === "custom") {
    return profile.customRingtone.originalName?.trim() || "Свой рингтон";
  }

  return getBuiltInRingtoneLabel(profile.callRingtonePreset);
}

export function getCurrentRingtoneMode(profile: Profile) {
  const preferredMode =
    (profile.callRingtoneMode ?? defaultCallRingtoneMode) === "CUSTOM"
      ? "custom"
      : "builtin";

  if (preferredMode === "custom" && profile.customRingtone.fileKey) {
    return "custom";
  }

  return "builtin";
}

export function getStoredRingtoneModeLabel(
  mode: CallRingtoneMode | null | undefined,
) {
  return (mode ?? defaultCallRingtoneMode) === "CUSTOM"
    ? "Свой файл"
    : "Системный";
}

export function getCustomRingtoneApiPath(version: string) {
  return `/v1/users/me/ringtone?v=${encodeURIComponent(version)}`;
}

export function validateRingtoneFileForBrowser(
  file: File,
  maxBytes: number,
): string | null {
  if (file.size <= 0) {
    return "Файл рингтона пустой.";
  }

  if (file.size > maxBytes) {
    const maxMegabytes = Math.round(maxBytes / (1024 * 1024));
    return `Рингтон слишком большой. Максимальный размер: ${maxMegabytes} MB.`;
  }

  const extension = getFileExtension(file.name);

  if (
    !extension ||
    !allowedExtensions.has(extension as SupportedRingtoneExtension)
  ) {
    return "Поддерживаются только MP3, WAV, OGG и M4A.";
  }

  if (typeof document === "undefined") {
    return null;
  }

  const audio = document.createElement("audio");
  const candidates =
    browserMimeCandidates[extension as SupportedRingtoneExtension] ?? [];
  const supported = candidates.some((candidate) => {
    const result = audio.canPlayType(candidate);
    return result === "probably" || result === "maybe";
  });

  if (!supported) {
    return "Этот формат рингтона не поддерживается вашим браузером.";
  }

  return null;
}
