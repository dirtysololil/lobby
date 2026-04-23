import { requireViewer } from "@/lib/server-session";
import { SettingsSectionBoundary } from "@/components/settings/settings-section-boundary";
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
    <div className="w-full">
      <SettingsSectionBoundary
        title="Профиль временно недоступен"
        description="Не удалось отрисовать форму профиля. Попробуйте открыть раздел ещё раз."
        resetKeys={[viewer.id, viewer.profile.updatedAt]}
      >
        <ProfileSettingsForm
          viewer={viewer}
          maxRingtoneMb={getPositiveNumberEnv("MAX_RINGTONE_MB", 25)}
        />
      </SettingsSectionBoundary>
    </div>
  );
}
