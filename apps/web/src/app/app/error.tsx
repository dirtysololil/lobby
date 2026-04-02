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
      title="App shell failed to load"
      description={error.message || "The requested workspace section could not be rendered."}
      onRetry={reset}
    />
  );
}
