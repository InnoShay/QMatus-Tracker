import "server-only";
import { createClient } from "@/lib/supabase/server";
import { REQUESTER_LABEL, TEAM_LABEL } from "@/features/requests/meta";

export type InboxItem = {
  id: number;
  kind: string;
  read: boolean;
  createdAt: string;
  actorName: string | null;
  /** null when the viewer can no longer see the target (revoked, removed, archived). */
  target: { label: string; title: string; href: string; detail?: string } | null;
};

const SCOPE_LABEL: Record<string, string> = {
  dashboard_summary: "summary-only access",
  workspace_read: "read access",
  collaboration: "read and comment access",
  edit: "edit access",
};

/**
 * Builds the inbox. Each target is re-read under the viewer's CURRENT RLS
 * context, so a notification never outlives the access it points to.
 */
export async function loadInbox(viewerId: string, teams: { id: string; slug: string }[], limit = 100): Promise<InboxItem[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("notifications")
    .select("id, kind, resource_type, resource_id, read_at, created_at, profiles!notifications_actor_id_fkey(display_name)")
    .eq("recipient_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const list = rows ?? [];
  const ids = (type: string) => [...new Set(list.filter((r) => r.resource_type === type).map((r) => r.resource_id))];
  const taskIds = ids("task");
  const requestIds = ids("request");
  const grantIds = ids("grant");

  const [tasks, requests, grants] = await Promise.all([
    taskIds.length
      ? supabase.from("tasks").select("id, issue_key, title, team_id").in("id", taskIds).is("archived_at", null)
      : Promise.resolve({ data: [] }),
    requestIds.length
      ? supabase.from("work_requests").select("id, number, title, status, submitter_id, target_team_id").in("id", requestIds)
      : Promise.resolve({ data: [] }),
    grantIds.length
      ? supabase.from("team_access_grants").select("id, scope, status, teams(name)").in("id", grantIds)
      : Promise.resolve({ data: [] }),
  ]);
  const slug = new Map(teams.map((t) => [t.id, t.slug]));
  const taskMap = new Map((tasks.data ?? []).map((t) => [t.id, t]));
  const reqMap = new Map((requests.data ?? []).map((r) => [r.id, r]));
  const grantMap = new Map((grants.data ?? []).map((g) => [g.id, g]));

  return list.map((n) => {
    let target: InboxItem["target"] = null;
    if (n.resource_type === "task") {
      const t = taskMap.get(n.resource_id);
      const s = t ? slug.get(t.team_id) : undefined;
      if (t && s) target = { label: t.issue_key, title: t.title, href: `/t/${s}/board?task=${t.issue_key}` };
    } else if (n.resource_type === "request") {
      const r = reqMap.get(n.resource_id);
      if (r) {
        const onTeam = slug.has(r.target_team_id);
        target = {
          label: `REQ-${r.number}`,
          title: r.title,
          href: `/requests/${r.id}`,
          detail: (onTeam ? TEAM_LABEL : REQUESTER_LABEL)[r.status],
        };
      }
    } else if (n.resource_type === "grant") {
      const g = grantMap.get(n.resource_id);
      if (g)
        target = {
          label: "Access",
          title: `${SCOPE_LABEL[g.scope] ?? g.scope} to ${g.teams?.name ?? "a team"}`,
          href: "/admin/access",
          detail: g.status,
        };
    }
    return {
      id: n.id,
      kind: n.kind,
      read: !!n.read_at,
      createdAt: n.created_at,
      actorName: n.profiles?.display_name ?? null,
      target,
    };
  });
}

export function describeNotification(kind: string): string {
  switch (kind) {
    case "task_assigned":
      return "assigned you a task";
    case "review_requested":
      return "asked you to review a task";
    case "task_commented":
      return "commented on a task you're involved in";
    case "request_submitted":
      return "submitted a work request to your team";
    case "request_status":
      return "changed the status of a request you follow";
    case "request_message":
      return "posted in a request discussion";
    case "request_update":
      return "published a progress update";
    case "grant_pending":
      return "asked you to approve an access grant";
    case "grant_decided":
      return "decided an access grant";
    case "grant_revoked":
      return "revoked an access grant";
    default:
      return "sent you an update";
  }
}
