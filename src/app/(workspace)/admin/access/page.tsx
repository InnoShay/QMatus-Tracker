import type { Metadata } from "next";
import { Badge } from "@/components/ui/badges";
import { EmptyState, NotAvailable, PageHeader, Section } from "@/components/ui/layout";
import { GrantDecision, IssueGrantButton, RevokeGrant } from "@/features/admin/grant-components";
import { SCOPES } from "@/features/admin/scopes";
import { addDays, formatTimestamp, todayIn } from "@/lib/dates";
import { requireViewer } from "@/server/auth/viewer";
import { listGrants, listMembers, type GrantRow } from "@/server/dal/admin";
import { isOrgAdmin } from "@/server/policies";

export const metadata: Metadata = { title: "Access" };

export default async function AccessPage() {
  const viewer = await requireViewer();
  const admin = isOrgAdmin(viewer);
  const leadOf = new Set(viewer.teams.filter((t) => t.access === "lead").map((t) => t.id));
  if (!admin && leadOf.size === 0) return <NotAvailable />;

  const [grants, directory] = await Promise.all([listGrants(), admin ? listMembers(viewer.org.id) : Promise.resolve(null)]);
  const now = new Date().toISOString();
  const isExpired = (g: GrantRow) => !!g.expiresAt && g.expiresAt <= now;
  // Mirrors app.can_approve_grant; the database re-checks on submit.
  const canApprove = (g: GrantRow) =>
    g.status === "pending" &&
    g.granteeId !== viewer.id &&
    g.issuerId !== viewer.id &&
    (leadOf.has(g.teamId) || (admin && !!directory && !directory.leadsByTeam.has(g.teamId)));
  const canRevoke = admin || leadOf.size > 0;

  const pending = grants.filter((g) => g.status === "pending" && !isExpired(g));
  const active = grants.filter((g) => g.status === "active" && !isExpired(g));
  const history = grants.filter((g) => !pending.includes(g) && !active.includes(g));

  const row = (g: GrantRow, actions?: React.ReactNode) => (
    <li key={g.id} className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-start lg:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-body text-fg">
          <span className="font-medium">{g.granteeName}</span> · {SCOPES[g.scope].label} · <span className="font-medium">{g.teamName}</span>
        </p>
        <p className="mt-0.5 text-label text-fg-2">“{g.reason}”</p>
        <p className="mt-1 text-meta text-fg-3">
          Issued by {g.issuerName} {formatTimestamp(g.createdAt, viewer.timezone)}
          {g.approverName && ` · ${g.status === "rejected" ? "rejected" : "approved"} by ${g.approverName}`}
          {g.expiresAt && ` · ${isExpired(g) ? "expired" : "ends"} ${formatTimestamp(g.expiresAt, viewer.timezone)}`}
          {g.revokedAt && ` · revoked ${formatTimestamp(g.revokedAt, viewer.timezone)}${g.revokeReason ? ` (“${g.revokeReason}”)` : ""}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {g.status === "revoked" && <Badge>Revoked</Badge>}
        {g.status === "rejected" && <Badge>Rejected</Badge>}
        {(g.status === "active" || g.status === "pending") && isExpired(g) && <Badge tone="warning">Expired</Badge>}
        {actions}
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        title="Access"
        description="Scoped, time-limited access to a team for people who aren't members. Every grant names exactly what it allows and is recorded in the audit log."
        actions={
          admin &&
          directory && (
            <IssueGrantButton
              people={directory.members.filter((m) => m.id !== viewer.id && m.state === "active").map((m) => ({ id: m.id, name: m.name }))}
              teams={directory.teams.map((t) => ({ id: t.id, name: t.name }))}
              minDate={addDays(todayIn(viewer.timezone), 1)}
            />
          )
        }
      />
      <Section
        title={`Waiting for approval · ${pending.length}`}
        description="Private-content grants need a second person: the team lead, or another admin if the team has no lead."
      >
        {pending.length === 0 ? (
          <p className="text-body text-fg-3">Nothing is waiting.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
            {pending.map((g) =>
              row(
                g,
                canApprove(g) ? (
                  <GrantDecision grantId={g.id} label={`${g.granteeName} will be able to: ${SCOPES[g.scope].sees}`} />
                ) : (
                  <span className="text-meta text-fg-3">
                    {g.issuerId === viewer.id
                      ? "You issued this; someone else must approve."
                      : g.granteeId === viewer.id
                        ? "Waiting for approval."
                        : "Waiting for the team lead."}
                  </span>
                ),
              ),
            )}
          </ul>
        )}
      </Section>
      <Section title={`Active · ${active.length}`}>
        {active.length === 0 ? (
          <EmptyState title="No active grants" body="Nobody outside a team currently has access to it." />
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
            {active.map((g) => row(g, canRevoke && <RevokeGrant grantId={g.id} who={g.granteeName} />))}
          </ul>
        )}
      </Section>
      {history.length > 0 && (
        <Section title="History" description="Expired, revoked and rejected grants. They can't be reactivated.">
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel opacity-90">
            {history.map((g) => row(g))}
          </ul>
        </Section>
      )}
    </div>
  );
}
