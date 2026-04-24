"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AtSign,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Mail,
  Phone,
  Save,
  Trash2,
} from "lucide-react";
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
import { ProfileEmojiPicker } from "@/components/settings/profile-emoji-picker";
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
import { getPresenceDotClass, getResolvedPresenceDotClass } from "@/lib/presence";
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
  "h-11 rounded-[12px] border-white/8 bg-black px-3.5 text-sm text-white shadow-none hover:border-[var(--border-strong)] focus:bg-black";

const textareaClassName =
  "field-textarea min-h-[132px] rounded-[14px] border-white/8 bg-black px-3.5 py-3 text-sm leading-6 text-white shadow-none hover:border-[var(--border-strong)] focus:bg-black";

const selectClassName =
  "min-h-11 rounded-[12px] border-white/8 bg-black px-3.5 text-sm text-white shadow-none hover:border-[var(--border-strong)]";

const selectListClassName =
  "border-[var(--border)] bg-black p-1 shadow-[0_14px_36px_rgba(0,0,0,0.32)]";

const primaryActionClassName =
  "h-11 rounded-[12px] border-white bg-white px-5 text-sm font-medium text-black hover:border-white hover:bg-neutral-100";

function getBirthDateSegments(value: string) {
  const [year = "", month = "", day = ""] = value.split("-");

  return {
    day: day.replace(/\D/g, "").slice(0, 2),
    month: month.replace(/\D/g, "").slice(0, 2),
    year: year.replace(/\D/g, "").slice(0, 4),
  };
}

function buildBirthDateValue({
  day,
  month,
  year,
}: {
  day: string;
  month: string;
  year: string;
}) {
  if (!day && !month && !year) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function formatBirthDateForDisplay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  return `${match[3]}.${match[2]}.${match[1]}`;
}

