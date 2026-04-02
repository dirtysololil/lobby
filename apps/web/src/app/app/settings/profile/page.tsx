import { requireViewer } from "@/lib/server-session";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";

export default async function ProfileSettingsPage() {
  const viewer = await requireViewer();

  return (
    <ProfileSettingsForm
      viewer={viewer}
      maxAvatarMb={Number(process.env.MAX_AVATAR_MB ?? 10)}
      maxAvatarDimension={Number(process.env.MAX_AVATAR_DIMENSION ?? 1024)}
      maxAvatarAnimationMs={Number(process.env.MAX_AVATAR_ANIMATION_MS ?? 10000)}
    />
  );
}
