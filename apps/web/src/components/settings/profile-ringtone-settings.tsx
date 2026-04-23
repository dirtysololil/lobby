"use client";

import { Check, Play, Square, Trash2, Upload, Volume2 } from "lucide-react";
import type { PublicUser, UpdateProfileInput } from "@lobby/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CompactListMeta } from "@/components/ui/compact-list";
import { apiClientFetchBlob } from "@/lib/api-client";
import {
  builtInCallRingtones,
  getBuiltInRingtone,
  getBuiltInRingtoneLabel,
  getCurrentRingtoneMode,
  getCustomRingtoneApiPath,
  ringtonePreviewMaxDurationMs,
  ringtoneUploadAccept,
  validateRingtoneFileForBrowser,
} from "@/lib/ringtones";
import { getAudioContextCtor, playToneSequence } from "@/lib/tone-sequence";
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
    [
      activePreviewKey,
      getOrCreateAudioContext,
      onError,
      startStopTimer,
      stopPreview,
    ],
  );

  const toggleCustomPreview = useCallback(async () => {
    const previewKey = "custom";

    if (activePreviewKey === previewKey) {
      stopPreview();
      return;
    }

    stopPreview();

    try {
      const blob = await apiClientFetchBlob(
        getCustomRingtoneApiPath(profileUpdatedAt),
      );
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
  }, [
    activePreviewKey,
    onError,
    profileUpdatedAt,
    startStopTimer,
    stopPreview,
  ]);

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
    useWatch({ control: form.control, name: "callRingtonePreset" }) ??
    viewer.profile.callRingtonePreset;
  const selectedMode =
    useWatch({ control: form.control, name: "callRingtoneMode" }) ??
    viewer.profile.callRingtoneMode;
  const maxRingtoneBytes = maxRingtoneMb * 1024 * 1024;
  const hasCustomRingtone = Boolean(viewer.profile.customRingtone.fileKey);
  const activeRingtoneMode = getCurrentRingtoneMode(viewer.profile);
  const selectedPresetLabel = getBuiltInRingtoneLabel(selectedPreset);
  const selectedRingtoneMode =
    selectedMode === "CUSTOM" && hasCustomRingtone ? "custom" : "builtin";
  const selectedRingtoneLabel =
    selectedRingtoneMode === "custom"
      ? viewer.profile.customRingtone.originalName?.trim() || "Свой рингтон"
      : selectedPresetLabel;
  const customRingtoneSize = formatBytes(viewer.profile.customRingtone.bytes);
  const { activePreviewKey, toggleBuiltInPreview, toggleCustomPreview } =
    useRingtonePreview(viewer.profile.updatedAt, onError);

  async function handleFileSelection(file: File | null) {
    if (!file) {
      return;
    }

    const validationError = validateRingtoneFileForBrowser(
      file,
      maxRingtoneBytes,
    );

    if (validationError) {
      onError(validationError);
      return;
    }

    await onUpload(file);
  }

  return (
    <CollapsibleSection
      title="Рингтон"
      description={selectedRingtoneLabel}
      summary={<CompactListMeta>{activeRingtoneMode === "custom" ? "Свой файл" : "Системный"}</CompactListMeta>}
    >
      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              form.setValue("callRingtoneMode", "BUILTIN", {
                shouldDirty: true,
                shouldTouch: true,
              })
            }
            className={cn(
              "flex min-h-11 items-center justify-between gap-3 rounded-[16px] border px-3.5 py-3 text-left transition-colors",
              selectedMode === "BUILTIN"
                ? "border-[var(--border-strong)] bg-[var(--bg-active)] text-white"
                : "border-white/8 bg-black text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
            )}
          >
            <span>
              <span className="block text-sm font-medium text-white">Системный</span>
              <span className="mt-1 block text-xs text-[var(--text-dim)]">
                {selectedPresetLabel}
              </span>
            </span>
            {selectedMode === "BUILTIN" ? <Check size={16} strokeWidth={1.8} /> : null}
          </button>

          <button
            type="button"
            disabled={!hasCustomRingtone}
            onClick={() =>
              form.setValue("callRingtoneMode", "CUSTOM", {
                shouldDirty: true,
                shouldTouch: true,
              })
            }
            className={cn(
              "flex min-h-11 items-center justify-between gap-3 rounded-[16px] border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              selectedMode === "CUSTOM"
                ? "border-[var(--border-strong)] bg-[var(--bg-active)] text-white"
                : "border-white/8 bg-black text-[var(--text-soft)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]",
            )}
          >
            <span>
              <span className="block text-sm font-medium text-white">Свой файл</span>
              <span className="mt-1 block text-xs text-[var(--text-dim)]">
                {hasCustomRingtone ? "Загружен" : "Сначала загрузите файл"}
              </span>
            </span>
            {selectedMode === "CUSTOM" && hasCustomRingtone ? (
              <Check size={16} strokeWidth={1.8} />
            ) : null}
          </button>
        </div>

        <div className="grid gap-2">
          {builtInCallRingtones.map((ringtone) => {
            const isSelected = selectedPreset === ringtone.id;
            const isPreviewActive =
              activePreviewKey === `builtin:${ringtone.id}`;

            return (
              <div
                key={ringtone.id}
                className={cn(
                  "flex items-center gap-3 rounded-[16px] border px-3 py-2.5",
                  isSelected
                    ? "border-[var(--border-strong)] bg-[var(--bg-active)]"
                    : "border-white/8 bg-black",
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
                        ? "border-[var(--border-strong)] bg-white text-black"
                        : "border-white/10 bg-black text-[var(--text-muted)]",
                    )}
                  >
                    {isSelected ? (
                      <Check size={15} strokeWidth={2} />
                    ) : (
                      <Volume2 size={14} strokeWidth={1.6} />
                    )}
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
                  className="h-8 shrink-0 rounded-[12px] border-white/8 bg-black px-3 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
                >
                  {isPreviewActive ? (
                    <Square size={14} strokeWidth={1.8} />
                  ) : (
                    <Play size={14} strokeWidth={1.8} />
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="rounded-[18px] border border-white/8 bg-black p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-white">Свой файл</p>
            <CompactListMeta>
              {hasCustomRingtone
                ? selectedMode === "CUSTOM"
                  ? "Активен"
                  : "Готов"
                : "Не загружен"}
            </CompactListMeta>
          </div>

          <p className="mt-2 break-all text-sm text-white">
            {hasCustomRingtone
              ? viewer.profile.customRingtone.originalName || "Свой рингтон"
              : "MP3, WAV, OGG или M4A"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-dim)]">
            {hasCustomRingtone
              ? [
                  viewer.profile.customRingtone.mimeType,
                  customRingtoneSize,
                ]
                  .filter(Boolean)
                  .join(" • ")
              : `До ${maxRingtoneMb} MB`}
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-white/8 bg-black px-3.5 text-center text-sm font-medium text-white transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]">
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
              {isUploading ? "Загружаем..." : hasCustomRingtone ? "Заменить" : "Загрузить"}
            </label>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!hasCustomRingtone}
              onClick={() => void toggleCustomPreview()}
              className="h-10 w-full rounded-[14px] border-white/8 bg-black px-3 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
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
              className="h-10 w-full rounded-[14px] border-white/8 bg-black px-3 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
            >
              <Trash2 size={15} strokeWidth={1.6} />
              {isRemoving ? "Удаляем..." : "Удалить"}
            </Button>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
