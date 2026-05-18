"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function FormError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Couldn't load this visit form"
      message="Something went wrong opening the form. Try again, or go back to the map."
      reset={reset}
    />
  );
}
