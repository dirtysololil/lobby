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
  description = "Проверьте подключение или обновите страницу. Мы сохранили данные и состояние сессии.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="premium-panel rounded-[24px] p-5 lg:p-6">
      <div className="inline-flex items-center gap-3 rounded-full border border-rose-300/25 bg-rose-500/10 px-3 py-1.5 text-rose-100">
        <ShieldAlert className="h-4 w-4" />
        Системная ошибка
      </div>
      <h2 className="mt-4 font-[var(--font-heading)] text-[1.35rem] font-semibold tracking-[-0.04em] text-white">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-dim)]">
        {description}
      </p>
      {onRetry ? (
        <Button className="mt-5 gap-2" variant="secondary" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" />
          Повторить запрос
        </Button>
      ) : null}
    </div>
  );
}
