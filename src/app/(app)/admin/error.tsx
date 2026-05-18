"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Admin dashboard error"
      message="Something went wrong loading the dashboard. Try again."
      reset={reset}
    />
  );
}
