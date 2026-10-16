import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { IssueKey, PriorityMark } from "@/components/ui/badges";
import { AudienceSeam, NotAvailable } from "@/components/ui/layout";
import { RichText } from "@/components/ui/rich-text";
import { IntakePanel } from "@/features/requests/components/intake-panel";
import { RequestStatusBadge, RequestTimeline } from "@/features/requests/components/request-parts";
import { SharedDiscussion } from "@/features/requests/components/shared-discussion";
import { SubmitDraftButton } from "@/features/requests/components/submit-draft";
import { formatDateLong } from "@/lib/dates";
import { requireViewer } from "@/server/auth/viewer";
import { getRequestInternal, getRequestShared, listIntakeTeams } from "@/server/dal/requests";
import { getTeamWorkspace } from "@/server/dal/tasks";
import { canReadTeam, isTeamMember } from "@/server/policies";

export const metadata: Metadata = { title: "Work request" };

export default async function RequestPage({ params }: PageProps<"/requests/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return <NotAvailable />;
  const viewer = await requireViewer();

  const targetTeam = (teamId: string) => viewer.teams.find((t) => t.id === teamId) ?? null;
  // Fetch shared data first; RLS decides whether the viewer may see it at all.
  const probe = await getRequestShared(id, { showActors: false });
  if (!probe) return <NotAvailable />;
  const team = targetTeam(probe.targetTeamId);
  const onReceivingTeam = canReadTeam(team);
  const request = onReceivingTeam ? await getRequestShared(id, { showActors: true }) : probe;
  if (!request) return <NotAvailable />;

  const perspective = onReceivingTeam ? "team" : "requester";
  const intakeTeams = await listIntakeTeams();
  const teamName = team?.name ?? intakeTeams.find((t) => t.id === request.targetTeamId)?.name ?? "The receiving team";
  const isAudience = request.submitterId === viewer.id || request.audience.some((a) => a.id === viewer.id);
  const canPost = request.status !== "draft" && (isAudience || isTeamMember(team));
  const timezone = viewer.timezone;

  const [internal, workspace] =
    onReceivingTeam && request.status !== "draft" ? await Promise.all([getRequestInternal(id), getTeamWorkspace(team!.id)]) : [null, null];

  return (
    <div className="grid gap-8 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 xl:grid-cols-[minmax(0,1fr)_400px]">
      <article className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-label text-fg-3">
            <Link href={onReceivingTeam ? `/t/${team!.slug}/intake` : "/requests"} className="hover:text-fg">
              {onReceivingTeam ? `${team!.name} · Work requests` : "Requests"}
            </Link>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <IssueKey className="text-label">REQ-{request.number}</IssueKey>
            <RequestStatusBadge status={request.status} perspective={perspective} />
          </div>
          <h1 className="text-title font-semibold text-balance text-fg [overflow-wrap:anywhere]">{request.title}</h1>
          <p className="text-label text-fg-2">
            From {request.submitterName ?? "a teammate"} to {teamName}
            {request.submittedAt && ` · submitted ${formatDateLong(request.submittedAt.slice(0, 10))}`}
          </p>
        </header>

        {request.status === "draft" && request.submitterId === viewer.id && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-subtle px-4 py-3">
            <p className="flex-1 text-body text-fg-2">This is a draft. Only you can see it until you submit it.</p>
            <SubmitDraftButton requestId={request.id} />
          </div>
        )}

        {/* Requested vs committed, never conflated (spec §5.2). */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line bg-surface shadow-panel px-4 py-3 sm:grid-cols-4">
          <div>
            <dt className="text-meta text-fg-3">Requested priority</dt>
            <dd className="mt-0.5">
              <PriorityMark priority={request.requestedPriority} withLabel />
            </dd>
          </div>
          <div>
            <dt className="text-meta text-fg-3">Requested by</dt>
            <dd className="mt-0.5 text-body text-fg">{request.requestedDate ? formatDateLong(request.requestedDate) : "No date"}</dd>
          </div>
          <div>
            <dt className="text-meta text-fg-3">Committed priority</dt>
            <dd className="mt-0.5">
              {request.committedPriority ? (
                <PriorityMark priority={request.committedPriority} withLabel />
              ) : (
                <span className="text-body text-fg-3">Not yet</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-meta text-fg-3">Committed date</dt>
            <dd className="mt-0.5 text-body text-fg">
              {request.committedDate ? formatDateLong(request.committedDate) : <span className="text-fg-3">Not yet</span>}
            </dd>
          </div>
        </dl>

        {request.outcomeReason && (request.status === "declined" || request.status === "closed") && (
          <div className="rounded-md border border-line bg-subtle px-4 py-3">
            <p className="text-label font-medium text-fg">{request.status === "declined" ? "Why it was declined" : "Closing note"}</p>
            <p className="mt-1 text-body text-fg-2">{request.outcomeReason}</p>
          </div>
        )}

        <section className="flex flex-col gap-4">
          <AudienceSeam audience={`Shared with the requester and ${teamName}`} tone="shared" />
          <div>
            <h2 className="text-section font-semibold text-fg">Problem</h2>
            <RichText text={request.problem} className="mt-1.5" />
          </div>
          <div>
            <h2 className="text-section font-semibold text-fg">Desired outcome</h2>
            <RichText text={request.outcome} className="mt-1.5" />
          </div>
          {request.acceptanceCriteria && (
            <div>
              <h2 className="text-section font-semibold text-fg">How we&apos;ll know it&apos;s done</h2>
              <RichText text={request.acceptanceCriteria} className="mt-1.5" />
            </div>
          )}
          {request.links && (
            <div>
              <h2 className="text-section font-semibold text-fg">Links</h2>
              <RichText text={request.links} className="mt-1.5" />
            </div>
          )}
          <p className="text-meta text-fg-3">Following: {request.audience.map((a) => a.name).join(", ")}</p>
        </section>

        {request.events.length > 0 && (
          <section aria-labelledby="progress" className="flex flex-col gap-3">
            <h2 id="progress" className="text-section font-semibold text-fg">
              Request progress
            </h2>
            <RequestTimeline events={request.events} perspective={perspective} teamName={teamName} timezone={timezone} />
          </section>
        )}

        {request.status !== "draft" && (
          <section aria-labelledby="discussion" className="flex flex-col gap-3">
            <h2 id="discussion" className="text-section font-semibold text-fg">
              Discussion
            </h2>
            <SharedDiscussion
              requestId={request.id}
              messages={request.messages}
              canPost={canPost}
              timezone={timezone}
              emptyCopy={
                onReceivingTeam
                  ? "No messages yet. Questions you post here are visible to the requester."
                  : "No messages yet. Ask a question or add context for the receiving team."
              }
            />
          </section>
        )}
      </article>

      {internal && workspace && team && (
        <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <IntakePanel
            requestId={request.id}
            requestNumber={request.number}
            status={request.status}
            requestedPriority={request.requestedPriority}
            requestedDate={request.requestedDate}
            requestTitle={request.title}
            teamId={team.id}
            teamSlug={team.slug}
            teamName={team.name}
            members={workspace.members.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }))}
            internal={internal}
            canAct={isTeamMember(team)}
            timezone={timezone}
          />
        </div>
      )}
    </div>
  );
}
