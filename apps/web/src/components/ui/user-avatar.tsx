"use client";

/* eslint-disable @next/next/no-img-element */
import type { PublicUser } from "@lobby/shared";
import { useState } from "react";
import { useOptionalRealtimePresence } from "@/components/realtime/realtime-provider";
import { cn } from "@/lib/utils";
import { getAvatarInitials, getAvatarUrl } from "@/lib/avatar";
import { getResolvedPresenceDotClass } from "@/lib/presence";

interface UserAvatarProps {
  user: PublicUser;
  size?: "sm" | "md" | "lg";
  className?: string;
  showPresenceIndicator?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-9 w-9 text-[11px]",
  lg: "h-12 w-12 text-sm",
} as const;

export function UserAvatar({
  user,
  size = "md",
  className,
  showPresenceIndicator = true,
}: UserAvatarProps) {
  const realtimePresence = useOptionalRealtimePresence();
  const avatarUrl = getAvatarUrl(user);
  const initials = getAvatarInitials(user.profile.displayName || user.username);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageSrc =
    avatarUrl && avatarUrl.trim().length > 0 && avatarUrl !== failedUrl ? avatarUrl : null;
  const liveUser =
    realtimePresence !== null
      ? {
          ...user,
          isOnline: Boolean(realtimePresence[user.id]),
        }
      : user;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-visible rounded-full",
        sizeClasses[size],
        className,
      )}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/8 bg-black text-center font-semibold uppercase tracking-[0.06em] text-white">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={user.profile.displayName}
            className="h-full w-full rounded-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setFailedUrl(imageSrc)}
          />
        ) : (
          <span className="select-none">{initials}</span>
        )}
      </div>

      {showPresenceIndicator ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-black",
            getResolvedPresenceDotClass(liveUser),
          )}
        />
      ) : null}
    </div>
  );
}
