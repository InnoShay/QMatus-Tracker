import { dueState } from "@/lib/dates";
import { PRIORITY_ORDER, type TaskPriority } from "./meta";
import type { Status, TaskCard } from "./types";

/**
 * Board and List share these filters, so both views always show the same
 * canonical records for the same URL. Filtering runs over rows the server
 * already authorized; it is a view concern, never a security boundary.
 */
export type TaskFilters = {
  q: string;
  assignee: string; // "" | "me" | "none" | <profile id>
  priority: TaskPriority | "";
  label: string;
  project: string;
  blocked: boolean;
  due: "" | "overdue" | "week";
  showDone: boolean;
};

export const EMPTY_FILTERS: TaskFilters = {
  q: "",
  assignee: "",
  priority: "",
  label: "",
  project: "",
  blocked: false,
  due: "",
  showDone: true,
};

export function parseFilters(sp: Record<string, string | string[] | undefined>): TaskFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.slice(0, 120) ?? "";
  };
  const priority = one("priority");
  const due = one("due");
  return {
    q: one("q"),
    assignee: one("assignee"),
    priority: (["urgent", "high", "medium", "low", "none"] as const).includes(priority as TaskPriority) ? (priority as TaskPriority) : "",
    label: one("label"),
    project: one("project"),
    blocked: one("blocked") === "1",
    due: due === "overdue" || due === "week" ? due : "",
    showDone: one("done") !== "0",
  };
}

export function filtersToQuery(f: TaskFilters): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.q) q.q = f.q;
  if (f.assignee) q.assignee = f.assignee;
  if (f.priority) q.priority = f.priority;
  if (f.label) q.label = f.label;
  if (f.project) q.project = f.project;
  if (f.blocked) q.blocked = "1";
  if (f.due) q.due = f.due;
  if (!f.showDone) q.done = "0";
  return q;
}

export function activeFilterCount(f: TaskFilters): number {
  return [f.q, f.assignee, f.priority, f.label, f.project, f.blocked, f.due, !f.showDone].filter(Boolean).length;
}

export function applyFilters(tasks: TaskCard[], f: TaskFilters, ctx: { viewerId: string; today: string; statuses: Status[] }): TaskCard[] {
  const q = f.q.trim().toLowerCase();
  const completed = new Set(ctx.statuses.filter((s) => s.category === "completed" || s.category === "canceled").map((s) => s.id));
  return tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q) && !t.key.toLowerCase().includes(q)) return false;
    if (f.assignee === "me" && t.assigneeId !== ctx.viewerId) return false;
    if (f.assignee === "none" && t.assigneeId !== null) return false;
    if (f.assignee && !["me", "none"].includes(f.assignee) && t.assigneeId !== f.assignee) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.label && !t.labels.some((l) => l.id === f.label)) return false;
    if (f.project && t.projectId !== f.project) return false;
    if (f.blocked && !t.blocked && t.openBlockers === 0) return false;
    if (!f.showDone && completed.has(t.statusId)) return false;
    if (f.due) {
      if (!t.dueDate || completed.has(t.statusId)) return false;
      const state = dueState(t.dueDate, ctx.today);
      if (f.due === "overdue" && state !== "overdue") return false;
      if (f.due === "week" && !(state === "overdue" || state === "today" || state === "soon" || daysAhead(t.dueDate, ctx.today) <= 7))
        return false;
    }
    return true;
  });
}

function daysAhead(due: string, today: string) {
  return (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
}

export type SortKey = "rank" | "priority" | "due" | "updated" | "key" | "title" | "status";

export function sortTasks(tasks: TaskCard[], key: SortKey, dir: "asc" | "desc", statuses: Status[]): TaskCard[] {
  const pos = new Map(statuses.map((s) => [s.id, s.position]));
  const sign = dir === "asc" ? 1 : -1;
  const cmp = (a: TaskCard, b: TaskCard): number => {
    switch (key) {
      case "priority":
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      case "due":
        // Tasks without a due date always sort last, in either direction.
        if (!a.dueDate || !b.dueDate) return 0;
        return a.dueDate.localeCompare(b.dueDate);
      case "updated":
        return a.updatedAt.localeCompare(b.updatedAt);
      case "key":
        return Number(a.key.split("-")[1]) - Number(b.key.split("-")[1]);
      case "title":
        return a.title.localeCompare(b.title);
      case "status":
        return (pos.get(a.statusId) ?? 0) - (pos.get(b.statusId) ?? 0) || a.rank - b.rank;
      default:
        return a.rank - b.rank;
    }
  };
  return [...tasks].sort((a, b) => {
    if (key === "due" && !!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
    return sign * cmp(a, b) || a.rank - b.rank;
  });
}
