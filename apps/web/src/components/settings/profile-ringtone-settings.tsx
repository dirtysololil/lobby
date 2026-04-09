"use client";

import { Check, Play, Square, Trash2, Upload, Volume2 } from "lucide-react";
import type { PublicUser, UpdateProfileInput } from "@lobby/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { apiClientFetchBlob } from "@/lib/api-client";
import {
  builtInCallRingtones,
  getActiveRingtoneLabel,
  getBuiltInRingtone,
  getBuiltInRingtoneLabel,
  getCurrentRingtoneMode,
  getCustomRingtoneApiPath,
  ringtonePreviewMaxDurationMs,
  ringtoneUploadAccept,
  validateRingtoneFileForBrowser,
} from "@/lib/ringtones";
import { getAudioContextCtor, playToneSequence } from "@/lib/tone-sequence";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProfileRingtoneSettingsProps {
  form: UseFormReturn<UpdateProfileInput>;
  isRemoving: boolean;
  isUploading: boolean;
  maxRingtoneMb: number;
  onError: (message: string) => void;
  onRemove: () => Promise<void>;
  onUpload: (file: File | null) => Promise<void>;
  viewer: PublicUser;
}

function formatBytes(bytes: number | null) {
  if (!bytes) {
    return null;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function useRingtonePreview(
  profileUpdatedAt: string,
  onError: (message: string) => void,
) {
  const [activePreviewKey, setActivePreviewKey] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const synthStopRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  const stopPreview = useCallback(() => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    synthStopRef.current?.();
    synthStopRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setActivePreviewKey(null);
  }, []);

  const getOrCreateAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      return audioContextRef.current;
    }

    const AudioContextCtor = getAudioContextCtor();

    if (!AudioContextCtor) {
      onError("Предпрослушивание рингтона не поддерживается в этом браузере.");
      return null;
    }

    const audioContext = new AudioContextCtor();
    audioContextRef.current = audioContext;
    return audioContext;
  }, [onError]);

  const startStopTimer = useCallback(
    (durationMs: number) => {
      if (stopTimerRef.current !== null) {
        window.clearTimeout(stopTimerRef.current);
      }

      stopTimerRef.current = window.setTimeout(() => {
        stopPreview();
      }, durationMs);
    },
    [stopPreview],
  );

  const toggleBuiltInPreview = useCallback(
    async (preset: UpdateProfileInput["callRingtonePreset"]) => {
      const previewKey = `builtin:${preset}`;

      if (activePreviewKey === previewKey) {
        stopPreview();
        return;
      }

      stopPreview();

      try {
        const audioContext = getOrCreateAudioContext();

        if (!audioContext) {
          return;
        }

        if (audioContext.state !== "running") {
          await audioContext.resume();
        }

        const playback = playToneSequence(
          audioContext,
          getBuiltInRingtone(preset).sequence,
          { defaultGain: 0.03 },
        );

        synthStopRef.current = playback.stop;
        setActivePreviewKey(previewKey);
        startStopTimer(
          Math.min(playback.totalDurationMs, ringtonePreviewMaxDurationMs),
        );
      } catch {
        stopPreview();
        onError("Не удалось воспроизвести стандартный рингтон.");
      }
    },
    [activePreviewKey, getOrCreateAudioContext, onError, startStopTimer, stopPreview],
  );

  const toggleCustomPreview = useCallback(async () => {
    const previewKey = "custom";

    if (activePreviewKey === previewKey) {
      stopPreview();
      return;
    }

    stopPreview();

    try {
      const blob = await apiClientFetchBlob(getCustomRingtoneApiPath(profileUpdatedAt));
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);

      audio.preload = "auto";
      audioRef.current = audio;
      objectUrlRef.current = objectUrl;
      audio.onended = () => {
        stopPreview();
      };

      await audio.play();
      setActivePreviewKey(previewKey);
      startStopTimer(ringtonePreviewMaxDurationMs);
    } catch {
      stopPreview();
      onError("Не удалось воспроизвести загруженный рингтон.");
    }
  }, [activePreviewKey, onError, profileUpdatedAt, startStopTimer, stopPreview]);

  useEffect(() => {
    return () => {
      stopPreview();
      const audioContext = audioContextRef.current;
      audioContextRef.current = null;
      void audioContext?.close().catch(() => undefined);
    };
  }, [stopPreview]);

  return {
    activePreviewKey,
    stopPreview,
    toggleBuiltInPreview,
    toggleCustomPreview,
  };
}