function BirthDateField({
  id,
  labelId,
  value,
  onChange,
}: {
  id: string;
  labelId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const segments = getBirthDateSegments(value);

  function commitSegment(
    segment: keyof ReturnType<typeof getBirthDateSegments>,
    nextValue: string,
  ) {
    const nextSegments = {
      ...segments,
      [segment]: nextValue.replace(/\D/g, "").slice(0, segment === "year" ? 4 : 2),
    };

    onChange(buildBirthDateValue(nextSegments));
  }

  return (
    <div
      id={id}
      className="flex h-11 w-full items-center justify-center rounded-[12px] border border-white/8 bg-black px-3 text-sm text-white transition-colors hover:border-[var(--border-strong)] focus-within:border-[var(--border-strong)] focus-within:ring-2 focus-within:ring-[var(--ring)]"
      role="group"
      aria-labelledby={labelId}
    >
      <input
        type="text"
        inputMode="numeric"
        aria-label="День рождения"
        placeholder="ДД"
        value={segments.day}
        onChange={(event) => commitSegment("day", event.target.value)}
        className="h-full w-7 border-0 bg-transparent p-0 text-center text-sm text-white outline-none placeholder:text-[var(--text-muted)]"
        maxLength={2}
      />
      <span className="px-1 text-[var(--text-muted)]">/</span>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Месяц рождения"
        placeholder="ММ"
        value={segments.month}
        onChange={(event) => commitSegment("month", event.target.value)}
        className="h-full w-7 border-0 bg-transparent p-0 text-center text-sm text-white outline-none placeholder:text-[var(--text-muted)]"
        maxLength={2}
      />
      <span className="px-1 text-[var(--text-muted)]">/</span>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Год рождения"
        placeholder="ГГГГ"
        value={segments.year}
        onChange={(event) => commitSegment("year", event.target.value)}
        className="h-full w-12 border-0 bg-transparent p-0 text-center text-sm text-white outline-none placeholder:text-[var(--text-muted)]"
        maxLength={4}
      />
    </div>
  );
}

function InfoPill({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-black px-2.5 py-1 text-[11px] font-medium text-[var(--text-soft)]">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

function ProfileMetaCell({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-h-[72px] items-center gap-3 bg-[var(--bg-panel)] px-4 py-3 sm:px-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border-soft)] bg-black text-[var(--text-soft)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="section-kicker block">{label}</span>
        <span className="mt-1 block truncate text-sm font-medium text-white">
          {value}
        </span>
      </span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  accent?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-[var(--border-soft)] bg-black px-3.5 py-3",
        className,
      )}
    >
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

function FormPanel({
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
    <section
      className={cn(
        "premium-panel rounded-[22px] px-4 py-4 sm:px-5 sm:py-5",
        className,
      )}
    >
      <div className="mb-4 flex flex-col gap-1">
        <p className="section-kicker">{title}</p>
        {description ? (
          <p className="max-w-[62ch] text-sm leading-5 text-[var(--text-dim)]">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
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
      fullName: viewer.profile?.fullName ?? null,
      bio: viewer.profile?.bio ?? null,
      birthDate: viewer.profile?.birthDate ?? null,
      phone: viewer.profile?.phone ?? null,
      statusEmoji: viewer.profile?.statusEmoji ?? null,
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
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      email: safeViewer.email,
      displayName: safeViewer.profile.displayName,
      fullName: safeViewer.profile.fullName ?? "",
      bio: safeViewer.profile.bio ?? "",
      birthDate: safeViewer.profile.birthDate ?? "",
      phone: safeViewer.profile.phone ?? "",
      statusEmoji: safeViewer.profile.statusEmoji ?? "",
      presence: safeViewer.profile.presence,
      avatarPreset: safeViewer.profile.avatarPreset,
      callRingtonePreset: safeViewer.profile.callRingtonePreset,
      callRingtoneMode: safeViewer.profile.callRingtoneMode,
    },
  });

  const nicknameValue =
    form.watch("displayName")?.trim() || safeViewer.profile.displayName;
  const fullNameValue = form.watch("fullName")?.trim() || "";
  const emailValue = form.watch("email")?.trim() || safeViewer.email;
  const phoneValue = form.watch("phone")?.trim() || "";
  const birthDateValue = form.watch("birthDate")?.trim() || "";
  const birthDateDisplay = birthDateValue
    ? formatBirthDateForDisplay(birthDateValue)
    : "";
  const statusEmojiValue = form.watch("statusEmoji")?.trim() || "";
  const bioValue = form.watch("bio") ?? "";
  const bioPreview = bioValue.trim();
  const selectedPresence = form.watch("presence") ?? safeViewer.profile.presence;
  const selectedPreset = form.watch("avatarPreset") ?? safeViewer.profile.avatarPreset;
  const isDirty = form.formState.isDirty;
  const profileFields = [
    nicknameValue,
    emailValue,
    fullNameValue,
    phoneValue,
    birthDateValue,
    bioPreview,
    statusEmojiValue,
  ];
  const completedProfileFields = profileFields.filter(
    (value) => value.trim().length > 0,
  ).length;
  const profileCompletion = Math.round(
    (completedProfileFields / profileFields.length) * 100,
  );

  async function onSubmit(values: UpdateProfileInput) {
    setError(null);
    setMessage(null);

    try {
      await apiClientFetch<UserResponse>("/v1/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...values,
          fullName: values.fullName?.trim() || null,
          bio: values.bio?.trim() || null,
          birthDate: values.birthDate?.trim() || null,
          phone: values.phone?.trim() || null,
          statusEmoji: values.statusEmoji?.trim() || null,
        }),
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
      <div className="w-full">
        <form
          className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]"
          onSubmit={form.handleSubmit((values) => void onSubmit(values))}
        >
          <section className="premium-panel col-span-full overflow-hidden rounded-[24px]">
            <div className="grid gap-5 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,260px)] lg:items-center">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative w-max">
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
                      className="h-[96px] w-[96px] text-[1.4rem] sm:h-[112px] sm:w-[112px]"
                    />
                    <span className="pointer-events-none absolute inset-x-1/2 bottom-3 -translate-x-1/2 rounded-full border border-white/10 bg-black px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      Просмотр
                    </span>
                  </button>
                  <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full border-[4px] border-black bg-black">
                    <span
                      className={cn(
                        "h-3 w-3 rounded-full",
                        getResolvedPresenceDotClass(liveViewer),
                      )}
                    />
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="truncate text-[1.55rem] font-semibold tracking-normal text-white sm:text-[1.9rem]">
                      {nicknameValue}
                    </h2>
                    <ProfileEmojiPicker
                      value={statusEmojiValue || null}
                      onChange={(value) =>
                        form.setValue("statusEmoji", value ?? "", {
                          shouldDirty: true,
                          shouldTouch: true,
                        })
                      }
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-dim)]">
                    <span>@{safeViewer.username}</span>
                    {fullNameValue ? <span>{fullNameValue}</span> : null}
                    {birthDateDisplay ? <span>{birthDateDisplay}</span> : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <InfoPill icon={<Mail size={12} strokeWidth={1.8} />}>
                      {emailValue}
                    </InfoPill>
                    {phoneValue ? (
                      <InfoPill icon={<Phone size={12} strokeWidth={1.8} />}>
                        {phoneValue}
                      </InfoPill>
                    ) : null}
                    <InfoPill icon={<BadgeCheck size={12} strokeWidth={1.8} />}>
                      {presetLabels[selectedPreset]}
                    </InfoPill>
                  </div>

                  <p className="mt-3 max-w-[62ch] overflow-hidden text-sm leading-6 text-[var(--text-dim)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                    {bioPreview ||
                      "Добавьте короткое описание, чтобы профиль выглядел живее."}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-white/8 bg-black px-4 text-sm font-medium text-white transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]">
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
                  className="min-h-11 rounded-[12px] border-white/8 bg-black px-4 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
                >
                  <Trash2 size={15} strokeWidth={1.5} />
                  {isRemovingAvatar ? "Удаляем..." : "Удалить аватар"}
                </Button>
              </div>
            </div>

            <div className="grid gap-px border-t border-[var(--border-soft)] bg-[var(--border-soft)] sm:grid-cols-2 xl:grid-cols-4">
              <ProfileMetaCell
                icon={<AtSign size={16} strokeWidth={1.7} />}
                label="Логин"
                value={`@${safeViewer.username}`}
              />
              <ProfileMetaCell
                icon={<Mail size={16} strokeWidth={1.7} />}
                label="Почта"
                value={emailValue}
              />
              <ProfileMetaCell
                icon={
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      getPresenceDotClass(selectedPresence),
                    )}
                  />
                }
                label="Статус"
                value={presenceLabels[selectedPresence]}
              />
              <ProfileMetaCell
                icon={<BadgeCheck size={16} strokeWidth={1.7} />}
                label="Аватар"
                value={presetLabels[selectedPreset]}
              />
            </div>
          </section>

          <div className="grid gap-3">
            <FormPanel
              title="Контакты"
              description="Ник, почта и телефон собраны рядом, чтобы основные данные быстро считывались."
            >
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Ник</Label>
                  <Input
                    id="displayName"
                    {...form.register("displayName")}
                    className={fieldClassName}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Почта</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    className={fieldClassName}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+7 999 123-45-67"
                    {...form.register("phone")}
                    className={fieldClassName}
                  />
                </div>

                {form.formState.errors.displayName ? (
                  <p className="text-sm text-rose-200 lg:col-span-3">
                    {form.formState.errors.displayName.message}
                  </p>
                ) : null}
                {form.formState.errors.email ? (
                  <p className="text-sm text-rose-200 lg:col-span-3">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
                {form.formState.errors.phone ? (
                  <p className="text-sm text-rose-200 lg:col-span-3">
                    {form.formState.errors.phone.message}
                  </p>
                ) : null}
              </div>
            </FormPanel>

            <FormPanel
              title="Личные данные"
              description="ФИО и дата рождения отображаются в публичной карточке профиля."
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_176px] 2xl:grid-cols-[minmax(0,1fr)_184px]">
                <div className="space-y-2">
                  <Label htmlFor="fullName">ФИО</Label>
                  <Input
                    id="fullName"
                    placeholder="Имя Фамилия"
                    {...form.register("fullName")}
                    className={fieldClassName}
                  />
                </div>

                <div className="space-y-2">
                  <Label id="birthDate-label">Дата рождения</Label>
                  <BirthDateField
                    id="birthDate"
                    labelId="birthDate-label"
                    value={birthDateValue}
                    onChange={(nextValue) =>
                      form.setValue("birthDate", nextValue, {
                        shouldDirty: true,
                        shouldTouch: true,
                      })
                    }
                  />
                </div>

                {form.formState.errors.fullName ? (
                  <p className="text-sm text-rose-200 lg:col-span-2">
                    {form.formState.errors.fullName.message}
                  </p>
                ) : null}
                {form.formState.errors.birthDate ? (
                  <p className="text-sm text-rose-200 lg:col-span-2">
                    {form.formState.errors.birthDate.message}
                  </p>
                ) : null}
              </div>
            </FormPanel>

            <FormPanel
              title="О себе"
              description="Короткий текст остается компактным, но дает профилю контекст."
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
            </FormPanel>

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

          <aside className="grid content-start gap-3 xl:sticky xl:top-4">
            <section className="premium-panel overflow-hidden rounded-[22px]">
              <div className="border-b border-[var(--border-soft)] px-4 py-3.5">
                <p className="section-kicker">Видимость</p>
                <h3 className="mt-1 text-base font-semibold tracking-normal text-white">
                  Статус и стиль
                </h3>
              </div>

              <div className="grid gap-3 px-4 py-4">
                <SummaryCard
                  label="Сейчас"
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

                <div className="rounded-[14px] border border-[var(--border-soft)] bg-black px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-white">
                      <CheckCircle2 size={15} strokeWidth={1.8} />
                      Профиль
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {completedProfileFields}/{profileFields.length}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-accent-soft)]">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${profileCompletion}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="premium-panel rounded-[22px] px-4 py-3.5">
              <div className="flex min-h-[24px] flex-wrap items-center gap-2 text-sm">
                <CompactListMeta
                  className={cn(
                    isDirty && "border-[var(--border-strong)] text-white",
                  )}
                >
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

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className={cn(primaryActionClassName, "w-full")}
                >
                  <Save size={15} strokeWidth={1.8} />
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
                  className="h-11 w-full rounded-[12px] border-white/8 bg-black px-4 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
                >
                  Сбросить
                </Button>
              </div>
            </section>
          </aside>
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
