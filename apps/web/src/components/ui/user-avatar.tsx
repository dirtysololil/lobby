"use client";

/* eslint-disable @next/next/no-img-element */
import type { PublicUser } from "@lobby/shared";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getAvatarInitials, getAvatarUrl } from "@/lib/avatar";
import { getResolvedPresenceDotClass } from "@/lib/presence";

interface UserAvatarProps {
  user: PublicUser;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-9 w-9 text-[11px]",
  lg: "h-12 w-12 text-sm",
} as const;

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const avatarUrl = getAvatarUrl(user);
  const initials = getAvatarInitials(user.profile.displayName || user.username);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageSrc =
    avatarUrl && avatarUrl.trim().length > 0 && avatarUrl !== failedUrl ? avatarUrl : null;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-visible rounded-full",
        sizeClasses[size],
        className,
      )}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/6 bg-[radial-gradient(circle_at_top,rgba(106,168,248,0.22),transparent_70%),rgba(255,255,255,0.06)] text-center font-semibold uppercase tracking-[0.06em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
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

      <span
        className={cn(
          "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-app)]",
          getResolvedPresenceDotClass(user),
        )}
      />
    </div>
  );
}
