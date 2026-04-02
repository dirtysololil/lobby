import { userNotificationSettingsResponseSchema } from "@lobby/shared";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { fetchServerApi } from "@/lib/server-api";
import { requireViewer } from "@/lib/server-session";

export default async function NotificationSettingsPage() {
  await requireViewer();
  const payload = await fetchServerApi("/v1/users/me/notification-settings");
  const settings = userNotificationSettingsResponseSchema.parse(payload).settings;

  return <NotificationSettingsForm initialSettings={settings} />;
}
