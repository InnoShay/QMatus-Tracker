import "server-only";
import { addDays, todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/** One day of team flow: tasks created and tasks completed that day (viewer's time zone). */
export type FlowDay = { date: string; created: number; completed: number };

export type TeamFlow = {
  days: FlowDay[];
  totals: { created: number; completed: number };
  /** Same-length window immediately before `days`, for the delta. */
  previous: { created: number; completed: number };
};

export const FLOW_RANGES = [14, 30] as const;
export type FlowRange = (typeof FLOW_RANGES)[number];

/**
 * Created vs completed per day for a team, read through the user-scoped
 * client (RLS limits rows to teams the viewer can read). Archived tasks still
 * count: they were created and may have been completed. A task reopened and
 * completed again counts on its latest completion day only.
 */
export async function getTeamFlow(teamId: string, today: string, range: FlowRange, timeZone: string): Promise<TeamFlow> {
  const first = addDays(today, -(range - 1));
  const prevFirst = addDays(first, -range);
  // One day of slack in UTC on each side; rows are bucketed by local date below.
  const since = new Date(`${addDays(prevFirst, -1)}T00:00:00Z`).toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("created_at, completed_at")
    .eq("team_id", teamId)
    .or(`created_at.gte.${since},completed_at.gte.${since}`)
    .limit(10000);
  if (error) throw new Error("Could not load team flow.");

  const dates = Array.from({ length: range }, (_, i) => addDays(first, i));
  const byDay = new Map(dates.map((d) => [d, { date: d, created: 0, completed: 0 }]));
  const previous = { created: 0, completed: 0 };
  const localDay = (iso: string) => todayIn(timeZone, new Date(iso));

  for (const row of data ?? []) {
    const c = localDay(row.created_at);
    const day = byDay.get(c);
    if (day) day.created += 1;
    else if (c >= prevFirst && c < first) previous.created += 1;
    if (row.completed_at) {
      const d = localDay(row.completed_at);
      const done = byDay.get(d);
      if (done) done.completed += 1;
      else if (d >= prevFirst && d < first) previous.completed += 1;
    }
  }

  const days = dates.map((d) => byDay.get(d)!);
  return {
    days,
    totals: {
      created: days.reduce((n, d) => n + d.created, 0),
      completed: days.reduce((n, d) => n + d.completed, 0),
    },
    previous,
  };
}
