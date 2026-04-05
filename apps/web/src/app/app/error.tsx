"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function AppError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error("app.route.error", {
      message: error.message,
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="Раздел временно недоступен"
      description={
        error.digest
          ? `Не удалось отрисовать выбранный раздел. Код: ${error.digest}`
          : error.message || "Не удалось отрисовать выбранный раздел."
      }
      onRetry={reset}
    />
  );
}
