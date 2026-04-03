/* eslint-disable @next/next/no-img-element */
import type { PublicUser } from "@lobby/shared";
import { cn } from "@/lib/utils";
import { getAvatarInitials, getAvatarUrl } from "@/lib/avatar";

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

const presenceDotClasses: Record<PublicUser["profile"]["presence"], string> = {
  ONLINE: "bg-[var(--success)]",
  IDLE: "bg-[var(--warning)]",
  DND: "bg-[var(--danger)]",
  OFFLINE: "bg-[var(--text-muted)]",
};

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const avatarUrl = getAvatarUrl(user);
  const initials = getAvatarInitials(user.profile.displayName || user.username);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-visible rounded-full",
        sizeClasses[size],
        className,
      )}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[var(--bg-panel-soft)] text-center font-semibold uppercase tracking-[0.06em] text-white">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user.profile.displayName}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      <span
        className={cn(
          "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-app)]",
          presenceDotClasses[user.profile.presence],
        )}
      />
    </div>
  );
}
