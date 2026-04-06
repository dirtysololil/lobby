"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, ShieldCheck, Sparkles } from "lucide-react";
import {
  updateProfileSchema,
  type PublicUser,
  type UpdateProfileInput,
  type UserResponse,
} from "@lobby/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  CompactList,
  CompactListCount,
  CompactListHeader,
  CompactListRow,
} from "@/components/ui/compact-list";
import { useOptionalRealtimePresence } from "@/components/realtime/realtime-provider";
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

export function ProfileSettingsForm({
  viewer,
  maxAvatarMb,
  maxAvatarAnimationMs,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const realtimePresence = useOptionalRealtimePresence();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);
  const liveViewer =
    realtimePresence !== null
      ? {
          ...viewer,
          isOnline: Boolean(realtimePresence[viewer.id]),
        }
      : viewer;
  const availabilityLabel = getAvailabilityLabel(liveViewer) ?? "Не в сети";
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

  return (
    <>
      <section className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="premium-panel rounded-[24px] p-4">
          <p className="section-kicker">Профиль</p>

          <div className="mt-3 rounded-[22px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_24%),rgba(255,255,255,0.02)] p-4">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAvatarPreviewOpen(true)}
                  className="group relative inline-flex rounded-[28px] border border-white/8 bg-black/15 p-2 transition-colors hover:border-white/14 hover:bg-black/20"
                  aria-label="Открыть фото профиля"
                >
                  <UserAvatar
                    user={viewer}
                    size="lg"
                    showPresenceIndicator={false}
                    className="h-[92px] w-[92px] text-[1.4rem]"
                  />
                  <span className="pointer-events-none absolute inset-x-3 bottom-3 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Просмотр
                  </span>
                </button>
                <span className="absolute bottom-2 right-2 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-[var(--bg-panel)] bg-[rgba(6,10,16,0.92)] shadow-[0_8px_18px_rgba(0,0,0,0.35)]">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      getResolvedPresenceDotClass(liveViewer),
                    )}
                  />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold tracking-tight text-white">
                  {viewer.profile.displayName}
                </p>
                <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
                  @{viewer.username}
                </p>
                <p className="mt-3 text-xs leading-5 text-[var(--text-dim)]">
                  Этот блок используется как основа identity-поверхностей в Lobby, поэтому
                  аватар, статус и подписи должны оставаться компактными и собранными.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="status-pill">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        getResolvedPresenceDotClass(liveViewer),
                      )}
                    />
                    {availabilityLabel}
                  </span>
                  <span className="status-pill">
                    <ShieldCheck
                      size={16}
                      strokeWidth={1.5}
                      className="text-[var(--success)]"
                    />
                    Публичный профиль
                  </span>
                  <span className="status-pill">
                    <Sparkles
                      size={16}
                      strokeWidth={1.5}
                      className="text-[var(--accent)]"
                    />
                    {presetLabels[viewer.profile.avatarPreset]}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-white/6 bg-black/10 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-dim)]">
                Описание профиля
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
                {viewer.profile.bio?.trim() ||
                  "Добавьте короткое описание, чтобы аккуратно показываться в людях и личных сообщениях."}
              </p>
            </div>

          </div>

          <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--border-soft)]">
            <CompactListHeader className="bg-white/[0.02]">
              <span>Параметры аватара</span>
              <CompactListCount>Сейчас</CompactListCount>
            </CompactListHeader>
            <CompactList>
              <CompactListRow compact className="text-left">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">Размер файла</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    PNG, JPG, WEBP или GIF
                  </p>
                </div>
                <CompactListCount>{maxAvatarMb} MB</CompactListCount>
              </CompactListRow>
              <CompactListRow compact className="text-left">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">Анимация</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Для загружаемых GIF
                  </p>
                </div>
                <CompactListCount>
                  {Math.floor(maxAvatarAnimationMs / 1000)}s
                </CompactListCount>
              </CompactListRow>
            </CompactList>
          </div>

          <div className="mt-4 grid gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-[var(--border)] bg-white/[0.05] px-3 text-sm font-medium text-white transition-colors hover:border-[var(--border-strong)] hover:bg-white/[0.08]">
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
              {isUploadingAvatar ? "Загружаем аватар..." : "Загрузить аватар"}
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleAvatarRemove()}
              disabled={!viewer.profile.avatar.fileKey || isRemovingAvatar}
              className="h-10"
            >
              {isRemovingAvatar ? "Удаляем..." : "Удалить аватар"}
            </Button>
          </div>
        </aside>

        <form
          className="premium-panel overflow-hidden rounded-[24px]"
          onSubmit={form.handleSubmit((values) => void onSubmit(values))}
        >
          <div className="border-b border-[var(--border-soft)] px-4 py-4">
            <p className="section-kicker">Настройки профиля</p>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Эти значения сразу попадают в заголовки ЛС, строки людей, участников
              хабов и другие identity-поверхности.
            </p>
          </div>

          <div className="grid">
            <div className="border-b border-[var(--border-soft)] px-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="displayName">Отображаемое имя</Label>
                <Input id="displayName" {...form.register("displayName")} className="h-10" />
                <p className="text-xs leading-5 text-[var(--text-dim)]">
                  Короткое и чистое имя выглядит лучше всего в списках и компактных
                  call/header поверхностях.
                </p>
                {form.formState.errors.displayName ? (
                  <p className="text-sm text-rose-200">
                    {form.formState.errors.displayName.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="border-b border-[var(--border-soft)] px-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="bio">О себе</Label>
                <textarea
                  id="bio"
                  rows={4}
                  className="field-textarea min-h-[108px] text-sm"
                  {...form.register("bio")}
                />
                <p className="text-xs leading-5 text-[var(--text-dim)]">
                  Лучше короткий понятный текст, чем длинный блок, который ломает
                  ритм интерфейса.
                </p>
                {form.formState.errors.bio ? (
                  <p className="text-sm text-rose-200">
                    {form.formState.errors.bio.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="border-b border-[var(--border-soft)] px-4 py-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="presence">Статус</Label>
                  <SelectField id="presence" {...form.register("presence")}>
                    {presenceOptions.map((option) => (
                      <option key={option} value={option}>
                        {presenceLabels[option]}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="avatarPreset">Стиль аватара</Label>
                  <SelectField id="avatarPreset" {...form.register("avatarPreset")}>
                    {presetOptions.map((option) => (
                      <option key={option} value={option}>
                        {presetLabels[option]}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 text-sm leading-6 text-[var(--text-dim)]">
              Профиль должен оставаться компактным и читаемым. Самые удачные значения
              хорошо выглядят не только в большой форме, но и в строках, списках и
              карточках по всему Lobby.
            </div>
          </div>

          {error ? <p className="px-4 pb-1 text-sm text-rose-200">{error}</p> : null}
          {message ? <p className="px-4 pb-1 text-sm text-emerald-200">{message}</p> : null}

          <div className="flex flex-wrap gap-2 border-t border-[var(--border-soft)] px-4 py-3">
            <Button type="submit" disabled={form.formState.isSubmitting} className="h-10">
              {form.formState.isSubmitting ? "Сохраняем..." : "Сохранить профиль"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => form.reset()}
              disabled={form.formState.isSubmitting}
              className="h-10"
            >
              Сбросить
            </Button>
          </div>
        </form>
      </section>

      <AvatarPreviewModal
        user={viewer}
        open={isAvatarPreviewOpen}
        onClose={() => setIsAvatarPreviewOpen(false)}
      />
    </>
  );
}
