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
      title="Settings are temporarily unavailable"
      description={
        error.digest
          ? `The settings workspace could not be rendered. Reference: ${error.digest}`
          : "The settings workspace could not be rendered right now."
      }
      onRetry={reset}
    />
  );
}
