import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/features/requests/meta";
import type { TaskPriority } from "@/features/tasks/meta";

/**
 * Work Request data access, split into two DTOs that mirror the database
 * boundary: `RequestShared` (anything the request audience may see) and
 * `RequestInternal` (receiving team only). The shared DTO is built only from
 * shared tables; it never joins internal ones.
 */

export type RequestSummary = {
  id: string;
  number: number;
  title: string;
  status: RequestStatus;
  targetTeamId: string;
  submitterId: string;
  submitterName: string | null;
  requestedPriority: TaskPriority;
  requestedDate: string | null;
  committedDate: string | null;
  submittedAt: string | null;
  lastPublicUpdateAt: string | null;
  updatedAt: string;
};

export type RequestShared = RequestSummary & {
  sourceTeamId: string | null;
  problem: string;
  outcome: string;
  acceptanceCriteria: string | null;
  links: string | null;
  committedPriority: TaskPriority | null;
  outcomeReason: string | null;
  audience: { id: string; name: string }[];
  messages: { id: string; authorId: string; authorName: string; body: string; createdAt: string }[];
  events: {
    id: number;
    kind: "status" | "update";
    from: RequestStatus | null;
    to: RequestStatus;
    summary: string | null;
    actorName: string | null;
    createdAt: string;
  }[];
};

export type RequestInternal = {
  triageOwnerId: string | null;
  notes: { id: string; authorName: string; body: string; createdAt: string }[];
  linkedTasks: { id: string; key: string; title: string; statusLabel: string; statusKey: string }[];
};

const SUMMARY_COLUMNS =
  "id, number, title, status, target_team_id, submitter_id, requested_priority, requested_date, committed_date, submitted_at, last_public_update_at, updated_at, profiles!work_requests_submitter_id_fkey(display_name)";

type SummaryRow = {
  id: string;
  number: number;
  title: string;
  status: RequestStatus;
  target_team_id: string;
  submitter_id: string;
  requested_priority: TaskPriority;
  requested_date: string | null;
  committed_date: string | null;
  submitted_at: string | null;
  last_public_update_at: string | null;
  updated_at: string;
  profiles: { display_name: string } | null;
};

const toSummary = (r: SummaryRow): RequestSummary => ({
  id: r.id,
  number: r.number,
  title: r.title,
  status: r.status,
  targetTeamId: r.target_team_id,
  submitterId: r.submitter_id,
  submitterName: r.profiles?.display_name ?? null,
  requestedPriority: r.requested_priority,
  requestedDate: r.requested_date,
  committedDate: r.committed_date,
  submittedAt: r.submitted_at,
  lastPublicUpdateAt: r.last_public_update_at,
  updatedAt: r.updated_at,
});

/** Requests the viewer submitted or is explicitly in the audience of. */
export async function listFollowedRequests(viewerId: string): Promise<RequestSummary[]> {
  const supabase = await createClient();
  const { data: aud } = await supabase.from("work_request_audience").select("request_id").eq("profile_id", viewerId);
  const ids = (aud ?? []).map((a) => a.request_id);
  let q = supabase.from("work_requests").select(SUMMARY_COLUMNS);
  q = ids.length ? q.or(`submitter_id.eq.${viewerId},id.in.(${ids.join(",")})`) : q.eq("submitter_id", viewerId);
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(200);
  if (error) throw new Error("Could not load requests.");
  return (data as unknown as SummaryRow[]).map(toSummary);
}

/** The receiving team's intake queue (drafts are never visible here). */
export async function listIntake(teamId: string) {
  const supabase = await createClient();
  const [reqs, triage] = await Promise.all([
    supabase
      .from("work_requests")
      .select(SUMMARY_COLUMNS)
      .eq("target_team_id", teamId)
      .neq("status", "draft")
      .order("submitted_at", { ascending: false })
      .limit(300),
    supabase.from("work_request_triage").select("request_id, triage_owner_id").eq("target_team_id", teamId),
  ]);
  if (reqs.error) throw new Error("Could not load the intake queue.");
  const owners = new Map((triage.data ?? []).map((t) => [t.request_id, t.triage_owner_id]));
  return (reqs.data as unknown as SummaryRow[]).map((r) => ({ ...toSummary(r), triageOwnerId: owners.get(r.id) ?? null }));
}

