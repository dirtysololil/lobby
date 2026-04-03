"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import {
  updateProfileSchema,
  type PublicUser,
  type UpdateProfileInput,
  type UserResponse,
} from "@lobby/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClientFetch } from "@/lib/api-client";

interface ProfileSettingsFormProps {
  viewer: PublicUser;
  maxAvatarMb: number;
  maxAvatarDimension: number;
  maxAvatarAnimationMs: number;
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
  IDLE: "Отошёл",
  DND: "Не беспокоить",
  OFFLINE: "Скрыт",
};

const presetLabels: Record<UpdateProfileInput["avatarPreset"], string> = {
  NONE: "Без эффекта",
  GOLD_GLOW: "Золотое свечение",
  NEON_BLUE: "Неоновый синий",
  PREMIUM_PURPLE: "Премиум фиолетовый",
  ANIMATED_RING: "Анимированное кольцо",
};

export function ProfileSettingsForm({
  viewer,
  maxAvatarMb,
  maxAvatarDimension,
  maxAvatarAnimationMs,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: viewer.profile.displayName,
      bio: viewer.profile.bio ?? "",
      presence: viewer.profile.presence,
      avatarPreset: viewer.profile.avatarPreset,
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
      setMessage("Профиль обновлён.");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Не удалось обновить профиль",
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
      setMessage("Аватар обновлён.");
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить аватар",
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
      setMessage("Аватар удалён.");
      router.refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Не удалось удалить аватар",
      );
    } finally {
      setIsRemovingAvatar(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="premium-panel rounded-[32px] p-6 lg:p-8">
        <p className="section-kicker">Профиль в сети</p>
        <div className="surface-highlight mt-6 flex flex-col items-center rounded-[32px] px-6 py-8 text-center">
          <UserAvatar user={viewer} size="lg" />
          <p className="mt-5 text-xl font-semibold text-white">
            {viewer.profile.displayName}
          </p>
          <p className="mt-2 font-mono text-sm text-sky-100/80">
            @{viewer.username}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">
            Допустимы PNG, JPEG и WEBP. Анимированные аватары принимаются в GIF,
            до {maxAvatarAnimationMs / 1000}с, {maxAvatarDimension}px и{" "}
            {maxAvatarMb} МБ.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="status-pill">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--success)]" />
              Публичная карточка активна
            </span>
            <span className="status-pill">
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
              {presetLabels[viewer.profile.avatarPreset]}
            </span>
          </div>
          <div className="mt-6 flex w-full flex-col gap-3">
            <label className="surface-subtle cursor-pointer rounded-[22px] px-4 py-3 text-sm text-white transition hover:border-sky-300/35 hover:bg-white/[0.08]">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) =>
                  void handleAvatarUpload(event.target.files?.[0] ?? null)
                }
                disabled={isUploadingAvatar}
              />
              <span className="inline-flex items-center gap-2">
                <Camera className="h-4 w-4" />
                {isUploadingAvatar ? "Загружаем аватар..." : "Загрузить аватар"}
              </span>
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleAvatarRemove()}
              disabled={!viewer.profile.avatar.fileKey || isRemovingAvatar}
            >
              {isRemovingAvatar ? "Удаляем..." : "Удалить аватар"}
            </Button>
          </div>
        </div>
      </div>

      <form
        className="premium-panel rounded-[32px] p-6 lg:p-8"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <p className="section-kicker">Настройки профиля</p>
        <div className="mt-6 grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="displayName">Отображаемое имя</Label>
            <Input id="displayName" {...form.register("displayName")} />
            {form.formState.errors.displayName ? (
              <p className="text-sm text-rose-200">
                {form.formState.errors.displayName.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bio">Биография</Label>
            <textarea
              id="bio"
              rows={5}
              className="field-textarea min-h-[160px]"
              {...form.register("bio")}
            />
            {form.formState.errors.bio ? (
              <p className="text-sm text-rose-200">
                {form.formState.errors.bio.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="presence">Статус присутствия</Label>
              <select
                id="presence"
                className="field-select text-sm"
                {...form.register("presence")}
              >
                {presenceOptions.map((option) => (
                  <option key={option} value={option}>
                    {presenceLabels[option]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="avatarPreset">Пресет аватара</Label>
              <select
                id="avatarPreset"
                className="field-select text-sm"
                {...form.register("avatarPreset")}
              >
                {presetOptions.map((option) => (
                  <option key={option} value={option}>
                    {presetLabels[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="surface-subtle rounded-[24px] p-4 text-sm leading-7 text-[var(--text-dim)]">
            <span className="inline-flex items-center gap-2 text-white">
              <UserRound className="h-4 w-4 text-[var(--accent)]" />
              Как вас видят другие
            </span>
            <p className="mt-2">
              Профиль формирует первое впечатление в диалогах, хабах и форумных
              темах. Сделайте карточку читаемой и социальной, а не пустой
              технической записью.
            </p>
          </div>
        </div>

        {error ? <p className="mt-5 text-sm text-rose-200">{error}</p> : null}
        {message ? (
          <p className="mt-5 text-sm text-emerald-200">{message}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Сохраняем..." : "Сохранить профиль"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => form.reset()}
            disabled={form.formState.isSubmitting}
          >
            Сбросить форму
          </Button>
        </div>
      </form>
    </section>
  );
}
