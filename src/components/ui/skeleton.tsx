export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded bg-black/8 ${className}`}
    />
  );
}

/** Card-row list/table screens (submissions, admin lists). */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mt-5 space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-black/8 bg-white p-4"
        >
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/3" />
          <Skeleton className="mt-3 h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** Sectioned form screens (account, visit form). */
export function FormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-black/8 bg-white p-5"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-11 w-full" />
        </div>
      ))}
    </div>
  );
}
