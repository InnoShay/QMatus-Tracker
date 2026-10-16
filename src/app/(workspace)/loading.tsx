import { Skeleton } from "@/components/ui/layout";

/** Shape-matched and static (no shimmer), so the layout doesn't jump when data lands. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-48" />
      </div>
      <div className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </div>
  );
}
