import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";

type GrantScope = Database["public"]["Enums"]["grant_scope"];

/** How the viewer reaches a team. Ordered from most to least capable. */
export type TeamAccess = "lead" | "member" | "edit" | "collaboration" | "workspace_read" | "summary";

export type ViewerTeam = {
  id: string;
  slug: string;
  name: string;
  prefix: string;
  description: string | null;
  acceptsRequests: boolean;
  wipLimit: number | null;
  access: TeamAccess;
  grantExpiresAt: string | null;
};

export type Viewer = {
  id: string;
  email: string;
  name: string;
  title: string | null;
  timezone: string;
  theme: "system" | "light" | "dark";
  org: { id: string; name: string; slug: string; role: "owner" | "admin" | "member"; canRequest: boolean };
  /** Teams whose workspace the viewer can enter (membership or content grant). */
  teams: ViewerTeam[];
  /** Teams visible only through a dashboard-summary grant. */
  summaryTeams: ViewerTeam[];
};

const RANK: Record<TeamAccess, number> = { lead: 6, member: 5, edit: 4, collaboration: 3, workspace_read: 2, summary: 1 };

type TeamRow = {
  id: string;
  slug: string;
  name: string;
  issue_prefix: string;
  description: string | null;
  accepts_requests: boolean;
  wip_limit_in_progress: number | null;
  archived_at: string | null;
};

const TEAM_COLUMNS = "id, slug, name, issue_prefix, description, accepts_requests, wip_limit_in_progress, archived_at";

/**
 * Resolves the signed-in viewer from CURRENT database state on every request
 * (React `cache` dedupes within one render only). Returns null when there is no
 * valid session, and `{ inactive: true }` when the account has no active org access.
 */
export const loadViewer = cache(async (): Promise<Viewer | null | { inactive: true }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, orgRes, membershipRes, grantRes] = await Promise.all([
    supabase.from("profiles").select("id, email, display_name, title, timezone, theme").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("org_id, role, state, can_request, organizations(name, slug)")
      .eq("profile_id", user.id)
      .maybeSingle(),
    supabase.from("team_memberships").select(`role, teams(${TEAM_COLUMNS})`).eq("profile_id", user.id).eq("active", true),
    supabase
      .from("team_access_grants")
      .select(`scope, expires_at, teams(${TEAM_COLUMNS})`)
      .eq("grantee_id", user.id)
      .eq("status", "active"),
  ]);

  const profile = profileRes.data;
  const org = orgRes.data;
  if (!profile || !org || org.state !== "active" || !org.organizations) {
    return { inactive: true };
  }

  const byId = new Map<string, ViewerTeam>();
  const consider = (team: TeamRow | null, access: TeamAccess, expiresAt: string | null) => {
    if (!team || team.archived_at) return;
    const current = byId.get(team.id);
    if (current && RANK[current.access] >= RANK[access]) return;
    byId.set(team.id, {
      id: team.id,
      slug: team.slug,
      name: team.name,
      prefix: team.issue_prefix,
      description: team.description,
      acceptsRequests: team.accepts_requests,
      wipLimit: team.wip_limit_in_progress,
      access,
      grantExpiresAt: expiresAt,
    });
  };

  for (const m of membershipRes.data ?? []) {
    consider(m.teams as TeamRow | null, m.role === "lead" ? "lead" : "member", null);
  }
  const now = Date.now();
  for (const g of grantRes.data ?? []) {
    if (g.expires_at && Date.parse(g.expires_at) <= now) continue;
    const scope = g.scope as GrantScope;
    consider(g.teams as TeamRow | null, scope === "dashboard_summary" ? "summary" : scope, g.expires_at);
  }

  const all = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    id: profile.id,
    email: profile.email,
    name: profile.display_name,
    title: profile.title,
    timezone: profile.timezone,
    theme: profile.theme,
    org: {
      id: org.org_id,
      name: org.organizations.name,
      slug: org.organizations.slug,
      role: org.role,
      canRequest: org.can_request,
    },
    teams: all.filter((t) => t.access !== "summary"),
    summaryTeams: all.filter((t) => t.access === "summary"),
  };
});

export async function requireViewer(): Promise<Viewer> {
  const v = await loadViewer();
  if (!v) redirect("/sign-in");
  if ("inactive" in v) redirect("/no-access");
  return v;
}

/** Team lookup by slug among the viewer's authorized teams only. */
export function findTeam(viewer: Viewer, slug: string): ViewerTeam | null {
  return viewer.teams.find((t) => t.slug === slug) ?? viewer.summaryTeams.find((t) => t.slug === slug) ?? null;
}
