import { Eye } from "lucide-react";
import { formatDateLong } from "@/lib/dates";
import type { ViewerTeam } from "@/server/auth/viewer";

/** Makes granted (non-member) access explicit, including when it ends. */
export function AccessNote({ team }: { team: ViewerTeam }) {
  if (team.access === "lead" || team.access === "member") return null;
  const what =
    team.access === "workspace_read"
      ? "You can read this team's work but not change it."
      : team.access === "collaboration"
        ? "You can read and comment, but not change tasks."
        : "You have granted edit access to this team.";
  return (
    <p className="flex items-center gap-2 rounded-sm border border-line bg-subtle px-3 py-2 text-label text-fg-2">
      <Eye className="size-4 shrink-0 text-fg-3" aria-hidden />
      <span>
        {what}
        {team.grantExpiresAt && ` Access ends ${formatDateLong(team.grantExpiresAt.slice(0, 10))}.`}
      </span>
    </p>
  );
}
