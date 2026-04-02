import type { PublicUser } from "@lobby/shared";
import { runtimeConfig } from "./runtime-config";

export function getAvatarUrl(user: Pick<PublicUser, "id" | "profile">): string | null {
  if (!user.profile.avatar.fileKey) {
    return null;
  }

  return `${runtimeConfig.apiPublicUrl}/v1/users/${user.id}/avatar?v=${encodeURIComponent(user.profile.updatedAt)}`;
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
