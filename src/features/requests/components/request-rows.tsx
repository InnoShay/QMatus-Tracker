import Link from "next/link";
import { IssueKey } from "@/components/ui/badges";
import { formatDueDate, formatRelative } from "@/lib/dates";
import type { RequestSummary } from "@/server/dal/requests";
import { RequestStatusBadge } from "./request-parts";

export function RequestRows({
  rows,
  perspective,
  teamNames,
  timezone,
  today,
  ownerNames,
}: {
  rows: (RequestSummary & { triageOwnerId?: string | null })[];
  perspective: "requester" | "team";
  teamNames?: Map<string, string>;
  timezone: string;
  today: string;
  ownerNames?: Map<string, string>;
}) {
  return (
    <ul className="@container flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
      {rows.map((r) => (
        <li key={r.id} className="relative flex flex-col gap-1.5 px-4 py-3 hover:bg-hover @2xl:flex-row @2xl:items-center @2xl:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <IssueKey className="shrink-0">REQ-{r.number}</IssueKey>
            <Link
              href={`/requests/${r.id}`}
              className="min-w-0 line-clamp-2 text-body font-medium text-fg outline-none [overflow-wrap:anywhere] @2xl:line-clamp-1 after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
            >
              {r.title}
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-fg-2">
            <RequestStatusBadge status={r.status} perspective={perspective} />
            {perspective === "team" ? (
              <span>
                {r.submitterName ?? "Someone"}
                {r.triageOwnerId && ownerNames?.get(r.triageOwnerId) && (
                  <span className="text-fg-3"> · owner {ownerNames.get(r.triageOwnerId)}</span>
                )}
              </span>
            ) : (
              teamNames?.get(r.targetTeamId) && <span>To {teamNames.get(r.targetTeamId)}</span>
            )}
            {r.committedDate ? (
              <span className="tabular">Committed {formatDueDate(r.committedDate, today)}</span>
            ) : (
              r.requestedDate && <span className="tabular text-fg-3">Requested {formatDueDate(r.requestedDate, today)}</span>
            )}
            <span className="text-fg-3">Updated {formatRelative(r.updatedAt, timezone)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
