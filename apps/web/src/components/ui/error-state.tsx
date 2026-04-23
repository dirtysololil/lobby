"use client";

import { RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "This surface could not be opened",
  description = "Check the connection and try loading the section again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="premium-panel rounded-[18px] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-amber-300/20 bg-black text-amber-100">
            <ShieldAlert size={20} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black px-3 py-1 text-xs font-medium text-[var(--text-soft)]">
              Surface fallback
            </div>
            <h2 className="mt-3 text-lg font-semibold tracking-tight text-white">
              {title}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-dim)]">
              {description}
            </p>
          </div>
        </div>
      </div>
      {onRetry ? (
        <Button className="mt-5 gap-2" size="sm" variant="secondary" onClick={onRetry}>
          <RotateCcw size={18} strokeWidth={1.5} />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
