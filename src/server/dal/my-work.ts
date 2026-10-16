import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Status, TaskCard } from "@/features/tasks/types";
import { listAssignedTasks } from "./tasks";

export type MyTask = TaskCard & { teamId: string; status: Status };

/** Everything assigned to (or awaiting review by) the viewer, under RLS. */
export async function loadMyWork(viewerId: string, teamIds: string[]) {
  const supabase = await createClient();
  const [assigned, reviewRows, statusRows] = await Promise.all([
    listAssignedTasks(viewerId),
    supabase
      .from("tasks")
      .select("id, issue_key, title, team_id, status_id, priority, due_date, blocked, version, updated_at")
      .eq("reviewer_id", viewerId)
      .is("archived_at", null)
      .limit(50),
    teamIds.length
      ? supabase.from("task_statuses").select("id, key, label, category, position, team_id").in("team_id", teamIds)
      : Promise.resolve({ data: [] as (Status & { team_id: string })[] }),
  ]);
  const statuses = new Map((statusRows.data ?? []).map((s) => [s.id, s as Status]));
  const withStatus = assigned.filter((t) => statuses.has(t.statusId)).map((t) => ({ ...t, status: statuses.get(t.statusId)! }));
  const toReview = (reviewRows.data ?? [])
    .filter((r) => statuses.get(r.status_id)?.key === "in_review")
    .map((r) => ({
      id: r.id,
      key: r.issue_key,
      title: r.title,
      teamId: r.team_id,
      status: statuses.get(r.status_id)!,
      dueDate: r.due_date,
    }));
  return { tasks: withStatus, toReview };
}
