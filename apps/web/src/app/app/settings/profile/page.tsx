import { requireViewer } from "@/lib/server-session";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";

function getPositiveNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export default async function ProfileSettingsPage() {
  const viewer = await requireViewer();

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <ProfileSettingsForm
        viewer={viewer}
        maxAvatarMb={getPositiveNumberEnv("MAX_AVATAR_MB", 10)}
        maxAvatarAnimationMs={getPositiveNumberEnv("MAX_AVATAR_ANIMATION_MS", 15_000)}
        maxRingtoneMb={getPositiveNumberEnv("MAX_RINGTONE_MB", 25)}
      />
    </div>
  );
}
