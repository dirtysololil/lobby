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
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useOptionalRealtimePresence } from "@/components/realtime/realtime-provider";
import { ProfileRingtoneSettings } from "@/components/settings/profile-ringtone-settings";
import { SettingsSectionBoundary } from "@/components/settings/settings-section-boundary";
import { AvatarPreviewModal } from "@/components/ui/avatar-preview-modal";
import { Button } from "@/components/ui/button";
import { CompactListMeta } from "@/components/ui/compact-list";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiClientFetch } from "@/lib/api-client";
import { getAvailabilityLabel } from "@/lib/last-seen";
import { getPresenceDotClass, getResolvedPresenceDotClass } from "@/lib/presence";
import { getBuiltInRingtoneLabel } from "@/lib/ringtones";
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
  "h-11 rounded-[16px] border-white/8 bg-black px-4 text-sm text-white shadow-none hover:border-[var(--border-strong)] focus:bg-black";

const textareaClassName =
  "field-textarea min-h-[144px] rounded-[18px] border-white/8 bg-black px-4 py-3 text-sm leading-6 text-white shadow-none hover:border-[var(--border-strong)] focus:bg-black";

const selectClassName =
  "min-h-11 rounded-[16px] border-white/8 bg-black px-4 text-sm text-white shadow-none hover:border-[var(--border-strong)]";

const selectListClassName =
  "border-[var(--border)] bg-black p-1 shadow-[0_14px_36px_rgba(0,0,0,0.32)]";

const primaryActionClassName =
  "h-11 rounded-[16px] border-white bg-white px-5 text-sm font-medium text-black hover:border-white hover:bg-neutral-100";

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-[var(--border-soft)] bg-black px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-white">{value}</p>
        {accent ? <div className="shrink-0">{accent}</div> : null}
      </div>
    </div>
  );
}

function FormCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[var(--border-soft)] bg-[var(--bg-panel-muted)] p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-3">
        <p className="text-sm font-semibold tracking-tight text-white">{title}</p>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

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

  const hasCustomAvatar = Boolean(safeViewer.profile.avatar.fileKey);
  const hasCustomRingtone = Boolean(safeViewer.profile.customRingtone.fileKey);
  const availabilityLabel = getAvailabilityLabel(liveViewer) ?? "Не в сети";

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

  const displayNameValue =
    form.watch("displayName")?.trim() || safeViewer.profile.displayName;
  const bioValue = form.watch("bio") ?? "";
  const bioPreview = bioValue.trim();
  const selectedPresence = form.watch("presence") ?? safeViewer.profile.presence;
  const selectedPreset = form.watch("avatarPreset") ?? safeViewer.profile.avatarPreset;
  const selectedRingtonePreset =
    form.watch("callRingtonePreset") ?? safeViewer.profile.callRingtonePreset;
  const selectedRingtoneMode =
    form.watch("callRingtoneMode") ?? safeViewer.profile.callRingtoneMode;
  const selectedRingtoneLabel =
    selectedRingtoneMode === "CUSTOM" && hasCustomRingtone
      ? safeViewer.profile.customRingtone.originalName?.trim() || "Свой рингтон"
      : getBuiltInRingtoneLabel(selectedRingtonePreset);
  const isDirty = form.formState.isDirty;

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
        <form
          className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]"
          onSubmit={form.handleSubmit((values) => void onSubmit(values))}
        >
          <section className="premium-panel overflow-hidden rounded-[26px]">
            <div className="grid gap-4 border-b border-[var(--border-soft)] px-4 py-4 sm:px-5 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
              <div className="relative mx-auto lg:mx-0">
                <button
                  type="button"
                  onClick={() => setIsAvatarPreviewOpen(true)}
                  className="group relative inline-flex rounded-[24px] border border-[var(--border-soft)] bg-black p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  aria-label="Открыть фото профиля"
                >
                  <UserAvatar
                    user={safeViewer}
                    size="lg"
                    showPresenceIndicator={false}
                    className="h-[84px] w-[84px] rounded-[18px] text-[1.25rem] sm:h-[92px] sm:w-[92px]"
                  />
                  <span className="pointer-events-none absolute inset-x-3 bottom-3 rounded-full border border-white/10 bg-black px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    Просмотр
                  </span>
                </button>
                <span className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-black bg-black">
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
                  <CompactListMeta>{presetLabels[selectedPreset]}</CompactListMeta>
                </div>
                <h2 className="mt-3 truncate text-[1.4rem] font-semibold tracking-[-0.04em] text-white sm:text-[1.65rem]">
                  {displayNameValue}
                </h2>
                <p className="mt-2 max-w-[66ch] overflow-hidden text-sm leading-6 text-[var(--text-dim)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                  {bioPreview || "Добавьте короткое описание, чтобы профиль выглядел живее."}
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <SummaryTile
                    label="Статус"
                    value={presenceLabels[selectedPresence]}
                    accent={
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          getPresenceDotClass(selectedPresence),
                        )}
                      />
                    }
                  />
                  <SummaryTile
                    label="Рингтон"
                    value={selectedRingtoneLabel}
                    accent={
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {selectedRingtoneMode === "CUSTOM" && hasCustomRingtone
                          ? "Свой"
                          : "Системный"}
                      </span>
                    }
                  />
                  <SummaryTile
                    label="Аватар"
                    value={hasCustomAvatar ? "Свой файл" : "Стандартный"}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 px-4 py-4 sm:px-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                <FormCard
                  title="Отображаемое имя"
                  description="Имя, которое видно в сообщениях и профиле."
                >
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Имя</Label>
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
                </FormCard>

                <FormCard
                  title="О себе"
                  description="Короткий текст о вас. Лучше работает компактная подача."
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="bio">Описание</Label>
                      <span className="text-xs text-[var(--text-muted)]">
                        {bioValue.trim().length} симв.
                      </span>
                    </div>
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
                </FormCard>
              </div>
            </div>
          </section>

          <div className="grid gap-3">
            <section className="premium-panel overflow-hidden rounded-[24px]">
              <div className="border-b border-[var(--border-soft)] px-4 py-3.5">
                <p className="section-kicker">Управление</p>
                <h3 className="mt-1 text-base font-semibold tracking-tight text-white">
                  Медиа и действия
                </h3>
              </div>

              <div className="grid gap-3 px-4 py-4">
                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[16px] border border-white/8 bg-black px-4 text-sm font-medium text-white transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]">
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
                  className="min-h-11 rounded-[16px] border-white/8 bg-black px-4 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
                >
                  <Trash2 size={15} strokeWidth={1.5} />
                  {isRemovingAvatar ? "Удаляем..." : "Удалить аватар"}
                </Button>

                <div className="rounded-[16px] border border-[var(--border-soft)] bg-black px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Источник
                    </span>
                    <CompactListMeta>
                      {hasCustomAvatar ? "Свой файл" : "Системный"}
                    </CompactListMeta>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                    {hasCustomAvatar
                      ? "Текущий аватар загружен вручную."
                      : "Сейчас используется стандартный аватар."}
                  </p>
                </div>
              </div>
            </section>

            <section className="premium-panel overflow-hidden rounded-[24px]">
              <div className="border-b border-[var(--border-soft)] px-4 py-3.5">
                <p className="section-kicker">Видимость</p>
                <h3 className="mt-1 text-base font-semibold tracking-tight text-white">
                  Статус и стиль
                </h3>
              </div>

              <div className="grid gap-3 px-4 py-4">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <SummaryTile
                    label="Статус"
                    value={presenceLabels[selectedPresence]}
                    accent={
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          getPresenceDotClass(selectedPresence),
                        )}
                      />
                    }
                  />
                  <SummaryTile
                    label="Стиль"
                    value={presetLabels[selectedPreset]}
                  />
                </div>

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
            </section>

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

          <section className="premium-panel col-span-full rounded-[24px] px-4 py-3.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-h-[24px] flex-wrap items-center gap-2 text-sm">
                <CompactListMeta className={cn(isDirty && "border-[var(--border-strong)] text-white")}>
                  {isDirty ? "Есть изменения" : "Без изменений"}
                </CompactListMeta>
                {error ? (
                  <p className="text-rose-200">{error}</p>
                ) : message ? (
                  <p className="text-emerald-200">{message}</p>
                ) : (
                  <p className="text-[var(--text-dim)]">
                    Изменения применятся после сохранения.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
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
                  className="h-11 rounded-[16px] border-white/8 bg-black px-4 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
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
