import type { HubMemberRole } from "@lobby/shared";
import { cn } from "@/lib/utils";

export const hubRoleLabels: Record<HubMemberRole, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MODERATOR: "Модератор",
  MEMBER: "Участник",
};

const roleBadgeClassNames: Record<HubMemberRole, string> = {
  OWNER:
    "border-white/12 bg-white/[0.08] text-white",
  ADMIN:
    "border-white/10 bg-black text-[var(--text-soft)]",
  MODERATOR:
    "border-white/10 bg-[var(--bg-panel-soft)] text-[var(--text-soft)]",
  MEMBER:
    "border-[var(--border-soft)] bg-black text-[var(--text-dim)]",
};

interface HubMemberRoleBadgeProps {
  role: HubMemberRole | string;
  className?: string;
}

export function HubMemberRoleBadge({
  role,
  className,
}: HubMemberRoleBadgeProps) {
  const resolvedRole = role in roleBadgeClassNames
    ? (role as HubMemberRole)
    : null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-[0.01em]",
        resolvedRole
          ? roleBadgeClassNames[resolvedRole]
          : "border-[var(--border-soft)] bg-black text-[var(--text-dim)]",
        className,
      )}
    >
      {resolvedRole ? hubRoleLabels[resolvedRole] : role}
    </span>
  );
}
