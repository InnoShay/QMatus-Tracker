import { CircleCheck, CircleDashed, CircleDot, CircleX, Circle, OctagonAlert, Minus, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { priorityLabel, statusTone, type StatusTone, type TaskPriority } from "@/features/tasks/meta";
import { cn } from "./cn";

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-subtle text-fg-2",
    accent: "bg-accent-soft text-accent",
    success: "bg-success-bg text-success",
    warning: "bg-warning-bg text-warning",
    danger: "bg-danger-bg text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 rounded-xs px-1.5 text-meta font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

const STATUS_STYLE: Record<StatusTone, { cls: string; Icon: LucideIcon }> = {
  backlog: { cls: "bg-st-backlog-bg text-st-backlog", Icon: CircleDashed },
  ready: { cls: "bg-st-ready-bg text-st-ready", Icon: Circle },
  progress: { cls: "bg-st-progress-bg text-st-progress", Icon: CircleDot },
  review: { cls: "bg-st-review-bg text-st-review", Icon: CircleDot },
  done: { cls: "bg-st-done-bg text-st-done", Icon: CircleCheck },
  canceled: { cls: "bg-st-backlog-bg text-st-backlog", Icon: CircleX },
};

/** Status is always text + shape + colour, never colour alone. */
export function StatusBadge({ statusKey, label }: { statusKey: string; label: string }) {
  const { cls, Icon } = STATUS_STYLE[statusTone(statusKey)];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-xs px-1.5 text-meta font-medium whitespace-nowrap", cls)}>
      <Icon className="size-3" aria-hidden strokeWidth={2.25} />
      {label}
    </span>
  );
}

export function StatusIcon({ statusKey, className }: { statusKey: string; className?: string }) {
  const { Icon } = STATUS_STYLE[statusTone(statusKey)];
  const color = {
    backlog: "text-st-backlog",
    ready: "text-st-ready",
    progress: "text-st-progress",
    review: "text-st-review",
    done: "text-st-done",
    canceled: "text-fg-3",
  }[statusTone(statusKey)];
  return <Icon className={cn("size-3.5 shrink-0", color, className)} aria-hidden strokeWidth={2.25} />;
}

const PRIORITY_BARS: Record<Exclude<TaskPriority, "urgent">, number> = { none: 0, low: 1, medium: 2, high: 3 };

/** Priority as a glyph with an accessible name, optionally with its label. */
export function PriorityMark({ priority, withLabel = false }: { priority: TaskPriority; withLabel?: boolean }) {
  const label = priorityLabel(priority);
  return (
    <span className="inline-flex items-center gap-1 text-meta text-fg-2" title={`Priority: ${label}`}>
      {priority === "urgent" ? (
        <OctagonAlert className="size-3.5 shrink-0 text-danger" aria-hidden strokeWidth={2.25} />
      ) : priority === "none" ? (
        <Minus className="size-3.5 shrink-0 text-fg-3" aria-hidden strokeWidth={2.25} />
      ) : (
        <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden>
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={1 + i * 4.5}
              y={9 - i * 3.5}
              width="3"
              height={4 + i * 3.5}
              rx="0.75"
              className={i < PRIORITY_BARS[priority] ? "fill-fg-2" : "fill-line-strong"}
            />
          ))}
        </svg>
      )}
      {withLabel ? label : <span className="sr-only">Priority: {label}</span>}
    </span>
  );
}

export function BlockedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-xs bg-st-blocked-bg px-1.5 text-meta font-medium text-st-blocked">
      <TriangleAlert className="size-3" aria-hidden strokeWidth={2.25} />
      {compact ? "Blocked" : "Blocked"}
    </span>
  );
}

export function IssueKey({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-meta tracking-tight text-fg-3 tabular", className)}>{children}</span>;
}
