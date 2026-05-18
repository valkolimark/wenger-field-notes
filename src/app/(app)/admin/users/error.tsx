"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function AdminUsersError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="User management error"
      message="Something went wrong loading users. Try again."
      reset={reset}
    />
  );
}