export async function getRequestShared(id: string, opts: { showActors: boolean }): Promise<RequestShared | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("work_requests")
    .select(`${SUMMARY_COLUMNS}, source_team_id, problem, outcome, acceptance_criteria, links, committed_priority, outcome_reason`)
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const row = r as unknown as SummaryRow & {
    source_team_id: string | null;
    problem: string;
    outcome: string;
    acceptance_criteria: string | null;
    links: string | null;
    committed_priority: TaskPriority | null;
    outcome_reason: string | null;
  };
  const [aud, msgs, events] = await Promise.all([
    supabase
      .from("work_request_audience")
      .select("profile_id, profiles!work_request_audience_profile_id_fkey(display_name)")
      .eq("request_id", id),
    supabase
      .from("work_request_messages")
      .select("id, author_id, body, created_at, profiles(display_name)")
      .eq("request_id", id)
      .order("created_at")
      .limit(300),
    supabase
      .from("work_request_status_events")
      .select("id, kind, from_status, to_status, public_summary, created_at, profiles(display_name)")
      .eq("request_id", id)
      .order("created_at"),
  ]);
  return {
    ...toSummary(row),
    sourceTeamId: row.source_team_id,
    problem: row.problem,
    outcome: row.outcome,
    acceptanceCriteria: row.acceptance_criteria,
    links: row.links,
    committedPriority: row.committed_priority,
    outcomeReason: row.outcome_reason,
    audience: (aud.data ?? []).map((a) => ({ id: a.profile_id, name: a.profiles?.display_name ?? "Former member" })),
    messages: (msgs.data ?? []).map((m) => ({
      id: m.id,
      authorId: m.author_id,
      authorName: m.profiles?.display_name ?? "Former member",
      body: m.body,
      createdAt: m.created_at,
    })),
    events: (events.data ?? []).map((e) => ({
      id: e.id,
      kind: e.kind as "status" | "update",
      from: e.from_status,
      to: e.to_status,
      summary: e.public_summary,
      // Requesters see the team, not individual developers, on status events.
      actorName: opts.showActors ? (e.profiles?.display_name ?? null) : null,
      createdAt: e.created_at,
    })),
  };
}

/** Receiving-team-only data. RLS returns nothing for anyone else. */
export async function getRequestInternal(id: string): Promise<RequestInternal> {
  const supabase = await createClient();
  const [triage, notes, links] = await Promise.all([
    supabase.from("work_request_triage").select("triage_owner_id").eq("request_id", id).maybeSingle(),
    supabase
      .from("work_request_internal_notes")
      .select("id, body, created_at, profiles(display_name)")
      .eq("request_id", id)
      .order("created_at"),
    supabase.from("work_request_task_links").select("tasks(id, issue_key, title, task_statuses(key, label))").eq("request_id", id),
  ]);
  return {
    triageOwnerId: triage.data?.triage_owner_id ?? null,
    notes: (notes.data ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.created_at,
      authorName: n.profiles?.display_name ?? "Former member",
    })),
    linkedTasks: (links.data ?? [])
      .map((l) => l.tasks)
      .filter((t): t is NonNullable<typeof t> => !!t)
      .map((t) => ({
        id: t.id,
        key: t.issue_key,
        title: t.title,
        statusKey: t.task_statuses?.key ?? "backlog",
        statusLabel: t.task_statuses?.label ?? "",
      })),
  };
}

export async function listIntakeTeams() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_intake_teams");
  return data ?? [];
}

export async function listWorkspaceMembers(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_memberships")
    .select("profile_id, state, profiles(display_name, title)")
    .eq("org_id", orgId)
    .eq("state", "active");
  return (data ?? [])
    .map((m) => ({ id: m.profile_id, name: m.profiles?.display_name ?? "", title: m.profiles?.title ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
