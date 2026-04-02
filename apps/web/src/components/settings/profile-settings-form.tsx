"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfileSchema, type PublicUser, type UpdateProfileInput, type UserResponse } from "@lobby/shared";
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

const presenceOptions: UpdateProfileInput["presence"][] = ["ONLINE", "IDLE", "DND", "OFFLINE"];
const presetOptions: UpdateProfileInput["avatarPreset"][] = [
  "NONE",
  "GOLD_GLOW",
  "NEON_BLUE",
  "PREMIUM_PURPLE",
  "ANIMATED_RING",
];

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
      setMessage("Profile updated.");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Profile update failed");
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
      setMessage("Avatar updated.");
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Avatar upload failed");
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
      setMessage("Avatar removed.");
      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Avatar remove failed");
    } finally {
      setIsRemovingAvatar(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl">
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Avatar preview</p>
        <div className="mt-6 flex flex-col items-center rounded-[32px] border border-white/10 bg-slate-950/35 px-6 py-8 text-center">
          <UserAvatar user={viewer} size="lg" />
          <p className="mt-5 text-xl font-semibold text-white">{viewer.profile.displayName}</p>
          <p className="mt-2 font-mono text-sm text-sky-100/80">@{viewer.username}</p>
          <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">
            Static avatars allow PNG, JPEG and WEBP. Animated uploads allow GIF only, up to{" "}
            {maxAvatarAnimationMs / 1000}s, {maxAvatarDimension}px and {maxAvatarMb}MB.
          </p>
          <div className="mt-6 flex w-full flex-col gap-3">
            <label className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white transition hover:border-sky-300/35 hover:bg-white/[0.08]">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => void handleAvatarUpload(event.target.files?.[0] ?? null)}
                disabled={isUploadingAvatar}
              />
              {isUploadingAvatar ? "Uploading avatar..." : "Upload avatar"}
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleAvatarRemove()}
              disabled={!viewer.profile.avatar.fileKey || isRemovingAvatar}
            >
              {isRemovingAvatar ? "Removing..." : "Remove avatar"}
            </Button>
          </div>
        </div>
      </div>

      <form
        className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[var(--shadow)] backdrop-blur-xl"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <p className="font-mono text-xs uppercase tracking-[0.26em] text-sky-200/70">Profile settings</p>
        <div className="mt-6 grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" {...form.register("displayName")} />
            {form.formState.errors.displayName ? (
              <p className="text-sm text-rose-200">{form.formState.errors.displayName.message}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              rows={5}
              className="rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-300/45"
              {...form.register("bio")}
            />
            {form.formState.errors.bio ? (
              <p className="text-sm text-rose-200">{form.formState.errors.bio.message}</p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="presence">Presence</Label>
              <select
                id="presence"
                className="h-12 rounded-2xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none"
                {...form.register("presence")}
              >
                {presenceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="avatarPreset">Avatar preset</Label>
              <select
                id="avatarPreset"
                className="h-12 rounded-2xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none"
                {...form.register("avatarPreset")}
              >
                {presetOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error ? <p className="mt-5 text-sm text-rose-200">{error}</p> : null}
        {message ? <p className="mt-5 text-sm text-emerald-200">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save profile"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => form.reset()}
            disabled={form.formState.isSubmitting}
          >
            Reset form
          </Button>
        </div>
      </form>
    </section>
  );
}
