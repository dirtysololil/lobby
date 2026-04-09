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
    "border-[rgba(106,168,248,0.24)] bg-[rgba(106,168,248,0.12)] text-[var(--accent-strong)]",
  ADMIN:
    "border-white/10 bg-white/[0.05] text-[var(--text-soft)]",
  MODERATOR:
    "border-amber-300/20 bg-amber-300/10 text-amber-100",
  MEMBER:
    "border-[var(--border-soft)] bg-white/[0.03] text-[var(--text-dim)]",
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
          : "border-[var(--border-soft)] bg-white/[0.03] text-[var(--text-dim)]",
        className,
      )}
    >
      {resolvedRole ? hubRoleLabels[resolvedRole] : role}
    </span>
  );
}
