"use client";

import { RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  description = "The page could not be loaded. Try again, or go back to a stable section.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-[28px] border border-rose-300/15 bg-rose-400/[0.06] p-8 shadow-[var(--shadow)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-200">
        <ShieldAlert className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{description}</p>
      {onRetry ? (
        <Button className="mt-6 gap-2" variant="secondary" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
