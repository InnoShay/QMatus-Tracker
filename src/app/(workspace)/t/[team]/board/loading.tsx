import { Skeleton } from "@/components/ui/layout";

/** Board-shaped placeholder: header, toolbar and four columns of cards. */
export default function BoardLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-5 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {[4, 3, 3, 2].map((cards, i) => (
          <div key={i} className="flex w-[288px] shrink-0 flex-col gap-2 rounded-xl border border-line bg-rail p-2">
            <Skeleton className="m-1.5 h-4 w-24" />
            {Array.from({ length: cards }, (_, j) => (
              <div key={j} className="flex flex-col gap-2.5 rounded-lg border border-line bg-raised px-3.5 py-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </div>
  );
}
