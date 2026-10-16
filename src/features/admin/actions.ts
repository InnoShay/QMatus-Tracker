"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapDbError, NOT_AVAILABLE, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/server/auth/viewer";
import { isOrgAdmin } from "@/server/policies";
import { revokeAllSessions } from "@/server/privileged/admin";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { serverEnv } from "@/server/env";
import { newInviteToken } from "@/features/auth/tokens";

const refresh = () => revalidatePath("/", "layout");
const uuid = z.uuid();

async function requireAdmin() {
  const viewer = await requireViewer();
  return isOrgAdmin(viewer) ? viewer : null;
}

const inviteSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }).max(254),
  orgRole: z.enum(["member", "admin"]),
  teamId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  teamRole: z.enum(["member", "lead"]),
  validDays: z.coerce.number().int().min(1).max(30),
});

/** Returns the invitation link once. Only its hash is stored. */
export async function createInvitation(
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult<{ link: string; expiresInDays: number }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return fail({
      code: "validation",
      message: "Check the highlighted fields.",
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
    });
  }
  const viewer = await requireAdmin();
  if (!viewer) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  if (!rateLimit(await clientKey("invite-create", viewer.id), 30, 60 * 60_000)) {
    return fail({ code: "rate_limited", message: "Too many invitations in a short time. Try again later." });
  }
  const v = parsed.data;
  const { token, hash } = newInviteToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_invitation", {
    p_org: viewer.org.id,
    p_email: v.email,
    p_org_role: v.orgRole,
    p_token_hash: hash,
    p_team: v.teamId ?? undefined,
    p_team_role: v.teamId ? v.teamRole : undefined,
    p_valid_days: v.validDays,
  });
  if (error) {
    if (error.code === "23505") return fail({ code: "duplicate", message: "That person is already a member of this workspace." });
    return fail(mapDbError(error));
  }
  refresh();
  return ok({ link: `${serverEnv().APP_URL}/invite/${token}`, expiresInDays: v.validDays });
}

export async function revokeInvitation(id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation: id });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

export async function addTeamMember(teamId: string, profileId: string, role: "lead" | "member"): Promise<ActionResult<null>> {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(profileId).success)
    return fail({ code: "validation", message: "Choose a person and a team." });
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_team_member", { p_team: teamId, p_profile: profileId, p_role: role });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

export async function setTeamRole(teamId: string, profileId: string, role: "lead" | "member"): Promise<ActionResult<null>> {
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_team_role", { p_team: teamId, p_profile: profileId, p_role: role });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

export async function removeTeamMember(teamId: string, profileId: string): Promise<ActionResult<null>> {
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_team_member", { p_team: teamId, p_profile: profileId });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

/**
 * Suspension is enforced by the database on the next request (member_state).
 * Provider sessions are then revoked through the isolated privileged path.
 */
export async function setMemberState(
  profileId: string,
  state: "active" | "suspended",
): Promise<ActionResult<{ sessionsRevoked: boolean }>> {
  if (!uuid.safeParse(profileId).success) return fail({ code: "validation", message: "Choose a person." });
  const viewer = await requireAdmin();
  if (!viewer) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_member_state", { p_org: viewer.org.id, p_profile: profileId, p_state: state });
  if (error) return fail(mapDbError(error));
  const sessions = await revokeAllSessions(profileId, state === "suspended");
  refresh();
  return ok({ sessionsRevoked: sessions.ok });
}

const grantSchema = z.object({
  teamId: z.uuid({ message: "Choose a team." }),
  granteeId: z.uuid({ message: "Choose a person." }),
  scope: z.enum(["dashboard_summary", "workspace_read", "collaboration", "edit"]),
  reason: z.string().trim().min(10, "Explain why in at least 10 characters.").max(500),
  expiresAt: z.union([z.iso.date(), z.literal("")]).transform((v) => v || null),
});

export async function issueGrant(input: z.input<typeof grantSchema>): Promise<ActionResult<{ pending: boolean }>> {
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) {
    return fail({
      code: "validation",
      message: "Check the highlighted fields.",
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
    });
  }
  const viewer = await requireAdmin();
  if (!viewer) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  const v = parsed.data;
  if (v.granteeId === viewer.id) return fail({ code: "forbidden", message: "You can't grant access to yourself." });
  if (v.expiresAt && v.expiresAt <= new Date().toISOString().slice(0, 10)) {
    return fail({ code: "validation", message: "Check the highlighted fields.", fieldErrors: { expiresAt: "Pick a date after today." } });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_grant", {
    p_team: v.teamId,
    p_grantee: v.granteeId,
    p_scope: v.scope,
    p_reason: v.reason,
    p_expires_at: v.expiresAt ? `${v.expiresAt}T23:59:59Z` : undefined,
  });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok({ pending: v.scope !== "dashboard_summary" });
}

export async function decideGrant(grantId: string, approve: boolean, note: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(grantId).success) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_grant", { p_grant: grantId, p_approve: approve, p_note: note.slice(0, 500) || undefined });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

export async function revokeGrant(grantId: string, reason: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(grantId).success) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_grant", { p_grant: grantId, p_reason: reason.slice(0, 500) || undefined });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}
