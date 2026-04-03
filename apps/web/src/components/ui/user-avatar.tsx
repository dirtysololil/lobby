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
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-xs sm:h-12 sm:w-12",
  lg: "h-16 w-16 text-base sm:h-[72px] sm:w-[72px]",
} as const;

const presenceDotClasses: Record<
  PublicUser["profile"]["presence"],
  string
> = {
  ONLINE: "bg-[var(--success)]",
  IDLE: "bg-[var(--warning)]",
  DND: "bg-[var(--danger)]",
  OFFLINE: "bg-[var(--text-muted)]",
};

const presetClasses: Record<PublicUser["profile"]["avatarPreset"], string> = {
  NONE: "before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-white/10",
  GOLD_GLOW:
    "before:absolute before:inset-[-2px] before:rounded-[inherit] before:bg-[radial-gradient(circle_at_center,rgba(244,184,90,0.36),transparent_68%)] before:blur-md after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-amber-200/30",
  NEON_BLUE:
    "before:absolute before:inset-[-2px] before:rounded-[inherit] before:bg-[radial-gradient(circle_at_center,rgba(118,153,255,0.28),transparent_70%)] before:blur-md after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-blue-200/25",
  PREMIUM_PURPLE:
    "before:absolute before:inset-[-2px] before:rounded-[inherit] before:bg-[radial-gradient(circle_at_center,rgba(182,140,255,0.24),transparent_70%)] before:blur-md after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-violet-200/25",
  ANIMATED_RING:
    "before:absolute before:inset-[-3px] before:rounded-[inherit] before:bg-[conic-gradient(from_0deg,rgba(255,123,82,0.9),rgba(244,184,90,0.7),rgba(118,153,255,0.7),rgba(255,123,82,0.9))] before:animate-[avatar-spin_3s_linear_infinite] before:blur-[1px] after:absolute after:inset-[2px] after:rounded-[inherit] after:border after:border-white/10 after:bg-slate-950/75",
};

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const avatarUrl = getAvatarUrl(user);
  const initials = getAvatarInitials(user.profile.displayName || user.username);

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[18px]",
        sizeClasses[size],
        presetClasses[user.profile.avatarPreset],
        className,
      )}
    >
      <div className="relative z-10 flex h-full w-full items-center justify-center rounded-[inherit] bg-slate-950/80 text-center font-semibold uppercase tracking-[0.08em] text-white">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user.profile.displayName}
            className="h-full w-full rounded-[inherit] object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <span
        className={cn(
          "absolute bottom-0.5 right-0.5 z-20 h-3 w-3 rounded-full border-2 border-[var(--surface-base)] shadow-[0_0_10px_rgba(0,0,0,0.35)]",
          presenceDotClasses[user.profile.presence],
        )}
      />
    </div>
  );
}
