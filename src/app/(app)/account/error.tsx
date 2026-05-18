"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function AccountError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Couldn't load your account"
      message="Something went wrong. Try again."
      reset={reset}
    />
  );
}
