import type { PublicUser } from "@lobby/shared";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function formatRussianCount(
  value: number,
  singular: string,
  paucal: string,
  plural: string,
) {
  const absoluteValue = Math.abs(value);
  const lastTwoDigits = absoluteValue % 100;
  const lastDigit = absoluteValue % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${value} ${plural}`;
  }

  if (lastDigit === 1) {
    return `${value} ${singular}`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${value} ${paucal}`;
  }

  return `${value} ${plural}`;
}

function getCalendarDayDifference(left: Date, right: Date) {
  const leftDay = new Date(left.getFullYear(), left.getMonth(), left.getDate());
  const rightDay = new Date(right.getFullYear(), right.getMonth(), right.getDate());

  return Math.round((leftDay.getTime() - rightDay.getTime()) / DAY_MS);
}

export function formatLastSeenLabel(
  lastSeenAt: string | null | undefined,
  now = new Date(),
): string | null {
  if (!lastSeenAt) {
    return null;
  }

  const lastSeenDate = new Date(lastSeenAt);

  if (Number.isNaN(lastSeenDate.getTime())) {
    return null;
  }

  const diffMs = Math.max(0, now.getTime() - lastSeenDate.getTime());

  if (diffMs < MINUTE_MS) {
    return "был в сети только что";
  }

  if (diffMs < HOUR_MS) {
    const minutes = Math.max(1, Math.floor(diffMs / MINUTE_MS));
    return `был в сети ${formatRussianCount(minutes, "минуту", "минуты", "минут")} назад`;
  }

  const calendarDayDifference = getCalendarDayDifference(now, lastSeenDate);

  if (calendarDayDifference === 0) {
    const hours = Math.max(1, Math.floor(diffMs / HOUR_MS));
    return `был в сети ${formatRussianCount(hours, "час", "часа", "часов")} назад`;
  }

  if (calendarDayDifference === 1) {
    return "был в сети вчера";
  }

  return `был в сети ${formatRussianCount(
    calendarDayDifference,
    "день",
    "дня",
    "дней",
  )} назад`;
}

export function getAvailabilityLabel(
  user: Pick<PublicUser, "isOnline" | "lastSeenAt"> | null | undefined,
): string | null {
  if (!user) {
    return null;
  }

  if (user.isOnline) {
    return "В сети";
  }

  return formatLastSeenLabel(user.lastSeenAt);
}
