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
    <div className={cn("empty-state-minimal", className)}>
      <div>
        <p className="text-base font-semibold tracking-[-0.03em] text-white">{title}</p>
        <p className="mt-1 text-sm leading-5 text-[var(--text-dim)]">{description}</p>
      </div>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </div>
  );
}
