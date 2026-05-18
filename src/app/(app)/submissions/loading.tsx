import { Skeleton, RowsSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-9 w-56" />
      <RowsSkeleton rows={4} />
    </div>
  );
}
