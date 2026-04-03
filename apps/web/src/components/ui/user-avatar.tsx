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
  sm: "h-10 w-10 text-xs",
  md: "h-[52px] w-[52px] text-sm sm:h-14 sm:w-14",
  lg: "h-[72px] w-[72px] text-lg sm:h-20 sm:w-20",
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
    "before:absolute before:inset-[-2px] before:rounded-[inherit] before:bg-[radial-gradient(circle_at_center,rgba(255,189,107,0.44),transparent_68%)] before:blur-md after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-amber-200/40",
  NEON_BLUE:
    "before:absolute before:inset-[-2px] before:rounded-[inherit] before:bg-[radial-gradient(circle_at_center,rgba(124,215,209,0.42),transparent_70%)] before:blur-md after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-cyan-200/45",
  PREMIUM_PURPLE:
    "before:absolute before:inset-[-2px] before:rounded-[inherit] before:bg-[radial-gradient(circle_at_center,rgba(142,167,255,0.42),transparent_70%)] before:blur-md after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-indigo-200/40",
  ANIMATED_RING:
    "before:absolute before:inset-[-3px] before:rounded-[inherit] before:bg-[conic-gradient(from_0deg,rgba(124,215,209,0.9),rgba(255,189,107,0.58),rgba(142,167,255,0.85),rgba(124,215,209,0.9))] before:animate-[avatar-spin_3s_linear_infinite] before:blur-[1px] after:absolute after:inset-[2px] after:rounded-[inherit] after:border after:border-white/10 after:bg-slate-950/75",
};

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const avatarUrl = getAvatarUrl(user);
  const initials = getAvatarInitials(user.profile.displayName || user.username);

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[26px]",
        sizeClasses[size],
        presetClasses[user.profile.avatarPreset],
        className,
      )}
    >
      <div className="relative z-10 flex h-full w-full items-center justify-center rounded-[inherit] bg-slate-950/80 text-center font-semibold uppercase tracking-[0.12em] text-white">
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
          "absolute bottom-0.5 right-0.5 z-20 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface-base)] shadow-[0_0_14px_rgba(0,0,0,0.35)]",
          presenceDotClasses[user.profile.presence],
        )}
      />
    </div>
  );
}
