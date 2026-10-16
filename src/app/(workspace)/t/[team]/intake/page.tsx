import type { Metadata } from "next";
import { EmptyState, NotAvailable, PageHeader, Section } from "@/components/ui/layout";
import { RequestRows } from "@/features/requests/components/request-rows";
import type { RequestStatus } from "@/features/requests/meta";
import { AccessNote } from "@/features/tasks/components/access-note";
import { listIntake } from "@/server/dal/requests";
import { getTeamWorkspace } from "@/server/dal/tasks";
import { loadTeamPage } from "@/server/dal/team-page";

export const metadata: Metadata = { title: "Work requests" };

const GROUPS: { title: string; description: string; statuses: RequestStatus[]; limit?: number }[] = [
  { title: "Needs triage", description: "New requests nobody has picked up yet.", statuses: ["submitted"] },
  { title: "In triage", description: "Being reviewed, or waiting on the requester.", statuses: ["in_triage", "needs_info"] },
  { title: "Planned and in progress", description: "Accepted work with a commitment.", statuses: ["accepted", "in_progress"] },
  { title: "Delivered", description: "Waiting to be closed.", statuses: ["delivered"] },
  { title: "Closed and declined", description: "Most recent 20.", statuses: ["closed", "declined"], limit: 20 },
];

export default async function IntakePage({ params }: PageProps<"/t/[team]/intake">) {
  const { team: slug } = await params;
  const ctx = await loadTeamPage(slug);
  if (!ctx || !ctx.team.acceptsRequests) return <NotAvailable />;
  const { viewer, team, today } = ctx;
  const [rows, workspace] = await Promise.all([listIntake(team.id), getTeamWorkspace(team.id)]);
  const owners = new Map(workspace.members.map((m) => [m.id, m.name]));

  return (
    <div className="flex flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        context={team.name}
        title="Work requests"
        description="Requests from other teams. Triage decides what becomes committed work; requesters only see what you publish."
      />
      <AccessNote team={team} />
      {rows.length === 0 ? (
        <EmptyState title="No requests yet" body="When another team submits a request to you, it appears here for triage." />
      ) : (
        GROUPS.map((g) => {
          const items = rows.filter((r) => g.statuses.includes(r.status)).slice(0, g.limit ?? 300);
          if (items.length === 0 && g.statuses.includes("closed")) return null;
          return (
            <Section key={g.title} title={`${g.title} · ${items.length}`} description={g.description}>
              {items.length ? (
                <RequestRows rows={items} perspective="team" timezone={viewer.timezone} today={today} ownerNames={owners} />
              ) : (
                <p className="text-body text-fg-3">Nothing here.</p>
              )}
            </Section>
          );
        })
      )}
    </div>
  );
}
