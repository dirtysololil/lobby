import type { PublicUser } from "@lobby/shared";

export type UserPresence = PublicUser["profile"]["presence"];

export const presenceDotClasses: Record<UserPresence, string> = {
  ONLINE: "bg-[var(--success)]",
  IDLE: "bg-[var(--warning)]",
  DND: "bg-[var(--danger)]",
  OFFLINE: "bg-[var(--text-muted)]",
};

export const presenceLabelMap: Record<UserPresence, string> = {
  ONLINE: "В сети",
  IDLE: "Отошел",
  DND: "Не беспокоить",
  OFFLINE: "Не в сети",
};

export function getPresenceLabel(presence: UserPresence | null | undefined): string {
  return presenceLabelMap[presence ?? "OFFLINE"];
}

export function getPresenceDotClass(
  presence: UserPresence | null | undefined,
): string {
  return presenceDotClasses[presence ?? "OFFLINE"];
}
