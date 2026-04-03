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
  description = "Проверьте подключение и повторите запрос.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="premium-panel rounded-[20px] p-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/25 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-100">
        <ShieldAlert className="h-4 w-4" />
        Ошибка
      </div>
      <h2 className="mt-3 font-[var(--font-heading)] text-[1.15rem] font-semibold tracking-[-0.04em] text-white">
        {title}
      </h2>
      <p className="mt-1.5 max-w-xl text-sm leading-5 text-[var(--text-dim)]">
        {description}
      </p>
      {onRetry ? (
        <Button className="mt-4 gap-2" size="sm" variant="secondary" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" />
          Повторить
        </Button>
      ) : null}
    </div>
  );
}
