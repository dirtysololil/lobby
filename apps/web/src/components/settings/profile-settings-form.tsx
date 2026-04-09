"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Trash2 } from "lucide-react";
import {
  updateProfileSchema,
  type PublicUser,
  type UpdateProfileInput,
  type UserResponse,
} from "@lobby/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useOptionalRealtimePresence } from "@/components/realtime/realtime-provider";
import { ProfileRingtoneSettings } from "@/components/settings/profile-ringtone-settings";
import { SelectField } from "@/components/ui/select-field";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AvatarPreviewModal } from "@/components/ui/avatar-preview-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClientFetch } from "@/lib/api-client";
import { getAvailabilityLabel } from "@/lib/last-seen";
import { getResolvedPresenceDotClass } from "@/lib/presence";
import { cn } from "@/lib/utils";

interface ProfileSettingsFormProps {
  viewer: PublicUser;
  maxAvatarMb: number;
  maxAvatarAnimationMs: number;
  maxRingtoneMb: number;
}

const presenceOptions: UpdateProfileInput["presence"][] = [
  "ONLINE",
  "IDLE",
  "DND",
  "OFFLINE",
];

const presetOptions: UpdateProfileInput["avatarPreset"][] = [
  "NONE",
  "GOLD_GLOW",
  "NEON_BLUE",
  "PREMIUM_PURPLE",
  "ANIMATED_RING",
];

const presenceLabels: Record<UpdateProfileInput["presence"], string> = {
  ONLINE: "В сети",
  IDLE: "Отошел",
  DND: "Не беспокоить",
  OFFLINE: "Не в сети",
};

const presetLabels: Record<UpdateProfileInput["avatarPreset"], string> = {
  NONE: "Без эффекта",
  GOLD_GLOW: "Золотой ореол",
  NEON_BLUE: "Сигнальный синий",
  PREMIUM_PURPLE: "Премиум-ореол",
  ANIMATED_RING: "Анимированный ореол",
};

const fieldClassName =
  "h-11 rounded-[14px] border-white/8 bg-white/[0.03] px-3.5 text-sm text-white shadow-none hover:border-[var(--border-strong)] focus:bg-white/[0.05]";

const textareaClassName =
  "field-textarea min-h-[132px] rounded-[16px] border-white/8 bg-white/[0.03] px-3.5 py-3 text-sm leading-6 text-white shadow-none hover:border-[var(--border-strong)] focus:bg-white/[0.05]";

const selectClassName =
  "min-h-11 rounded-[14px] border-white/8 bg-white/[0.03] px-3.5 text-sm text-white shadow-none hover:border-[var(--border-strong)]";

const selectListClassName =
  "border-[var(--border)] bg-[var(--bg-panel)] p-1 shadow-[0_14px_36px_rgba(4,8,16,0.32)]";

