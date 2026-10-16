/** Date helpers. Timestamps are stored in UTC; dates render in the viewer's zone. */

export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Whole days from `from` to `to` (both YYYY-MM-DD), independent of DST. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export type DueState = "overdue" | "today" | "soon" | "later";

export function dueState(due: string, today: string): DueState {
  const d = daysBetween(today, due);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 3) return "soon";
  return "later";
}

const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Today", "Tomorrow", "Yesterday", "Oct 18", or "Oct 18, 2027" outside this year. */
export function formatDueDate(due: string, today: string): string {
  const d = daysBetween(today, due);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  const date = new Date(`${due}T00:00:00Z`);
  return due.slice(0, 4) === today.slice(0, 4) ? SHORT.format(date) : LONG.format(date);
}

export function formatDateLong(due: string): string {
  return LONG.format(new Date(`${due}T00:00:00Z`));
}

/** Relative time for activity/comments, rendered in the viewer's zone when absolute. */
export function formatRelative(iso: string, timeZone: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const secs = Math.round((now.getTime() - then.getTime()) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(then);
  } catch {
    return then.toISOString().slice(0, 10);
  }
}

export function formatTimestamp(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Pure calendar arithmetic on YYYY-MM-DD strings. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
