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
  md: "h-10 w-10 text-[11px] sm:h-11 sm:w-11",
  lg: "h-14 w-14 text-sm sm:h-16 sm:w-16",
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
    "before:absolute before:inset-[-1px] before:rounded-[inherit] before:bg-[radial-gradient(circle_at_center,rgba(244,184,90,0.16),transparent_72%)] before:blur-sm after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-amber-200/18",
  NEON_BLUE:
    "before:absolute before:inset-[-1px] before:rounded-[inherit] before:bg-[radial-gradient(circle_at_center,rgba(118,153,255,0.14),transparent_72%)] before:blur-sm after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-blue-200/16",
  PREMIUM_PURPLE:
    "before:absolute before:inset-[-1px] before:rounded-[inherit] before:bg-[radial-gradient(circle_at_center,rgba(182,140,255,0.14),transparent_72%)] before:blur-sm after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-violet-200/16",
  ANIMATED_RING:
    "before:absolute before:inset-[-2px] before:rounded-[inherit] before:bg-[conic-gradient(from_0deg,rgba(255,123,82,0.55),rgba(244,184,90,0.35),rgba(118,153,255,0.35),rgba(255,123,82,0.55))] before:animate-[avatar-spin_3s_linear_infinite] after:absolute after:inset-[1px] after:rounded-[inherit] after:border after:border-white/10 after:bg-slate-950/80",
};

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const avatarUrl = getAvatarUrl(user);
  const initials = getAvatarInitials(user.profile.displayName || user.username);

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[16px]",
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
          "absolute bottom-0.5 right-0.5 z-20 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface-base)] shadow-[0_0_8px_rgba(0,0,0,0.32)]",
          presenceDotClasses[user.profile.presence],
        )}
      />
    </div>
  );
}
