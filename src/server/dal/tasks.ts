import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getTaskTime } from "./time";
import type { StatusCategory } from "@/features/tasks/meta";
import type { ChecklistItem, Label, Member, Status, TaskCard, TaskDependency, TaskDetail, TeamWorkspace } from "@/features/tasks/types";

/**
 * Task data access. Every query runs through the user-scoped client, so RLS
 * filters rows to the caller's teams/grants. Callers pass a team id that was
 * resolved from the viewer's authorized team list; RLS is the backstop.
 */

const CARD_COLUMNS =
  "id, issue_key, title, status_id, priority, type, assignee_id, due_date, blocked, blocked_reason, rank, version, project_id, milestone_id, parent_id, completed_at, created_at, updated_at, task_label_links(task_labels(id, name)), task_comments(count)";

type CardRow = {
  id: string;
  issue_key: string;
  title: string;
  status_id: string;
  priority: TaskCard["priority"];
  type: TaskCard["type"];
  assignee_id: string | null;
  due_date: string | null;
  blocked: boolean;
  blocked_reason: string | null;
  rank: number;
  version: number;
  project_id: string | null;
  milestone_id: string | null;
  parent_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  task_label_links: { task_labels: { id: string; name: string } | null }[];
  task_comments: { count: number }[];
};

function toCard(r: CardRow): TaskCard {
  return {
    id: r.id,
    key: r.issue_key,
    title: r.title,
    statusId: r.status_id,
    priority: r.priority,
    type: r.type,
    assigneeId: r.assignee_id,
    dueDate: r.due_date,
    blocked: r.blocked,
    blockedReason: r.blocked_reason,
    openBlockers: 0,
    rank: Number(r.rank),
    version: r.version,
    projectId: r.project_id,
    milestoneId: r.milestone_id,
    parentId: r.parent_id,
    labels: r.task_label_links.map((l) => l.task_labels).filter((l): l is Label => !!l),
    commentCount: r.task_comments[0]?.count ?? 0,
    completedAt: r.completed_at,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  };
}

export const BOARD_LIMIT = 500;

/**
 * Fills `openBlockers` from task_blocker_counts(), which counts live links to
 * open blockers (including blockers the viewer can't read, without identity).
 */
async function withBlockerCounts<T extends TaskCard>(cards: T[]): Promise<T[]> {
  if (cards.length === 0) return cards;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("task_blocker_counts", { p_tasks: cards.map((c) => c.id) });
  if (error) throw new Error("Could not load tasks.");
  const counts = new Map((data ?? []).map((r) => [r.task_id, r.open_blockers]));
  return cards.map((c) => ({ ...c, openBlockers: counts.get(c.id) ?? 0 }));
}

export async function listTeamTasks(teamId: string, opts: { includeArchived?: boolean } = {}) {
  const supabase = await createClient();
  let q = supabase.from("tasks").select(CARD_COLUMNS).eq("team_id", teamId);
  if (!opts.includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q.order("rank", { ascending: true }).limit(BOARD_LIMIT + 1);
  if (error) throw new Error("Could not load tasks.");
  const rows = (data as unknown as CardRow[]).map(toCard);
  return { tasks: await withBlockerCounts(rows.slice(0, BOARD_LIMIT)), truncated: rows.length > BOARD_LIMIT };
}

export async function listAssignedTasks(viewerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(`${CARD_COLUMNS}, team_id`)
    .eq("assignee_id", viewerId)
    .is("archived_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(300);
  if (error) throw new Error("Could not load your work.");
  return withBlockerCounts((data as unknown as (CardRow & { team_id: string })[]).map((r) => ({ ...toCard(r), teamId: r.team_id })));
}

export async function getTeamWorkspace(teamId: string): Promise<TeamWorkspace> {
  const supabase = await createClient();
  const [st, tr, mem, lab, proj] = await Promise.all([
    supabase.from("task_statuses").select("id, key, label, category, position").eq("team_id", teamId).order("position"),
    supabase.from("task_status_transitions").select("from_status, to_status").eq("team_id", teamId),
    supabase
      .from("team_memberships")
      .select("profile_id, role, active, profiles!team_memberships_profile_id_fkey(display_name)")
      .eq("team_id", teamId),
    supabase.from("task_labels").select("id, name").eq("team_id", teamId).order("name"),
    supabase
      .from("projects")
      .select("id, name, milestones(id, name, position)")
      .eq("team_id", teamId)
      .is("archived_at", null)
      .order("name"),
  ]);
  if (st.error || tr.error || mem.error || lab.error || proj.error) throw new Error("Could not load team workspace.");
  return {
    statuses: (st.data ?? []) as Status[],
    transitions: (tr.data ?? []).map((t) => ({ from: t.from_status, to: t.to_status })),
    members: (mem.data ?? [])
      .map((m): Member => ({
        id: m.profile_id,
        name: m.profiles?.display_name ?? "Former member",
        role: m.role,
        active: m.active,
      }))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    labels: lab.data ?? [],
    projects: (proj.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      milestones: [...(p.milestones ?? [])].sort((a, b) => a.position - b.position).map((m) => ({ id: m.id, name: m.name })),
    })),
  };
}

