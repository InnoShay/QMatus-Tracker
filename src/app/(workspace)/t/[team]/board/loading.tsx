import { Skeleton } from "@/components/ui/layout";

export default function BoardLoading() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading board">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-24" />
      </div>
      <Skeleton className="h-8 w-full max-w-xl" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, c) => (
          <div key={c} className="flex w-[280px] shrink-0 flex-col gap-2 rounded-lg bg-subtle p-2">
            <Skeleton className="m-1 h-4 w-24 bg-line" />
            {Array.from({ length: 3 - (c % 2) }, (_, r) => (
              <div key={r} className="flex h-[104px] flex-col gap-2 rounded-xl border border-line bg-surface shadow-panel px-3 py-2.5">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3.5 w-3/5" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading the board…
      </span>
    </div>
  );
}
