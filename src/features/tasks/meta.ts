import type { Database } from "@/types/db";

export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type TaskType = Database["public"]["Enums"]["task_type"];
export type StatusCategory = Database["public"]["Enums"]["status_category"];

export const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "No priority" },
];
export const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
export const priorityLabel = (p: TaskPriority) => PRIORITIES.find((x) => x.value === p)!.label;

export const TYPES: { value: TaskType; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "chore", label: "Chore" },
  { value: "research", label: "Research" },
  { value: "documentation", label: "Documentation" },
];
export const typeLabel = (t: TaskType) => TYPES.find((x) => x.value === t)!.label;

/** Visual tone per canonical status key; categories keep semantics consistent. */
export type StatusTone = "backlog" | "ready" | "progress" | "review" | "done" | "canceled";
export function statusTone(key: string): StatusTone {
  switch (key) {
    case "ready":
      return "ready";
    case "in_progress":
      return "progress";
    case "in_review":
      return "review";
    case "done":
      return "done";
    case "canceled":
      return "canceled";
    default:
      return "backlog";
  }
}
