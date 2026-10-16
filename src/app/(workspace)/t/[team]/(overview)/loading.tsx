import { Skeleton } from "@/components/ui/layout";

/** Dashboard-shaped placeholder: header, five tiles, flow + queue, two panels. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56 rounded-md" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="qm-card flex flex-col gap-3 px-4 py-4">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-9 w-12 rounded-md" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="qm-card flex flex-col gap-5 p-6 xl:col-span-8">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-48 rounded-md" />
          <Skeleton className="h-[220px] w-full rounded-lg" />
        </div>
        <div className="qm-card flex flex-col gap-4 p-6 xl:col-span-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-full rounded-lg" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </div>
  );
}
