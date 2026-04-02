import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-dashed border-white/12 bg-slate-950/30 px-6 py-10 text-center",
        className,
      )}
    >
      <p className="text-lg font-medium text-white">{title}</p>
      <p className="mt-3 text-sm leading-7 text-slate-400">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
