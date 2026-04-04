import type {
  CallMode,
  CallParticipantState,
  CallStatus,
  DmNotificationSetting,
  DmRetentionMode,
} from "@lobby/shared";

export const dmNotificationLabels: Record<DmNotificationSetting, string> = {
  ALL: "Все",
  MENTIONS_ONLY: "Упоминания",
  MUTED: "Без звука",
  OFF: "Выключено",
};

export const dmRetentionLabels: Record<DmRetentionMode, string> = {
  OFF: "Без автоудаления",
  H24: "24 часа",
  D7: "7 дней",
  D30: "30 дней",
  CUSTOM: "Свой период",
};

export const callModeLabels: Record<CallMode, string> = {
  AUDIO: "Голос",
  VIDEO: "Видео",
};

export const callStatusLabels: Record<CallStatus, string> = {
  RINGING: "Звонок",
  ACCEPTED: "Активен",
  DECLINED: "Отклонён",
  ENDED: "Завершён",
  MISSED: "Пропущен",
};

export const callParticipantStateLabels: Record<CallParticipantState, string> = {
  INVITED: "Приглашён",
  ACCEPTED: "Принял",
  JOINED: "В комнате",
  DECLINED: "Отклонил",
  LEFT: "Вышел",
  MISSED: "Пропустил",
};