export function ProfileSettingsForm({
  viewer,
  maxAvatarMb,
  maxAvatarAnimationMs,
  maxRingtoneMb,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const realtimePresence = useOptionalRealtimePresence();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [isUploadingRingtone, setIsUploadingRingtone] = useState(false);
  const [isRemovingRingtone, setIsRemovingRingtone] = useState(false);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const liveViewer =
    realtimePresence !== null
      ? {
          ...viewer,
          isOnline: Boolean(realtimePresence[viewer.id]),
        }
      : viewer;
  const trimmedBio = viewer.profile.bio?.trim() ?? "";
  const availabilityLabel = getAvailabilityLabel(liveViewer) ?? "Не в сети";
  const hasCustomAvatar = Boolean(viewer.profile.avatar.fileKey);
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: viewer.profile.displayName,
      bio: viewer.profile.bio ?? "",
      presence: viewer.profile.presence,
      avatarPreset: viewer.profile.avatarPreset,
      callRingtonePreset: viewer.profile.callRingtonePreset,
    },
  });

  async function onSubmit(values: UpdateProfileInput) {
    setError(null);
    setMessage(null);

    try {
      await apiClientFetch<UserResponse>("/v1/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      setMessage("Профиль обновлен.");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Не удалось обновить профиль.",
      );
    }
  }

  async function handleAvatarUpload(file: File | null) {
    if (!file) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsUploadingAvatar(true);

    try {
      const payload = new FormData();
      payload.append("file", file);
      await apiClientFetch<UserResponse>("/v1/users/me/avatar", {
        method: "POST",
        body: payload,
      });
      setMessage("Аватар обновлен.");
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить аватар.",
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleAvatarRemove() {
    setError(null);
    setMessage(null);
    setIsRemovingAvatar(true);

    try {
      await apiClientFetch<UserResponse>("/v1/users/me/avatar", {
        method: "DELETE",
      });
      setMessage("Аватар удален.");
      router.refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Не удалось удалить аватар.",
      );
    } finally {
      setIsRemovingAvatar(false);
    }
  }

  async function handleRingtoneUpload(file: File | null) {
    if (!file) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsUploadingRingtone(true);

    try {
      const payload = new FormData();
      payload.append("file", file);
      await apiClientFetch<UserResponse>("/v1/users/me/ringtone", {
        method: "POST",
        body: payload,
      });
      setMessage("Рингтон обновлен.");
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить рингтон.",
      );
    } finally {
      setIsUploadingRingtone(false);
    }
  }

  async function handleRingtoneRemove() {
    setError(null);
    setMessage(null);
    setIsRemovingRingtone(true);

    try {
      await apiClientFetch<UserResponse>("/v1/users/me/ringtone", {
        method: "DELETE",
      });
      setMessage("Кастомный рингтон удален.");
      router.refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Не удалось удалить рингтон.",
      );
    } finally {
      setIsRemovingRingtone(false);
    }
  }

  return (
    <>
      <div className="grid gap-3">
        <section className="premium-panel rounded-[24px] px-4 py-4 sm:px-5 xl:px-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(228px,244px)] xl:items-center">
            <div className="flex min-w-0 items-start gap-4 sm:gap-5">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAvatarPreviewOpen(true)}
                  className="group relative inline-flex rounded-full transition-transform duration-150 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  aria-label="Открыть фото профиля"
                >
                  <UserAvatar
                    user={viewer}
                    size="lg"
                    showPresenceIndicator={false}
                    className="h-[108px] w-[108px] text-[1.55rem] shadow-[0_18px_34px_rgba(4,8,16,0.2)]"
                  />
                  <span className="pointer-events-none absolute inset-x-3 bottom-3 rounded-full border border-white/10 bg-[rgba(8,12,18,0.82)] px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    Просмотр
                  </span>
                </button>
                <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-[var(--bg-panel)] bg-[var(--bg-panel)]">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      getResolvedPresenceDotClass(liveViewer),
                    )}
                  />
                </span>
              </div>

              <div className="min-w-0 py-1 xl:pr-3">
                <h2 className="truncate text-[1.35rem] font-semibold tracking-tight text-white">
                  {viewer.profile.displayName}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-[var(--text-muted)]">@{viewer.username}</span>
                  <span className="h-1 w-1 rounded-full bg-white/12" />
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",
                      liveViewer.isOnline
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                        : "border-white/8 bg-white/[0.04] text-[var(--text-soft)]",
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        getResolvedPresenceDotClass(liveViewer),
                      )}
                    />
                    {availabilityLabel}
                  </span>
                </div>
                {trimmedBio ? (
                  <p className="mt-3 max-w-[64ch] text-sm leading-6 text-[var(--text-dim)]">
                    {trimmedBio}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 xl:min-w-[228px]">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-white/8 bg-white/[0.05] px-3 text-sm font-medium text-white transition-colors hover:border-[var(--border-strong)] hover:bg-white/[0.08]">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) =>
                    void handleAvatarUpload(event.target.files?.[0] ?? null)
                  }
                  disabled={isUploadingAvatar}
                />
                <Camera size={16} strokeWidth={1.5} />
                {isUploadingAvatar ? "Загружаем..." : "Загрузить аватар"}
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleAvatarRemove()}
                disabled={!hasCustomAvatar || isRemovingAvatar}
                className="h-10 rounded-[14px] border-white/8 bg-white/[0.04] px-3 hover:bg-white/[0.07]"
              >
                <Trash2 size={15} strokeWidth={1.5} />
                {isRemovingAvatar ? "Удаляем..." : "Удалить аватар"}
              </Button>
            </div>
          </div>
        </section>

        <form
          className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(340px,408px)] 2xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,432px)]"
          onSubmit={form.handleSubmit((values) => void onSubmit(values))}
        >
          <section className="premium-panel overflow-hidden rounded-[24px]">
            <div className="border-b border-[var(--border-soft)] px-5 py-4">
              <p className="section-kicker">Основное</p>
              <h3 className="mt-1 text-base font-semibold tracking-tight text-white">
                Профиль
              </h3>
            </div>

            <div className="grid">
              <div className="px-5 py-4">
                <div className="grid gap-2.5">
                  <Label htmlFor="displayName">Отображаемое имя</Label>
                  <Input
                    id="displayName"
                    {...form.register("displayName")}
                    className={fieldClassName}
                  />
                  {form.formState.errors.displayName ? (
                    <p className="text-sm text-rose-200">
                      {form.formState.errors.displayName.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-[var(--border-soft)] px-5 py-4">
                <div className="grid gap-2.5">
                  <Label htmlFor="bio">О себе</Label>
                  <textarea
                    id="bio"
                    rows={5}
                    className={textareaClassName}
                    {...form.register("bio")}
                  />
                  {form.formState.errors.bio ? (
                    <p className="text-sm text-rose-200">
                      {form.formState.errors.bio.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-3">
            <section className="premium-panel overflow-hidden rounded-[24px]">
              <div className="border-b border-[var(--border-soft)] px-4 py-4">
                <p className="section-kicker">Медиа</p>
                <h3 className="mt-1 text-sm font-semibold tracking-tight text-white">
                  Аватар
                </h3>
              </div>

              <div className="grid">
                {[
                  {
                    label: "Текущий режим",
                    value: hasCustomAvatar ? "Свой файл" : "Стандартный",
                  },
                  { label: "Форматы", value: "PNG, JPG, WEBP, GIF" },
                  { label: "Размер", value: `${maxAvatarMb} MB` },
                  {
                    label: "Анимация",
                    value: `${Math.floor(maxAvatarAnimationMs / 1000)} c`,
                  },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-3",
                      index > 0 && "border-t border-[var(--border-soft)]",
                    )}
                  >
                    <span className="text-sm text-[var(--text-dim)]">{item.label}</span>
                    <span className="text-sm font-medium text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <ProfileRingtoneSettings
              viewer={viewer}
              form={form}
              maxRingtoneMb={maxRingtoneMb}
              isUploading={isUploadingRingtone}
              isRemoving={isRemovingRingtone}
              onUpload={handleRingtoneUpload}
              onRemove={handleRingtoneRemove}
              onError={(message) => {
                setError(message);
                setMessage(null);
              }}
            />

            <section className="premium-panel overflow-hidden rounded-[24px]">
              <div className="border-b border-[var(--border-soft)] px-4 py-4">
                <p className="section-kicker">Видимость</p>
                <h3 className="mt-1 text-sm font-semibold tracking-tight text-white">
                  Статус и стиль
                </h3>
              </div>

              <div className="grid gap-4 px-4 py-4">
                <div className="grid gap-2.5">
                  <Label htmlFor="presence">Статус</Label>
                  <SelectField
                    id="presence"
                    className={selectClassName}
                    listClassName={selectListClassName}
                    {...form.register("presence")}
                  >
                    {presenceOptions.map((option) => (
                      <option key={option} value={option}>
                        {presenceLabels[option]}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div className="grid gap-2.5">
                  <Label htmlFor="avatarPreset">Стиль аватара</Label>
                  <SelectField
                    id="avatarPreset"
                    className={selectClassName}
                    listClassName={selectListClassName}
                    {...form.register("avatarPreset")}
                  >
                    {presetOptions.map((option) => (
                      <option key={option} value={option}>
                        {presetLabels[option]}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>
            </section>
          </div>

          <section className="premium-panel col-span-full rounded-[24px] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-[20px] text-sm">
                {error ? (
                  <p className="text-rose-200">{error}</p>
                ) : message ? (
                  <p className="text-emerald-200">{message}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="h-11 rounded-[14px] px-5"
                >
                  {form.formState.isSubmitting ? "Сохраняем..." : "Сохранить профиль"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    form.reset();
                    setError(null);
                    setMessage(null);
                  }}
                  disabled={form.formState.isSubmitting}
                  className="h-11 rounded-[14px] border-white/8 bg-white/[0.04] px-4 hover:bg-white/[0.07]"
                >
                  Сбросить
                </Button>
              </div>
            </div>
          </section>
        </form>
      </div>

      <AvatarPreviewModal
        user={viewer}
        open={isAvatarPreviewOpen}
        onClose={() => setIsAvatarPreviewOpen(false)}
      />
    </>
  );
}
