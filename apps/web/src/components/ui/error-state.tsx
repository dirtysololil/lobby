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
    <div className="premium-panel rounded-[22px] p-5">
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
        <ShieldAlert size={18} strokeWidth={1.5} />
        Service fallback
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-white">
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-dim)]">
        {description}
      </p>
      {onRetry ? (
        <Button className="mt-5 gap-2" size="sm" variant="secondary" onClick={onRetry}>
          <RotateCcw size={18} strokeWidth={1.5} />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
