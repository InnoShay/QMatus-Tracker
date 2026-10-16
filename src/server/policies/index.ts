import type { TeamAccess, Viewer, ViewerTeam } from "@/server/auth/viewer";

/**
 * Central policy decisions used by the UI and server actions to decide what to
 * offer. They mirror the database helpers in supabase/migrations (app.can_*),
 * which remain the enforcement point: RLS rejects anything these would allow
 * by mistake. Unknown or missing access always denies.
 */
const CAN_READ: TeamAccess[] = ["lead", "member", "edit", "collaboration", "workspace_read"];
const CAN_COMMENT: TeamAccess[] = ["lead", "member", "edit", "collaboration"];
const CAN_WRITE: TeamAccess[] = ["lead", "member", "edit"];
const IS_MEMBER: TeamAccess[] = ["lead", "member"];

export const canReadTeam = (team: ViewerTeam | null | undefined) => !!team && CAN_READ.includes(team.access);
export const canCommentTeam = (team: ViewerTeam | null | undefined) => !!team && CAN_COMMENT.includes(team.access);
export const canWriteTeam = (team: ViewerTeam | null | undefined) => !!team && CAN_WRITE.includes(team.access);
export const isTeamMember = (team: ViewerTeam | null | undefined) => !!team && IS_MEMBER.includes(team.access);
export const isTeamLead = (team: ViewerTeam | null | undefined) => team?.access === "lead";
export const canReadDashboardSummary = (team: ViewerTeam | null | undefined) => !!team;
/** Triage is a membership capability; grants never confer it. */
export const canTriageRequests = isTeamMember;

export const isOrgAdmin = (viewer: Viewer) => viewer.org.role === "owner" || viewer.org.role === "admin";
export const isOrgOwner = (viewer: Viewer) => viewer.org.role === "owner";
export const canSubmitRequests = (viewer: Viewer) => viewer.org.canRequest;
/** Self-grants are forbidden for everyone, including owners. */
export const canIssueGrantTo = (viewer: Viewer, granteeId: string) => isOrgAdmin(viewer) && granteeId !== viewer.id;

export function describeAccess(access: TeamAccess): string {
  switch (access) {
    case "lead":
      return "Team lead";
    case "member":
      return "Member";
    case "edit":
      return "Edit access (granted)";
    case "collaboration":
      return "Read and comment (granted)";
    case "workspace_read":
      return "Read-only (granted)";
    case "summary":
      return "Summary only (granted)";
  }
}
