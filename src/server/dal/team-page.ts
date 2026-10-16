import "server-only";
import { todayIn } from "@/lib/dates";
import { findTeam, requireViewer, type Viewer, type ViewerTeam } from "@/server/auth/viewer";
import { canReadTeam } from "@/server/policies";

/** Resolves viewer + team for a team route. Null when the viewer can't read the team's workspace. */
export async function loadTeamPage(slug: string): Promise<{ viewer: Viewer; team: ViewerTeam; today: string } | null> {
  const viewer = await requireViewer();
  const team = findTeam(viewer, slug);
  if (!team || !canReadTeam(team)) return null;
  return { viewer, team, today: todayIn(viewer.timezone) };
}
