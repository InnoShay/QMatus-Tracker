import type { Metadata } from "next";
import Link from "next/link";
import { NotAvailable, PageHeader } from "@/components/ui/layout";
import { RequestForm } from "@/features/requests/components/request-form";
import { requireViewer } from "@/server/auth/viewer";
import { listIntakeTeams, listWorkspaceMembers } from "@/server/dal/requests";
import { canSubmitRequests, isTeamMember } from "@/server/policies";

export const metadata: Metadata = { title: "New request" };

export default async function NewRequestPage() {
  const viewer = await requireViewer();
  if (!canSubmitRequests(viewer)) {
    return (
      <NotAvailable
        title="You can't submit requests"
        body="Your account doesn't have the requester capability. Ask a workspace admin if you need it."
      />
    );
  }
  const [intakeTeams, people] = await Promise.all([listIntakeTeams(), listWorkspaceMembers(viewer.org.id)]);
  const memberTeams = viewer.teams.filter(isTeamMember);
  // You don't request work from a team you're on; use its board instead.
  const targets = intakeTeams.filter((t) => !memberTeams.some((m) => m.id === t.id));

  return (
    <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        context={
          <Link href="/requests" className="hover:text-fg">
            Requests
          </Link>
        }
        title="New work request"
        description="Describe the outcome you need. The receiving team decides how and when to deliver it."
      />
      <RequestForm
        intakeTeams={targets.map((t) => ({ id: t.id, name: t.name }))}
        sourceTeams={memberTeams.map((t) => ({ id: t.id, name: t.name }))}
        people={people}
        viewerId={viewer.id}
      />
    </div>
  );
}
