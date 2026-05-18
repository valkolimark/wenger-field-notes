"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function EditSubmissionError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Couldn't open this visit for editing"
      message="Something went wrong loading the form. Try again, or go back to your submissions."
      reset={reset}
      homeHref="/submissions"
      homeLabel="Go to submissions"
    />
  );
}