/** Resolves a task by its human key inside an authorized team. Null when not visible. */
export async function getTaskDetail(teamId: string, key: string): Promise<TaskDetail | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("tasks")
    .select(`${CARD_COLUMNS}, team_id, description, reviewer_id, start_date, estimate_points, archived_at, creator_id`)
    .eq("team_id", teamId)
    .eq("issue_key", key.toUpperCase())
    .maybeSingle();
  if (error || !row) return null;
  const r = row as unknown as CardRow & {
    team_id: string;
    description: string | null;
    reviewer_id: string | null;
    start_date: string | null;
    estimate_points: number | null;
    archived_at: string | null;
    creator_id: string;
  };

  const [checklist, comments, activity, subtasks, parent, links, creator, time, deps] = await Promise.all([
    supabase.from("task_checklist_items").select("id, body, done, position").eq("task_id", r.id).order("position"),
    supabase
      .from("task_comments")
      .select("id, author_id, body, created_at, edited_at, deleted_at, profiles(display_name)")
      .eq("task_id", r.id)
      .order("created_at")
      .limit(200),
    supabase
      .from("task_activity")
      .select("id, event, data, created_at, profiles(display_name)")
      .eq("task_id", r.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("tasks")
      .select("id, issue_key, title, status_id, assignee_id")
      .eq("parent_id", r.id)
      .is("archived_at", null)
      .order("created_at"),
    r.parent_id ? supabase.from("tasks").select("issue_key, title").eq("id", r.parent_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("work_request_task_links").select("work_requests(id, number, title, status)").eq("task_id", r.id),
    supabase.from("profiles").select("display_name").eq("id", r.creator_id).maybeSingle(),
    getTaskTime(r.id),
    supabase.rpc("get_task_dependencies", { p_task: r.id }),
  ]);

  const dependencies = toDependencies(deps.data);
  // Dependency activity stores the other task's id only; resolve keys under RLS
  // so a task the viewer can't read stays anonymous in the timeline.
  const relatedIds = [
    ...new Set(
      (activity.data ?? [])
        .map((a) => (a.data as Record<string, unknown> | null)?.task)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const related = relatedIds.length ? ((await supabase.from("tasks").select("id, issue_key").in("id", relatedIds)).data ?? []) : [];
  const relatedKey = new Map(related.map((t) => [t.id, t.issue_key]));

  return {
    ...toCard(r),
    teamId: r.team_id,
    description: r.description,
    reviewerId: r.reviewer_id,
    creatorName: creator.data?.display_name ?? null,
    startDate: r.start_date,
    estimate: r.estimate_points,
    archivedAt: r.archived_at,
    checklist: (checklist.data ?? []) as ChecklistItem[],
    comments: (comments.data ?? []).map((c) => ({
      id: c.id,
      authorId: c.author_id,
      authorName: c.profiles?.display_name ?? "Former member",
      body: c.body,
      createdAt: c.created_at,
      editedAt: c.edited_at,
      deleted: !!c.deleted_at,
    })),
    activity: (activity.data ?? []).map((a) => ({
      id: a.id,
      event: a.event,
      data: (a.data ?? {}) as Record<string, unknown>,
      createdAt: a.created_at,
      actorName: a.profiles?.display_name ?? null,
      relatedKey: a.event.startsWith("dependency_")
        ? (relatedKey.get(String((a.data as Record<string, unknown> | null)?.task ?? "")) ?? null)
        : undefined,
    })),
    subtasks: (subtasks.data ?? []).map((s) => ({
      id: s.id,
      key: s.issue_key,
      title: s.title,
      statusId: s.status_id,
      assigneeId: s.assignee_id,
    })),
    parent: parent.data ? { key: parent.data.issue_key, title: parent.data.title } : null,
    linkedRequests: (links.data ?? [])
      .map((l) => l.work_requests)
      .filter((w): w is NonNullable<typeof w> => !!w)
      .map((w) => ({ id: w.id, number: w.number, title: w.title, status: w.status })),
    dependencies,
    openBlockers: dependencies.filter((d) => d.direction === "blocked_by" && !d.resolved).length,
    time,
  };
}

type DependencyRow = {
  link_id: string;
  direction: string;
  visible: boolean;
  task_id: string | null;
  issue_key: string | null;
  title: string | null;
  team_slug: string | null;
  team_name: string | null;
  status_label: string | null;
  status_category: StatusCategory | null;
  archived: boolean | null;
  resolved: boolean;
  created_at: string;
};

function toDependencies(rows: DependencyRow[] | null): TaskDependency[] {
  return (rows ?? []).map((d) => ({
    linkId: d.link_id,
    direction: d.direction === "blocks" ? "blocks" : "blocked_by",
    resolved: d.resolved,
    createdAt: d.created_at,
    other:
      d.visible && d.task_id && d.issue_key && d.title && d.team_slug && d.status_category
        ? {
            id: d.task_id,
            key: d.issue_key,
            title: d.title,
            teamSlug: d.team_slug,
            teamName: d.team_name ?? "",
            statusLabel: d.status_label ?? "",
            statusCategory: d.status_category,
            archived: !!d.archived,
          }
        : null,
  }));
}
