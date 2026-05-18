import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="mt-3 h-[60vh] w-full rounded-2xl" />
    </div>
  );
}
