"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function AppError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <ErrorState
      title="Не удалось загрузить оболочку приложения"
      description={error.message || "Запрошенный раздел рабочей области не удалось отрисовать."}
      onRetry={reset}
    />
  );
}
