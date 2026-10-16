import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { RequestRows } from "@/features/requests/components/request-rows";
import { OPEN_STATUSES } from "@/features/requests/meta";
import { todayIn } from "@/lib/dates";
import { requireViewer } from "@/server/auth/viewer";
import { listFollowedRequests, listIntakeTeams } from "@/server/dal/requests";
import { canSubmitRequests } from "@/server/policies";

export const metadata: Metadata = { title: "Requests" };

export default async function RequestsPage() {
  const viewer = await requireViewer();
  const [requests, intakeTeams] = await Promise.all([listFollowedRequests(viewer.id), listIntakeTeams()]);
  const teamNames = new Map(intakeTeams.map((t) => [t.id, t.name]));
  const today = todayIn(viewer.timezone);
  const open = requests.filter((r) => OPEN_STATUSES.includes(r.status));
  const drafts = requests.filter((r) => r.status === "draft");
  const finished = requests.filter((r) => r.status === "closed" || r.status === "declined");
  const canSubmit = canSubmitRequests(viewer) && intakeTeams.length > 0;

  return (
    <div className="flex flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        title="Requests"
        description="Work you've asked another team for, or are following. You see the updates the receiving team publishes."
        actions={
          canSubmit && (
            <LinkButton href="/requests/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>
              New request
            </LinkButton>
          )
        }
      />
      {requests.length === 0 ? (
        <EmptyState
          title="You haven't made or followed any requests"
          body="When you need something from another team, submit a request. They'll triage it and keep you posted here."
          action={canSubmit && <LinkButton href="/requests/new">New request</LinkButton>}
        />
      ) : (
        <>
          <Section title="Open" description={`${open.length} in flight`}>
            {open.length ? (
              <RequestRows rows={open} perspective="requester" teamNames={teamNames} timezone={viewer.timezone} today={today} />
            ) : (
              <p className="text-body text-fg-3">Nothing open right now.</p>
            )}
          </Section>
          {drafts.length > 0 && (
            <Section title="Drafts" description="Only you can see these until you submit them.">
              <RequestRows rows={drafts} perspective="requester" teamNames={teamNames} timezone={viewer.timezone} today={today} />
            </Section>
          )}
          {finished.length > 0 && (
            <Section title="Closed and declined">
              <RequestRows rows={finished} perspective="requester" teamNames={teamNames} timezone={viewer.timezone} today={today} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}
