"use client";

import { useEffect, useState } from "react";
import { type Submission, loadSubmissionsForRep } from "@/lib/submissions";

/**
 * Reads this rep's submissions from localStorage. localStorage is
 * synchronous and browser-only, so we start empty (SSR-safe) and fill
 * in after mount.
 */
export function useSubmissions(repId: string) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repId) {
      setSubmissions([]);
      setLoading(false);
      return;
    }
    setSubmissions(loadSubmissionsForRep(repId));
    setLoading(false);
  }, [repId]);

  return { submissions, loading };
}
