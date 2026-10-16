import "server-only";
import type { ActiveTimer, MyTimeEntry, TaskTime } from "@/features/time/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Time-entry data access. RLS returns only the caller's own entries, so these
 * queries can never surface someone else's time. Task titles are joined under
 * task RLS: a task the viewer can no longer read shows as unavailable.
 */

type TaskJoin = { issue_key: string; title: string; teams: { slug: string } | null } | null;

export async function getActiveTimer(): Promise<ActiveTimer | null> {
  const supabase = await createClient();
  // current_timer() applies the stop rule (e.g. an expired grant) before answering.
  const { data, error } = await supabase.rpc("current_timer").maybeSingle();
  if (error || !data) return null;
  const { data: task } = await supabase.from("tasks").select("issue_key, title, teams(slug)").eq("id", data.task_id).maybeSingle();
  const t = task as TaskJoin;
  return {
    id: data.id,
    taskId: data.task_id,
    taskKey: t?.issue_key ?? null,
    taskTitle: t?.title ?? null,
    teamSlug: t?.teams?.slug ?? null,
    startedAt: data.started_at,
  };
}

export async function getTaskTime(taskId: string): Promise<TaskTime> {
  const supabase = await createClient();
  const [active, entries] = await Promise.all([
    getActiveTimer(),
    supabase.from("time_entries").select("duration_seconds").eq("task_id", taskId).is("deleted_at", null).not("ended_at", "is", null),
  ]);
  const mySeconds = (entries.data ?? []).reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0);
  return { mySeconds, active, serverNow: new Date().toISOString() };
}

export const MY_TIME_DAYS = 14;

/** The viewer's entries that started in the last `days` days, newest first. */
export async function listMyTime(days = MY_TIME_DAYS): Promise<{ entries: MyTimeEntry[]; truncated: boolean }> {
  const supabase = await createClient();
  const since = new Date(Date.now() - (days + 1) * 86_400_000).toISOString();
  const LIMIT = 500;
  const { data, error } = await supabase
    .from("time_entries")
    .select(
      "id, task_id, source, started_at, ended_at, duration_seconds, note, stop_reason, corrected_at, version, tasks(issue_key, title, teams(slug))",
    )
    .is("deleted_at", null)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(LIMIT + 1);
  if (error) throw new Error("Could not load your time.");
  const rows = (data ?? []).map((r): MyTimeEntry => {
    const t = r.tasks as unknown as TaskJoin;
    return {
      id: r.id,
      taskId: r.task_id,
      taskKey: t?.issue_key ?? null,
      taskTitle: t?.title ?? null,
      teamSlug: t?.teams?.slug ?? null,
      source: r.source,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      seconds: r.duration_seconds,
      note: r.note,
      stopReason: r.stop_reason,
      corrected: !!r.corrected_at,
      version: r.version,
    };
  });
  return { entries: rows.slice(0, LIMIT), truncated: rows.length > LIMIT };
}
