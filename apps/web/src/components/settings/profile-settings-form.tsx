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
import { SelectField } from "@/components/ui/select-field";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClientFetch } from "@/lib/api-client";

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
        uploadError instanceof Error ? uploadError.message : "Unable to upload avatar.",
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
        removeError instanceof Error ? removeError.message : "Unable to remove avatar.",
      );
    } finally {
      setIsRemovingAvatar(false);
    }
  }

  return (
    <section className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="premium-panel rounded-[22px] p-4">
        <p className="section-kicker">Identity</p>
        <div className="mt-3 flex items-center gap-3">
          <UserAvatar user={viewer} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-white">
              {viewer.profile.displayName}
            </p>
            <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
              @{viewer.username}
            </p>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              {viewer.profile.bio?.trim() || "Add a short bio to show up cleanly in people and DM surfaces."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="status-pill">
            <ShieldCheck size={16} strokeWidth={1.5} className="text-[var(--success)]" />
            Public identity
          </span>
          <span className="status-pill">
            <Sparkles size={16} strokeWidth={1.5} className="text-[var(--accent)]" />
            {presetLabels[viewer.profile.avatarPreset]}
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-[18px] border border-[var(--border-soft)]">
          <CompactListHeader className="bg-white/[0.02]">
            <span>Avatar limits</span>
            <CompactListCount>Live</CompactListCount>
          </CompactListHeader>
          <CompactList>
            <CompactListRow compact className="text-left">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">File size</p>
                <p className="text-xs text-[var(--text-muted)]">PNG, JPG, WEBP or GIF</p>
              </div>
              <CompactListCount>{maxAvatarMb} MB</CompactListCount>
            </CompactListRow>
            <CompactListRow compact className="text-left">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">Animation</p>
                <p className="text-xs text-[var(--text-muted)]">For animated GIF uploads</p>
              </div>
              <CompactListCount>{Math.floor(maxAvatarAnimationMs / 1000)}s</CompactListCount>
            </CompactListRow>
          </CompactList>
        </div>

        <div className="mt-4 grid gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-[var(--border)] bg-white/[0.05] px-3 text-sm font-medium text-white transition-colors hover:border-[var(--border-strong)] hover:bg-white/[0.08]">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => void handleAvatarUpload(event.target.files?.[0] ?? null)}
              disabled={isUploadingAvatar}
            />
            <Camera size={16} strokeWidth={1.5} />
            {isUploadingAvatar ? "Uploading avatar..." : "Upload avatar"}
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleAvatarRemove()}
            disabled={!viewer.profile.avatar.fileKey || isRemovingAvatar}
            className="h-10"
          >
            {isRemovingAvatar ? "Removing..." : "Remove avatar"}
          </Button>
        </div>
      </aside>

      <form
        className="premium-panel overflow-hidden rounded-[22px]"
        onSubmit={form.handleSubmit((values) => void onSubmit(values))}
      >
        <div className="border-b border-[var(--border-soft)] px-4 py-4">
          <p className="section-kicker">Profile settings</p>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            These values flow directly into DM headers, people rows, hub members, and
            other identity surfaces.
          </p>
        </div>

        <div className="grid">
          <div className="border-b border-[var(--border-soft)] px-4 py-3">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" {...form.register("displayName")} className="h-10" />
              {form.formState.errors.displayName ? (
                <p className="text-sm text-rose-200">
                  {form.formState.errors.displayName.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="border-b border-[var(--border-soft)] px-4 py-3">
            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                rows={4}
                className="field-textarea min-h-[108px] text-sm"
                {...form.register("bio")}
              />
              {form.formState.errors.bio ? (
                <p className="text-sm text-rose-200">{form.formState.errors.bio.message}</p>
              ) : null}
            </div>
          </div>

          <div className="border-b border-[var(--border-soft)] px-4 py-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="presence">Presence</Label>
                <SelectField id="presence" {...form.register("presence")}>
                  {presenceOptions.map((option) => (
                    <option key={option} value={option}>
                      {presenceLabels[option]}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="avatarPreset">Avatar style</Label>
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
            Keep this tight and readable. The best profile state here is one that already
            looks right in rows, not one that only works inside a big settings form.
          </div>
        </div>

        {error ? <p className="px-4 pb-1 text-sm text-rose-200">{error}</p> : null}
        {message ? <p className="px-4 pb-1 text-sm text-emerald-200">{message}</p> : null}

        <div className="flex flex-wrap gap-2 border-t border-[var(--border-soft)] px-4 py-3">
          <Button type="submit" disabled={form.formState.isSubmitting} className="h-10">
            {form.formState.isSubmitting ? "Saving..." : "Save profile"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => form.reset()}
            disabled={form.formState.isSubmitting}
            className="h-10"
          >
            Reset
          </Button>
        </div>
      </form>
    </section>
  );
}
