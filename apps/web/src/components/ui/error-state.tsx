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
    <div className="premium-panel rounded-[28px] p-8">
      <div className="inline-flex items-center gap-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-rose-100">
        <ShieldAlert className="h-4 w-4" />
        Системная ошибка
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-dim)]">{description}</p>
      {onRetry ? (
        <Button className="mt-6 gap-2" variant="secondary" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" />
          Повторить запрос
        </Button>
      ) : null}
    </div>
  );
}