export function ProfileRingtoneSettings({
  form,
  isRemoving,
  isUploading,
  maxRingtoneMb,
  onError,
  onRemove,
  onUpload,
  viewer,
}: ProfileRingtoneSettingsProps) {
  const selectedPreset =
    form.watch("callRingtonePreset") ?? viewer.profile.callRingtonePreset;
  const maxRingtoneBytes = maxRingtoneMb * 1024 * 1024;
  const hasCustomRingtone = Boolean(viewer.profile.customRingtone.fileKey);
  const activeRingtoneMode = getCurrentRingtoneMode(viewer.profile);
  const activeRingtoneLabel = getActiveRingtoneLabel(viewer.profile);
  const selectedPresetLabel = getBuiltInRingtoneLabel(selectedPreset);
  const customRingtoneSize = formatBytes(viewer.profile.customRingtone.bytes);
  const {
    activePreviewKey,
    toggleBuiltInPreview,
    toggleCustomPreview,
  } = useRingtonePreview(viewer.profile.updatedAt, onError);

  async function handleFileSelection(file: File | null) {
    if (!file) {
      return;
    }

    const validationError = validateRingtoneFileForBrowser(file, maxRingtoneBytes);

    if (validationError) {
      onError(validationError);
      return;
    }

    await onUpload(file);
  }

  return (
    <section className="premium-panel overflow-hidden rounded-[24px]">
      <div className="border-b border-[var(--border-soft)] px-4 py-4">
        <p className="section-kicker">Звонки</p>
        <h3 className="mt-1 text-sm font-semibold tracking-tight text-white">
          Рингтон звонка
        </h3>
      </div>

      <div className="grid gap-4 px-4 py-4">
        <div className="grid gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Активный сейчас
              </p>
              <p className="mt-1 truncate text-sm font-medium text-white">
                {activeRingtoneLabel}
              </p>
            </div>

            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",
                activeRingtoneMode === "custom"
                  ? "border-[rgba(106,168,248,0.24)] bg-[rgba(106,168,248,0.12)] text-white"
                  : "border-white/8 bg-white/[0.05] text-[var(--text-soft)]",
              )}
            >
              <Volume2 size={13} strokeWidth={1.5} />
              {activeRingtoneMode === "custom" ? "Свой файл" : "Системный"}
            </span>
          </div>

          <div className="grid gap-2 text-sm text-[var(--text-dim)]">
            <div className="flex items-center justify-between gap-3">
              <span>Стандартный выбор</span>
              <span className="font-medium text-white">{selectedPresetLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Форматы</span>
              <span className="font-medium text-white">MP3, WAV, OGG, M4A</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Лимит</span>
              <span className="font-medium text-white">{maxRingtoneMb} MB</span>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          {builtInCallRingtones.map((ringtone) => {
            const isSelected = selectedPreset === ringtone.id;
            const isPreviewActive = activePreviewKey === `builtin:${ringtone.id}`;

            return (
              <div
                key={ringtone.id}
                className={cn(
                  "flex items-center gap-3 rounded-[18px] border px-3 py-3 transition-colors",
                  isSelected
                    ? "border-[rgba(106,168,248,0.26)] bg-[rgba(106,168,248,0.12)]"
                    : "border-white/8 bg-white/[0.03]",
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    form.setValue("callRingtonePreset", ringtone.id, {
                      shouldDirty: true,
                      shouldTouch: true,
                    })
                  }
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-[rgba(106,168,248,0.3)] bg-[rgba(106,168,248,0.18)] text-white"
                        : "border-white/10 bg-white/[0.04] text-[var(--text-muted)]",
                    )}
                  >
                    {isSelected ? <Check size={15} strokeWidth={2} /> : <Volume2 size={14} strokeWidth={1.6} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">
                      {ringtone.label}
                    </span>
                    <span className="block truncate text-xs text-[var(--text-dim)]">
                      {ringtone.accent}
                    </span>
                  </span>
                </button>

                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void toggleBuiltInPreview(ringtone.id)}
                  className="h-9 shrink-0 rounded-[12px] border-white/8 bg-white/[0.05] px-3 hover:bg-white/[0.09]"
                >
                  {isPreviewActive ? (
                    <Square size={14} strokeWidth={1.8} />
                  ) : (
                    <Play size={14} strokeWidth={1.8} />
                  )}
                  {isPreviewActive ? "Стоп" : "Слушать"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
          <div className="grid gap-3">
            <div className="flex items-start gap-3 rounded-[18px] border border-white/8 bg-white/[0.04] px-3.5 py-3.5">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[var(--text-soft)]">
                <Upload size={17} strokeWidth={1.6} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-white">Свой рингтон</p>
                  <span
                    className={cn(
                      "inline-flex min-h-5 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      hasCustomRingtone
                        ? "border-[rgba(106,168,248,0.22)] bg-[rgba(106,168,248,0.12)] text-white"
                        : "border-white/8 bg-white/[0.04] text-[var(--text-soft)]",
                    )}
                  >
                    {hasCustomRingtone ? "Активен" : "Пока нет файла"}
                  </span>
                </div>

                <p className="mt-2 break-all text-[13px] font-medium leading-5 text-white">
                  {hasCustomRingtone
                    ? viewer.profile.customRingtone.originalName || "Свой рингтон"
                    : "Загрузите MP3, WAV, OGG или M4A, и этот файл станет вашим рингтоном для входящих звонков."}
                </p>
                <p className="mt-1 text-xs text-[var(--text-dim)]">
                  {hasCustomRingtone
                    ? [viewer.profile.customRingtone.mimeType, customRingtoneSize]
                        .filter(Boolean)
                        .join(" • ")
                    : `До ${maxRingtoneMb} MB`}
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-white/8 bg-white/[0.05] px-3.5 text-center text-sm font-medium leading-4 text-white transition-colors hover:border-[var(--border-strong)] hover:bg-white/[0.08]">
                <input
                  type="file"
                  accept={ringtoneUploadAccept}
                  className="hidden"
                  disabled={isUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.currentTarget.value = "";
                    void handleFileSelection(file);
                  }}
                />
                <Upload size={16} strokeWidth={1.6} />
                {isUploading ? "Загружаем..." : hasCustomRingtone ? "Заменить файл" : "Загрузить файл"}
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!hasCustomRingtone}
                  onClick={() => void toggleCustomPreview()}
                  className="h-10 w-full rounded-[14px] border-white/8 bg-white/[0.05] px-3 hover:bg-white/[0.09]"
                >
                  {activePreviewKey === "custom" ? (
                    <Square size={14} strokeWidth={1.8} />
                  ) : (
                    <Play size={14} strokeWidth={1.8} />
                  )}
                  {activePreviewKey === "custom" ? "Стоп" : "Слушать"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={!hasCustomRingtone || isRemoving}
                  onClick={() => void onRemove()}
                  className="h-10 w-full rounded-[14px] border-white/8 bg-white/[0.05] px-3 hover:bg-white/[0.09]"
                >
                  <Trash2 size={15} strokeWidth={1.6} />
                  {isRemoving ? "Удаляем..." : "Удалить"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
