import Link from "next/link";
import { BlockedBadge, IssueKey, PriorityMark, StatusIcon } from "@/components/ui/badges";
import { cn } from "@/components/ui/cn";
import type { TaskPriority } from "../meta";
import { DueCue } from "./task-card";

/** Compact cross-team row used by My Work and dashboards. */
export function WorkRow({
  href,
  taskKey,
  title,
  statusKey,
  statusLabel,
  priority,
  dueDate,
  blocked,
  blockedReason,
  teamName,
  today,
  done,
}: {
  href: string;
  taskKey: string;
  title: string;
  statusKey: string;
  statusLabel: string;
  priority?: TaskPriority;
  dueDate: string | null;
  blocked?: boolean;
  blockedReason?: string | null;
  teamName?: string;
  today: string;
  done?: boolean;
}) {
  return (
    <li className="group relative flex min-h-11 flex-col gap-1 px-3.5 py-2.5 hover:bg-hover sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
        <StatusIcon statusKey={statusKey} />
        <span className="sr-only">{statusLabel}</span>
        <IssueKey className="shrink-0">{taskKey}</IssueKey>
        <Link
          href={href}
          scroll={false}
          data-task-link={taskKey}
          className={cn(
            "min-w-0 line-clamp-2 text-body font-medium outline-none [overflow-wrap:anywhere] sm:line-clamp-1 after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus",
            done ? "text-fg-2" : "text-fg",
          )}
        >
          {title}
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-3 pl-6 sm:pl-0">
        {blocked && <BlockedBadge />}
        {blocked && blockedReason && <span className="hidden max-w-56 truncate text-meta text-fg-2 xl:inline">{blockedReason}</span>}
        {teamName && <span className="text-meta text-fg-3">{teamName}</span>}
        {priority && <PriorityMark priority={priority} />}
        {dueDate && <DueCue due={dueDate} today={today} done={!!done} />}
      </div>
    </li>
  );
}
