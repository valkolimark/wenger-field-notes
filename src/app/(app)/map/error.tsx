"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function MapError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Couldn't load the map"
      message="Something went wrong loading the school map. Try again."
      reset={reset}
      homeHref="/submissions"
      homeLabel="Go to submissions"
    />
  );
}
