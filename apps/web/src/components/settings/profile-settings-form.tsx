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
import { SettingsSectionBoundary } from "@/components/settings/settings-section-boundary";
import { AvatarPreviewModal } from "@/components/ui/avatar-preview-modal";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { CompactListMeta } from "@/components/ui/compact-list";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { getAvailabilityLabel } from "@/lib/last-seen";
import { getResolvedPresenceDotClass } from "@/lib/presence";
import { cn } from "@/lib/utils";

interface ProfileSettingsFormProps {
  viewer: PublicUser;
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
  "h-10 rounded-[14px] border-white/8 bg-black px-3.5 text-sm text-white shadow-none hover:border-[var(--border-strong)] focus:bg-black";

const textareaClassName =
  "field-textarea min-h-[104px] rounded-[16px] border-white/8 bg-black px-3.5 py-3 text-sm leading-5 text-white shadow-none hover:border-[var(--border-strong)] focus:bg-black";

const selectClassName =
  "min-h-10 rounded-[14px] border-white/8 bg-black px-3.5 text-sm text-white shadow-none hover:border-[var(--border-strong)]";

const selectListClassName =
  "border-[var(--border)] bg-black p-1 shadow-[0_14px_36px_rgba(0,0,0,0.32)]";

const primaryActionClassName =
  "h-10 rounded-[14px] border-white bg-white px-4 text-black hover:border-white hover:bg-neutral-100";

export function ProfileSettingsForm({
  viewer,
  maxRingtoneMb,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const realtimePresence = useOptionalRealtimePresence();
  const safeViewer: PublicUser = {
    ...viewer,
    profile: {
      displayName: viewer.profile?.displayName ?? viewer.username,
      bio: viewer.profile?.bio ?? null,
      presence: viewer.profile?.presence ?? "OFFLINE",
      avatarPreset: viewer.profile?.avatarPreset ?? "NONE",
      avatar: {
        fileKey: viewer.profile?.avatar?.fileKey ?? null,
        originalName: viewer.profile?.avatar?.originalName ?? null,
        mimeType: viewer.profile?.avatar?.mimeType ?? null,
        bytes: viewer.profile?.avatar?.bytes ?? null,
        width: viewer.profile?.avatar?.width ?? null,
        height: viewer.profile?.avatar?.height ?? null,
        frameCount: viewer.profile?.avatar?.frameCount ?? null,
        animationDurationMs: viewer.profile?.avatar?.animationDurationMs ?? null,
        isAnimated: viewer.profile?.avatar?.isAnimated ?? false,
      },
      callRingtonePreset: viewer.profile?.callRingtonePreset ?? "CLASSIC",
      callRingtoneMode: viewer.profile?.callRingtoneMode ?? "BUILTIN",
      customRingtone: {
        fileKey: viewer.profile?.customRingtone?.fileKey ?? null,
        originalName: viewer.profile?.customRingtone?.originalName ?? null,
        mimeType: viewer.profile?.customRingtone?.mimeType ?? null,
        bytes: viewer.profile?.customRingtone?.bytes ?? null,
      },
      updatedAt: viewer.profile?.updatedAt ?? viewer.createdAt,
    },
  };
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
          ...safeViewer,
          isOnline: Boolean(realtimePresence[safeViewer.id]),
        }
      : safeViewer;
  const trimmedBio = safeViewer.profile.bio?.trim() ?? "";
  const availabilityLabel = getAvailabilityLabel(liveViewer) ?? "Не в сети";
  const hasCustomAvatar = Boolean(safeViewer.profile.avatar.fileKey);
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: safeViewer.profile.displayName,
      bio: safeViewer.profile.bio ?? "",
      presence: safeViewer.profile.presence,
      avatarPreset: safeViewer.profile.avatarPreset,
      callRingtonePreset: safeViewer.profile.callRingtonePreset,
      callRingtoneMode: safeViewer.profile.callRingtoneMode,
    },
  });
  const selectedPresence = form.watch("presence") ?? safeViewer.profile.presence;
  const selectedPreset = form.watch("avatarPreset") ?? safeViewer.profile.avatarPreset;

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
      setMessage("Рингтон загружен. Сохраните профиль, чтобы включить его.");
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
        <section className="premium-panel rounded-[24px] px-4 py-4 sm:px-5">
          <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsAvatarPreviewOpen(true)}
                className="group relative inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                aria-label="Открыть фото профиля"
              >
                <UserAvatar
                  user={safeViewer}
                  size="lg"
                  showPresenceIndicator={false}
                  className="h-[88px] w-[88px] text-[1.35rem] sm:h-[96px] sm:w-[96px]"
                />
                <span className="pointer-events-none absolute inset-x-3 bottom-2 rounded-full border border-white/10 bg-black px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
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

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CompactListMeta>@{safeViewer.username}</CompactListMeta>
                <CompactListMeta className="text-white">
                  {availabilityLabel}
                </CompactListMeta>
                <CompactListMeta>
                  {hasCustomAvatar ? "Свой аватар" : "Стандартный аватар"}
                </CompactListMeta>
              </div>
              <h2 className="mt-3 truncate text-[1.25rem] font-semibold tracking-tight text-white sm:text-[1.4rem]">
                {safeViewer.profile.displayName}
              </h2>
              {trimmedBio ? (
                <p className="mt-2 max-w-[62ch] overflow-hidden text-sm leading-5 text-[var(--text-dim)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                  {trimmedBio}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[228px] lg:grid-cols-1">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-white/8 bg-black px-3 text-sm font-medium text-white transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]">
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
                {isUploadingAvatar ? "Загружаем..." : "Загрузить"}
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleAvatarRemove()}
                disabled={!hasCustomAvatar || isRemovingAvatar}
                className="h-10 rounded-[14px] border-white/8 bg-black px-3 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
              >
                <Trash2 size={15} strokeWidth={1.5} />
                {isRemovingAvatar ? "Удаляем..." : "Удалить"}
              </Button>
            </div>
          </div>
        </section>

        <form
          className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,368px)]"
          onSubmit={form.handleSubmit((values) => void onSubmit(values))}
        >
          <section className="premium-panel overflow-hidden rounded-[24px]">
            <div className="border-b border-[var(--border-soft)] px-4 py-3.5 sm:px-5">
              <p className="section-kicker">Основное</p>
              <h3 className="mt-1 text-base font-semibold tracking-tight text-white">
                Профиль
              </h3>
            </div>

            <div className="grid gap-4 px-4 py-4 sm:px-5">
              <div className="grid gap-2">
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

              <div className="grid gap-2">
                <Label htmlFor="bio">О себе</Label>
                <textarea
                  id="bio"
                  rows={4}
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
          </section>

          <div className="grid gap-3">
            <CollapsibleSection
              defaultOpen
              kicker="Видимость"
              title="Статус и стиль"
              summary={
                <div className="hidden flex-wrap justify-end gap-2 sm:flex">
                  <CompactListMeta>{presenceLabels[selectedPresence]}</CompactListMeta>
                  <CompactListMeta>{presetLabels[selectedPreset]}</CompactListMeta>
                </div>
              }
            >
              <div className="grid gap-3">
                <div className="grid gap-2">
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

                <div className="grid gap-2">
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
            </CollapsibleSection>

            <SettingsSectionBoundary
              title="Рингтон временно недоступен"
              description="Не удалось отрисовать настройки рингтона. Остальные параметры профиля доступны."
              resetKeys={[safeViewer.id, safeViewer.profile.updatedAt]}
            >
              <ProfileRingtoneSettings
                viewer={safeViewer}
                form={form}
                maxRingtoneMb={maxRingtoneMb}
                isUploading={isUploadingRingtone}
                isRemoving={isRemovingRingtone}
                onUpload={handleRingtoneUpload}
                onRemove={handleRingtoneRemove}
                onError={(nextMessage) => {
                  setError(nextMessage);
                  setMessage(null);
                }}
              />
            </SettingsSectionBoundary>
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
                  className={primaryActionClassName}
                >
                  {form.formState.isSubmitting ? "Сохраняем..." : "Сохранить"}
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
                  className="h-10 rounded-[14px] border-white/8 bg-black px-4 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
                >
                  Сбросить
                </Button>
              </div>
            </div>
          </section>
        </form>
      </div>

      <AvatarPreviewModal
        user={safeViewer}
        open={isAvatarPreviewOpen}
        onClose={() => setIsAvatarPreviewOpen(false)}
      />
    </>
  );
}
