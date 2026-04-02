import { requireViewer } from "@/lib/server-session";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";

function getRequiredNumberEnv(name: string): number {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }

  return parsed;
}

export default async function ProfileSettingsPage() {
  const viewer = await requireViewer();

  return (
    <ProfileSettingsForm
      viewer={viewer}
      maxAvatarMb={getRequiredNumberEnv("MAX_AVATAR_MB")}
      maxAvatarDimension={getRequiredNumberEnv("MAX_AVATAR_DIMENSION")}
      maxAvatarAnimationMs={getRequiredNumberEnv("MAX_AVATAR_ANIMATION_MS")}
    />
  );
}
