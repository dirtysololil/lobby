import type { PublicUser } from "@lobby/shared";
import {
  resolveApiBaseUrlForBrowser,
  resolveApiBaseUrlForServer,
} from "./runtime-config";

export function getAvatarUrl(user: Pick<PublicUser, "id" | "profile">): string | null {
  if (!user.profile.avatar.fileKey) {
    return null;
  }

  const baseUrl =
    typeof window === "undefined"
      ? resolveApiBaseUrlForServer()
      : resolveApiBaseUrlForBrowser();
  const path = `/v1/users/${user.id}/avatar?v=${encodeURIComponent(user.profile.updatedAt)}`;

  return baseUrl ? `${baseUrl}${path}` : path;
}

export function getAvatarInitials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}
