import type {
  NotificationSetting,
  UpdateViewerNotificationDefaultsInput,
} from "@lobby/shared";

export const notificationPreferencesEventName =
  "lobby:notification-preferences";

export type NotificationPreferencesEventDetail =
  | {
      scope: "defaults";
      defaults: UpdateViewerNotificationDefaultsInput;
    }
  | {
      scope: "conversation";
      conversationId: string;
      notificationSetting: NotificationSetting;
    };

export function dispatchNotificationPreferencesEvent(
  detail: NotificationPreferencesEventDetail,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<NotificationPreferencesEventDetail>(
      notificationPreferencesEventName,
      { detail },
    ),
  );
}
