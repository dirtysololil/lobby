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
        "rounded-[26px] border border-dashed border-[var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-6 py-9 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      <p className="section-kicker">Пустое состояние</p>
      <p className="mt-3 font-[var(--font-heading)] text-[1.55rem] font-semibold tracking-[-0.03em] text-white">
        {title}
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--text-dim)]">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
