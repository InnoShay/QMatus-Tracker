import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AdminMember = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  level: string | null;
  role: "owner" | "admin" | "member";
  state: "active" | "suspended";
  teams: { teamId: string; role: "lead" | "member" }[];
};

/** Membership administration data. Never includes team content. */
export async function listMembers(orgId: string) {
  const supabase = await createClient();
  const [members, memberships, teams, invites] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("profile_id, role, state, profiles(display_name, email, title, level)")
      .eq("org_id", orgId),
    supabase.from("team_memberships").select("team_id, profile_id, role").eq("org_id", orgId).eq("active", true),
    supabase.from("teams").select("id, name, slug, archived_at").eq("org_id", orgId).order("name"),
    supabase
      .from("invitations")
      .select("id, email, org_role, team_id, team_role, expires_at, accepted_at, revoked_at, created_at")
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const byProfile = new Map<string, AdminMember["teams"]>();
  for (const m of memberships.data ?? []) {
    byProfile.set(m.profile_id, [...(byProfile.get(m.profile_id) ?? []), { teamId: m.team_id, role: m.role }]);
  }
  const list: AdminMember[] = (members.data ?? [])
    .map((m) => ({
      id: m.profile_id,
      name: m.profiles?.display_name ?? "Unknown",
      email: m.profiles?.email ?? "",
      title: m.profiles?.title ?? null,
      level: m.profiles?.level ?? null,
      role: m.role,
      state: m.state,
      teams: byProfile.get(m.profile_id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    members: list,
    teams: (teams.data ?? []).filter((t) => !t.archived_at),
    leadsByTeam: new Set((memberships.data ?? []).filter((m) => m.role === "lead").map((m) => m.team_id)),
    invitations: invites.data ?? [],
  };
}

export type GrantRow = {
  id: string;
  teamId: string;
  teamName: string;
  granteeId: string;
  granteeName: string;
  issuerId: string;
  issuerName: string;
  approverName: string | null;
  scope: "dashboard_summary" | "workspace_read" | "collaboration" | "edit";
  reason: string;
  status: "pending" | "active" | "rejected" | "revoked";
  expiresAt: string | null;
  createdAt: string;
  decidedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  decisionNote: string | null;
};

export async function listGrants(): Promise<GrantRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_access_grants")
    .select(
      "id, team_id, grantee_id, issuer_id, approver_id, scope, reason, status, expires_at, created_at, decided_at, revoked_at, revoke_reason, decision_note, teams(name)",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = data ?? [];
  const ids = [...new Set(rows.flatMap((r) => [r.grantee_id, r.issuer_id, r.approver_id].filter((x): x is string => !!x)))];
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, display_name").in("id", ids) : { data: [] };
  const name = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  return rows.map((r) => ({
    id: r.id,
    teamId: r.team_id,
    teamName: r.teams?.name ?? "Team",
    granteeId: r.grantee_id,
    granteeName: name.get(r.grantee_id) ?? "Unknown",
    issuerId: r.issuer_id,
    issuerName: name.get(r.issuer_id) ?? "Unknown",
    approverName: r.approver_id ? (name.get(r.approver_id) ?? null) : null,
    scope: r.scope,
    reason: r.reason,
    status: r.status,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    revokedAt: r.revoked_at,
    revokeReason: r.revoke_reason,
    decisionNote: r.decision_note,
  }));
}

export async function listAudit(orgId: string, before?: number) {
  const supabase = await createClient();
  let q = supabase
    .from("audit_events")
    .select("id, action, team_id, target_type, target_id, metadata, created_at, profiles(display_name), teams(name)")
    .eq("org_id", orgId)
    .order("id", { ascending: false })
    .limit(51);
  if (before) q = q.lt("id", before);
  const { data } = await q;
  const rows = data ?? [];
  return { rows: rows.slice(0, 50), nextBefore: rows.length > 50 ? rows[49].id : null };
}
