import { Skeleton, RowsSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-9 w-32" />
      <Skeleton className="mt-4 h-9 w-full max-w-xs" />
      <RowsSkeleton rows={4} />
    </div>
  );
}
