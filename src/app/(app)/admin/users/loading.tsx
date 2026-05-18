import { Skeleton, RowsSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-9 w-32" />
      <RowsSkeleton rows={6} />
    </div>
  );
}
