"use client";

import { CalendarClock, CornerDownRight, Link2, MessageSquare, ListChecks } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { BlockedBadge, IssueKey, PriorityMark } from "@/components/ui/badges";
import { cn } from "@/components/ui/cn";
import { dueState, formatDueDate } from "@/lib/dates";
import type { TaskCard } from "../types";
import { PendingTaskPanel } from "./task-panel";

export function DueCue({ due, today, done }: { due: string; today: string; done: boolean }) {
  const state = done ? "later" : dueState(due, today);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-meta tabular",
        state === "overdue" ? "font-medium text-danger" : state === "today" ? "font-medium text-warning" : "text-fg-2",
      )}
    >
      <CalendarClock className="size-3.5" aria-hidden />
      <span>
        <span className="sr-only">{state === "overdue" ? "Overdue, due " : "Due "}</span>
        {formatDueDate(due, today)}
      </span>
    </span>
  );
}

/** Open "blocked by" links. Warning only: the card can still be moved. */
export function WaitingCue({ count }: { count: number }) {
  const text = `Blocked by ${count} open ${count === 1 ? "task" : "tasks"}`;
  return (
    <span className="inline-flex items-center gap-1 text-meta font-medium text-st-blocked tabular" title={text} data-testid="waiting-cue">
      <Link2 className="size-3.5" aria-hidden />
      {count}
      <span className="sr-only"> {text.toLowerCase()}</span>
    </span>
  );
}

/**
 * Card hierarchy (spec §10.4): key → title (2 lines) → ≤2 labels (+N) →
 * priority · due · blocked · counts · assignee. One stretched link opens the
 * task; the actions menu sits above it so clicks never collide.
 */
export function TaskCardView({
  task,
  href,
  assigneeName,
  today,
  done,
  subtasks,
  menu,
  handle,
  onLinkClick,
  dragging,
  saving,
  className,
}: {
  task: TaskCard;
  href: string;
  assigneeName: string | null;
  today: string;
  done: boolean;
  subtasks?: { done: number; total: number };
  menu?: ReactNode;
  handle?: ReactNode;
  onLinkClick?: (e: React.MouseEvent) => void;
  dragging?: boolean;
  saving?: boolean;
  className?: string;
}) {
  const extraLabels = task.labels.length - 2;
  return (
    <article
      aria-label={`${task.key}: ${task.title}`}
      className={cn(
        "qm-spot group relative flex flex-col gap-2 rounded-lg border bg-raised px-3.5 py-3 text-left shadow-panel",
        "transition-[border-color,box-shadow] duration-[120ms]",
        dragging ? "border-accent shadow-drag" : "border-line-strong/70 hover:border-control/70",
        done && !dragging && "bg-surface",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {handle}
        <IssueKey>{task.key}</IssueKey>
        {task.parentId && (
          <span className="inline-flex items-center text-fg-3" title="Subtask">
            <CornerDownRight className="size-3" aria-hidden />
            <span className="sr-only">Subtask</span>
          </span>
        )}
        {saving && (
          <span className="ml-auto text-meta text-fg-3" role="status">
            Saving…
          </span>
        )}
        {menu && <div className={cn("relative z-10 -my-1 -mr-1.5", !saving && "ml-auto")}>{menu}</div>}
      </div>
      <Link
        href={href}
        scroll={false}
        onClick={onLinkClick}
        data-task-link={task.key}
        className={cn(
          "line-clamp-2 text-body font-medium text-fg outline-none [overflow-wrap:anywhere]",
          "after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-focus",
          done && "text-fg-2",
        )}
      >
        {task.title}
        <PendingTaskPanel taskKey={task.key} title={task.title} />
      </Link>
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.slice(0, 2).map((l) => (
            <span key={l.id} className="inline-flex h-5 items-center rounded-xs border border-line px-1.5 text-meta text-fg-2">
              {l.name}
            </span>
          ))}
          {extraLabels > 0 && (
            <span
              className="inline-flex h-5 items-center px-1 text-meta text-fg-3"
              title={task.labels
                .slice(2)
                .map((l) => l.name)
                .join(", ")}
            >
              +{extraLabels}
            </span>
          )}
        </div>
      )}
      <div className="flex min-h-5 items-center gap-2.5">
        <PriorityMark priority={task.priority} />
        {task.blocked && <BlockedBadge />}
        {task.openBlockers > 0 && <WaitingCue count={task.openBlockers} />}
        {task.dueDate && <DueCue due={task.dueDate} today={today} done={done} />}
        {subtasks && subtasks.total > 0 && (
          <span className="inline-flex items-center gap-1 text-meta text-fg-2 tabular" title="Subtasks done">
            <ListChecks className="size-3.5" aria-hidden />
            {subtasks.done}/{subtasks.total}
            <span className="sr-only"> subtasks done</span>
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1 text-meta text-fg-2 tabular" title="Comments">
            <MessageSquare className="size-3.5" aria-hidden />
            {task.commentCount}
            <span className="sr-only"> comments</span>
          </span>
        )}
        <span className="ml-auto">
          {task.assigneeId ? (
            <Avatar name={assigneeName ?? "Former member"} size="sm" />
          ) : (
            <span className="text-meta text-fg-3">Unassigned</span>
          )}
        </span>
      </div>
    </article>
  );
}
