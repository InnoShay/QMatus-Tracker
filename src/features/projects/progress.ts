/**
 * Project progress rule (spec §7.10, documented in-product):
 *   progress = completed eligible tasks / eligible tasks
 * Eligible = not archived and not Canceled. Zero eligible tasks → null
 * ("No tasks yet"), never a division by zero or a fake 0%.
 */
export function projectProgress(tasks: { statusCategory: string; archived?: boolean }[]): {
  done: number;
  total: number;
  percent: number | null;
} {
  const eligible = tasks.filter((t) => !t.archived && t.statusCategory !== "canceled");
  const done = eligible.filter((t) => t.statusCategory === "completed").length;
  return { done, total: eligible.length, percent: eligible.length ? Math.round((done / eligible.length) * 100) : null };
}

export const HEALTH: Record<
  "on_track" | "at_risk" | "off_track",
  { label: string; definition: string; tone: "success" | "warning" | "danger" }
> = {
  on_track: { label: "On track", definition: "The lead expects to meet the target date.", tone: "success" },
  at_risk: { label: "At risk", definition: "The target date will slip without a change of scope or help.", tone: "warning" },
  off_track: { label: "Off track", definition: "The lead expects to miss the target date.", tone: "danger" },
};

export const PROJECT_STATUS: Record<"planned" | "active" | "paused" | "completed", string> = {
  planned: "Planned",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};
