import { userNotificationSettingsResponseSchema } from "@lobby/shared";
import { unstable_rethrow } from "next/navigation";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { SettingsSectionBoundary } from "@/components/settings/settings-section-boundary";
import { ErrorState } from "@/components/ui/error-state";
import { fetchServerApi } from "@/lib/server-api";
import { requireViewer } from "@/lib/server-session";

export default async function NotificationSettingsPage() {
  const viewer = await requireViewer();
  let settings:
    | ReturnType<typeof userNotificationSettingsResponseSchema.parse>["settings"]
    | null = null;
  let loadError: unknown = null;

  try {
    const payload = await fetchServerApi("/v1/users/me/notification-settings");
    settings = userNotificationSettingsResponseSchema.parse(payload).settings;
  } catch (error) {
    unstable_rethrow(error);
    console.error("settings.notifications.page.error", error);
    loadError = error;
  }

  if (loadError || !settings) {
    return (
      <ErrorState
        title="Уведомления временно недоступны"
        description={
          loadError instanceof Error
            ? loadError.message
            : "Сейчас не удалось загрузить параметры уведомлений."
        }
      />
    );
  }

  return (
    <SettingsSectionBoundary
      title="Уведомления временно недоступны"
      description="Не удалось отрисовать форму уведомлений. Попробуйте открыть раздел ещё раз."
      resetKeys={[viewer.id]}
    >
      <NotificationSettingsForm initialSettings={settings} />
    </SettingsSectionBoundary>
  );
}
