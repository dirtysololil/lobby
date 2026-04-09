import type { NotificationSetting } from "@lobby/shared";

export const messageNotificationSoundAssetPath = "/sounds/incoming-message.mp3";
export const messageNotificationSoundEventName =
  "lobby:play-message-notification-sound";

export interface MessageNotificationSoundEventDetail {
  source: "dm" | "hub-text" | "forum-lobby" | "forum-topic";
}

export function notificationSettingAllowsSound(
  setting: NotificationSetting | null | undefined,
) {
  return setting === "ALL" || setting === "MENTIONS_ONLY";
}

export function requestMessageNotificationSound(
  detail: MessageNotificationSoundEventDetail,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<MessageNotificationSoundEventDetail>(
      messageNotificationSoundEventName,
      { detail },
    ),
  );
}
