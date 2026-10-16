import { CircleDot, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badges";
import { formatRelative, formatTimestamp } from "@/lib/dates";
import { REQUESTER_LABEL, STATUS_TONE, TEAM_LABEL, type RequestStatus } from "../meta";
import type { RequestShared } from "@/server/dal/requests";

export function RequestStatusBadge({ status, perspective }: { status: RequestStatus; perspective: "requester" | "team" }) {
  return <Badge tone={STATUS_TONE[status]}>{perspective === "requester" ? REQUESTER_LABEL[status] : TEAM_LABEL[status]}</Badge>;
}

/** "Request progress": built only from published status events and updates. */
export function RequestTimeline({
  events,
  perspective,
  teamName,
  timezone,
}: {
  events: RequestShared["events"];
  perspective: "requester" | "team";
  teamName: string;
  timezone: string;
}) {
  const label = perspective === "requester" ? REQUESTER_LABEL : TEAM_LABEL;
  return (
    <ol className="flex flex-col">
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 && <span className="absolute top-5 bottom-0 left-[7px] w-px bg-line" aria-hidden />}
          {e.kind === "update" ? (
            <Megaphone className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          ) : (
            <CircleDot className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-label text-fg-2">
              <span className="font-medium text-fg">{e.kind === "update" ? "Progress update" : label[e.to]}</span>
              {" · "}
              {e.actorName ?? (e.to === "submitted" && e.kind === "status" ? "Requester" : teamName)}
              {" · "}
              <time dateTime={e.createdAt} title={formatTimestamp(e.createdAt, timezone)} className="text-fg-3">
                {formatRelative(e.createdAt, timezone)}
              </time>
            </p>
            {e.summary && <p className="mt-1 text-body text-fg [overflow-wrap:anywhere]">{e.summary}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
