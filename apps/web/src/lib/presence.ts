import type { PublicUser } from "@lobby/shared";

export type UserPresence = PublicUser["profile"]["presence"];
export type PresenceUser = Pick<PublicUser, "isOnline" | "profile">;

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

export function resolveUserPresence(
  user: PresenceUser | null | undefined,
): UserPresence {
  if (!user?.isOnline) {
    return "OFFLINE";
  }

  if (user.profile.presence === "IDLE" || user.profile.presence === "DND") {
    return user.profile.presence;
  }

  if (user.profile.presence === "OFFLINE") {
    return "OFFLINE";
  }

  return "ONLINE";
}

export function getPresenceLabel(
  presence: UserPresence | null | undefined,
): string {
  return presenceLabelMap[presence ?? "OFFLINE"];
}

export function getPresenceDotClass(
  presence: UserPresence | null | undefined,
): string {
  return presenceDotClasses[presence ?? "OFFLINE"];
}

export function getResolvedPresenceLabel(
  user: PresenceUser | null | undefined,
): string {
  return getPresenceLabel(resolveUserPresence(user));
}

export function getResolvedPresenceDotClass(
  user: PresenceUser | null | undefined,
): string {
  return getPresenceDotClass(resolveUserPresence(user));
}
