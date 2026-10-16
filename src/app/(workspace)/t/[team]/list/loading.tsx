import { Skeleton } from "@/components/ui/layout";

/** List-shaped placeholder: header, toolbar and table rows. */
export default function ListLoading() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-64 rounded-md" />
      </div>
      <div className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-5 w-20 rounded-xs" />
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
