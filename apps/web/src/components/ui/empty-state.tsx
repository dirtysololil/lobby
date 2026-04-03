import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-[16px] border border-dashed border-[var(--border-soft)] bg-white/[0.02] px-4 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      <p className="font-[var(--font-heading)] text-[1.05rem] font-semibold tracking-[-0.03em] text-white">
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-5 text-[var(--text-dim)]">
        {description}
      </p>
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}
