"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function SettingsError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error("settings.route.error", {
      message: error.message,
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <ErrorState
      title="Настройки временно недоступны"
      description={
        error.digest
          ? `Не удалось отрисовать раздел настроек. Код: ${error.digest}`
          : "Сейчас не удалось отрисовать раздел настроек."
      }
      onRetry={reset}
    />
  );
}
