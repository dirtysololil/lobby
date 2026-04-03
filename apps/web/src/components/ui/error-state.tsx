"use client";

import { RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Не удалось открыть раздел",
  description = "Проверьте подключение и попробуйте снова.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-3xl border border-rose-300/20 bg-rose-400/[0.07] p-8 shadow-[var(--shadow)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-200">
        <ShieldAlert className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">{description}</p>
      {onRetry ? (
        <Button className="mt-6 gap-2" variant="secondary" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" />
          Повторить
        </Button>
      ) : null}
    </div>
  );
}
