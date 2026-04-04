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
  ONLINE: "Online",
  IDLE: "Idle",
  DND: "Do not disturb",
  OFFLINE: "Hidden",
};

const presetLabels: Record<UpdateProfileInput["avatarPreset"], string> = {
  NONE: "No effect",
  GOLD_GLOW: "Gold halo",
  NEON_BLUE: "Signal blue",
  PREMIUM_PURPLE: "Premium halo",
  ANIMATED_RING: "Animated halo",
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
      setMessage("Profile updated.");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to update profile.",
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
      setMessage("Avatar updated.");
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload avatar.",
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
      setMessage("Avatar removed.");
      router.refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove avatar.",
      );
    } finally {
      setIsRemovingAvatar(false);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="premium-panel rounded-[26px] p-5">
        <p className="section-kicker">Identity</p>
        <div className="mt-4 rounded-[24px] border border-white/6 bg-[linear-gradient(180deg,rgba(106,168,248,0.14),transparent_38%),rgba(20,29,40,0.86)] px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <UserAvatar user={viewer} size="lg" />
          <p className="mt-4 text-lg font-semibold text-white">
            {viewer.profile.displayName}
          </p>
          <p className="mt-1 text-sm text-[var(--text-soft)]">@{viewer.username}</p>
          <p className="mt-4 text-sm leading-6 text-[var(--text-dim)]">
            Upload PNG, JPEG, WEBP or GIF up to {maxAvatarMb} MB, {maxAvatarDimension}
            px and {Math.floor(maxAvatarAnimationMs / 1000)} seconds.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="status-pill">
              <ShieldCheck size={18} strokeWidth={1.5} className="text-[var(--success)]" />
              Public identity
            </span>
            <span className="status-pill">
              <Sparkles size={18} strokeWidth={1.5} className="text-[var(--accent)]" />
              {presetLabels[viewer.profile.avatarPreset]}
            </span>
          </div>
          <div className="mt-5 grid gap-2">
            <label className="surface-subtle cursor-pointer rounded-[18px] px-4 py-3 text-sm text-white transition hover:border-[var(--border-strong)] hover:bg-white/[0.08]">
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
                <Camera size={18} strokeWidth={1.5} />
                {isUploadingAvatar ? "Uploading avatar..." : "Upload avatar"}
              </span>
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
        className="premium-panel rounded-[26px] p-5"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <div className="flex flex-col gap-2">
          <p className="section-kicker">Profile settings</p>
          <p className="text-sm leading-6 text-[var(--text-dim)]">
            This identity is used across DMs, people surfaces and hubs.
          </p>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="surface-subtle rounded-[18px] p-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" {...form.register("displayName")} />
            </div>
            {form.formState.errors.displayName ? (
              <p className="text-sm text-rose-200">
                {form.formState.errors.displayName.message}
              </p>
            ) : null}
          </div>

          <div className="surface-subtle rounded-[18px] p-4">
            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                rows={4}
                className="field-textarea min-h-[124px]"
                {...form.register("bio")}
              />
            </div>
            {form.formState.errors.bio ? (
              <p className="text-sm text-rose-200">
                {form.formState.errors.bio.message}
              </p>
            ) : null}
          </div>

          <div className="surface-subtle rounded-[18px] p-4">
            <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="presence">Presence</Label>
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
              <Label htmlFor="avatarPreset">Avatar style</Label>
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
          </div>

          <div className="surface-subtle rounded-[18px] px-4 py-3 text-sm leading-6 text-[var(--text-dim)]">
            Changes propagate directly into DM headers, people rows and hub membership
            surfaces.
          </div>
        </div>

        {error ? <p className="mt-5 text-sm text-rose-200">{error}</p> : null}
        {message ? <p className="mt-5 text-sm text-emerald-200">{message}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save profile"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => form.reset()}
            disabled={form.formState.isSubmitting}
          >
            Reset
          </Button>
        </div>
      </form>
    </section>
  );
}
