"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function SubmissionsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Couldn't load your submissions"
      message="Something went wrong. Try again, or head to the map."
      reset={reset}
    />
  );
}
