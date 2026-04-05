"use client";

import type { PublicUser } from "@lobby/shared";
import { cn } from "@/lib/utils";
import {
  getPresenceDotClass,
  getPresenceLabel,
  resolveUserPresence,
} from "@/lib/presence";

interface PresenceIndicatorProps {
  presence?: PublicUser["profile"]["presence"] | null | undefined;
  user?: PublicUser | null | undefined;
  className?: string;
  dotClassName?: string;
  compact?: boolean;
}

export function PresenceIndicator({
  presence,
  user,
  className,
  dotClassName,
  compact = false,
}: PresenceIndicatorProps) {
  const resolvedPresence = user ? resolveUserPresence(user) : (presence ?? "OFFLINE");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]",
        compact &&
          "rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[11px] text-[var(--text-soft)]",
        className,
      )}
    >
      <span
        className={cn(
          "status-dot h-2 w-2 border-0",
          getPresenceDotClass(resolvedPresence),
          dotClassName,
        )}
      />
      {getPresenceLabel(resolvedPresence)}
    </span>
  );
}
