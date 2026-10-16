import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ProjectRow = {
  id: string;
  name: string;
  purpose: string | null;
  leadId: string | null;
  status: "planned" | "active" | "paused" | "completed";
  health: "on_track" | "at_risk" | "off_track" | null;
  startDate: string | null;
  targetDate: string | null;
  latestUpdate: string | null;
  latestUpdateAt: string | null;
  archivedAt: string | null;
  milestones: {
    id: string;
    name: string;
    dueDate: string | null;
    done: boolean;
    ownerId: string | null;
    criterion: string | null;
    position: number;
  }[];
};

const COLUMNS =
  "id, name, purpose, lead_id, status, health, start_date, target_date, latest_update, latest_update_at, archived_at, milestones(id, name, due_date, done, owner_id, completion_criterion, position)";

type Row = {
  id: string;
  name: string;
  purpose: string | null;
  lead_id: string | null;
  status: ProjectRow["status"];
  health: ProjectRow["health"];
  start_date: string | null;
  target_date: string | null;
  latest_update: string | null;
  latest_update_at: string | null;
  archived_at: string | null;
  milestones: {
    id: string;
    name: string;
    due_date: string | null;
    done: boolean;
    owner_id: string | null;
    completion_criterion: string | null;
    position: number;
  }[];
};

const toProject = (r: Row): ProjectRow => ({
  id: r.id,
  name: r.name,
  purpose: r.purpose,
  leadId: r.lead_id,
  status: r.status,
  health: r.health,
  startDate: r.start_date,
  targetDate: r.target_date,
  latestUpdate: r.latest_update,
  latestUpdateAt: r.latest_update_at,
  archivedAt: r.archived_at,
  milestones: [...r.milestones]
    .sort((a, b) => a.position - b.position)
    .map((m) => ({
      id: m.id,
      name: m.name,
      dueDate: m.due_date,
      done: m.done,
      ownerId: m.owner_id,
      criterion: m.completion_criterion,
      position: m.position,
    })),
});

export async function listProjects(teamId: string, includeArchived = false): Promise<ProjectRow[]> {
  const supabase = await createClient();
  let q = supabase.from("projects").select(COLUMNS).eq("team_id", teamId);
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q.order("target_date", { ascending: true, nullsFirst: false }).limit(200);
  if (error) throw new Error("Could not load projects.");
  return (data as unknown as Row[]).map(toProject);
}

export async function getProject(teamId: string, id: string): Promise<ProjectRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select(COLUMNS).eq("team_id", teamId).eq("id", id).maybeSingle();
  return data ? toProject(data as unknown as Row) : null;
}
