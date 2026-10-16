import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, NotAvailable, PageHeader } from "@/components/ui/layout";
import { formatTimestamp } from "@/lib/dates";
import { requireViewer } from "@/server/auth/viewer";
import { listAudit } from "@/server/dal/admin";
import { isOrgAdmin } from "@/server/policies";

export const metadata: Metadata = { title: "Audit log" };

const ACTIONS: Record<string, string> = {
  "invitation.created": "created an invitation",
  "invitation.revoked": "revoked an invitation",
  "invitation.accepted": "accepted an invitation",
  "team_membership.added": "added a team member",
  "team_membership.removed": "removed a team member",
  "team_membership.role_changed": "changed a team role",
  "member.suspended": "suspended an account",
  "member.reactivated": "reactivated an account",
  "access_grant.issued": "issued an access grant",
  "access_grant.approved": "approved an access grant",
  "access_grant.rejected": "rejected an access grant",
  "access_grant.revoked": "revoked an access grant",
  "work_request.created": "created a work request",
  "work_request.audience_added": "added someone to a request's audience",
};

/** Read-only. There is deliberately no edit or delete control. */
export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const viewer = await requireViewer();
  const lead = viewer.teams.some((t) => t.access === "lead");
  if (!isOrgAdmin(viewer) && !lead) return <NotAvailable />;
  const sp = await searchParams;
  const before = typeof sp.before === "string" && /^\d+$/.test(sp.before) ? Number(sp.before) : undefined;
  const { rows, nextBefore } = await listAudit(viewer.org.id, before);

  return (
    <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        title="Audit log"
        description={
          isOrgAdmin(viewer)
            ? "Security and administrative events across the workspace. Entries can't be edited or deleted."
            : "Administrative events for the teams you lead. Entries can't be edited or deleted."
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No events yet" />
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-line bg-surface shadow-panel">
          <table className="w-full min-w-[640px] text-body">
            <caption className="sr-only">Audit events, newest first</caption>
            <thead>
              <tr className="border-b border-line text-left text-label text-fg-3">
                <th scope="col" className="h-10 px-4 font-normal">
                  When
                </th>
                <th scope="col" className="px-4 font-normal">
                  Who
                </th>
                <th scope="col" className="px-4 font-normal">
                  What
                </th>
                <th scope="col" className="px-4 font-normal">
                  Team
                </th>
                <th scope="col" className="px-4 font-normal">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = r.metadata as Record<string, unknown>;
                const details = ["scope", "status", "role", "org_role", "team_role"]
                  .filter((k) => meta[k])
                  .map((k) => `${k.replace("_", " ")}: ${String(meta[k]).replace("_", " ")}`)
                  .join(" · ");
                return (
                  <tr key={r.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2.5 text-label whitespace-nowrap text-fg-2 tabular">
                      {formatTimestamp(r.created_at, viewer.timezone)}
                    </td>
                    <td className="px-4 py-2.5 text-fg">{r.profiles?.display_name ?? "System"}</td>
                    <td className="px-4 py-2.5 text-fg">{ACTIONS[r.action] ?? r.action}</td>
                    <td className="px-4 py-2.5 text-label text-fg-2">{r.teams?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-label text-fg-3">{details || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-4">
        {before && (
          <Link href="/admin/audit" className="text-label font-medium text-accent hover:text-accent-hover">
            Newest
          </Link>
        )}
        {nextBefore && (
          <Link href={`/admin/audit?before=${nextBefore}`} className="text-label font-medium text-accent hover:text-accent-hover">
            Older events
          </Link>
        )}
      </div>
    </div>
  );
}
