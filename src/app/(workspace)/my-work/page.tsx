import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { RequestRows } from "@/features/requests/components/request-rows";
import { OPEN_STATUSES } from "@/features/requests/meta";
import { NewTaskButton } from "@/features/tasks/components/new-task-button";
import { TaskMissingPanel, TaskPanel } from "@/features/tasks/components/task-panel";
import { WorkRow } from "@/features/tasks/components/work-row";
import { daysBetween, todayIn } from "@/lib/dates";
import { findTeam, requireViewer } from "@/server/auth/viewer";
import { loadMyWork, type MyTask } from "@/server/dal/my-work";
import { listFollowedRequests, listIntakeTeams } from "@/server/dal/requests";
import { getTaskDetail, getTeamWorkspace } from "@/server/dal/tasks";
import { canCommentTeam, canReadTeam, canWriteTeam } from "@/server/policies";

export const metadata: Metadata = { title: "My Work" };

type Group = { id: string; title: string; description?: string; items: MyTask[] };

export default async function MyWorkPage({ searchParams }: PageProps<"/my-work">) {
  const sp = await searchParams;
  const viewer = await requireViewer();
  const today = todayIn(viewer.timezone);
  const readable = viewer.teams.filter(canReadTeam);
  const teamFilter = typeof sp.team === "string" && readable.some((t) => t.slug === sp.team) ? sp.team : "";

  const [{ tasks, toReview }, requests, intakeTeams] = await Promise.all([
    loadMyWork(
      viewer.id,
      readable.map((t) => t.id),
    ),
    listFollowedRequests(viewer.id),
    listIntakeTeams(),
  ]);
  const teamById = new Map(readable.map((t) => [t.id, t]));
  const scoped = tasks.filter((t) => !teamFilter || teamById.get(t.teamId)?.slug === teamFilter);
  const active = scoped.filter((t) => t.status.category !== "completed" && t.status.category !== "canceled");
  const recentlyDone = scoped
    .filter((t) => t.status.category === "completed" && t.completedAt && daysBetween(t.completedAt.slice(0, 10), today) <= 7)
    .slice(0, 10);

  const byDue = (a: MyTask, b: MyTask) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  const groups: Group[] = [
    { id: "overdue", title: "Overdue", items: active.filter((t) => t.dueDate && t.dueDate < today).sort(byDue) },
    { id: "today", title: "Due today", items: active.filter((t) => t.dueDate === today) },
    {
      id: "week",
      title: "Next 7 days",
      items: active.filter((t) => t.dueDate && t.dueDate > today && daysBetween(today, t.dueDate) <= 7).sort(byDue),
    },
    { id: "later", title: "Later", items: active.filter((t) => t.dueDate && daysBetween(today, t.dueDate) > 7).sort(byDue) },
    { id: "nodate", title: "No due date", items: active.filter((t) => !t.dueDate) },
  ];
  const blocked = active.filter((t) => t.blocked);
  const followed = requests.filter((r) => OPEN_STATUSES.includes(r.status)).slice(0, 8);
  const teamNames = new Map(intakeTeams.map((t) => [t.id, t.name]));

  // Task panel in place, so opening a task never leaves My Work.
  const taskKey = typeof sp.task === "string" ? sp.task.slice(0, 20) : null;
  const panelTeam = typeof sp.in === "string" ? findTeam(viewer, sp.in) : null;
  const [detail, workspace] =
    taskKey && panelTeam && canReadTeam(panelTeam)
      ? await Promise.all([getTaskDetail(panelTeam.id, taskKey), getTeamWorkspace(panelTeam.id)])
      : [null, null];

  const href = (t: { key: string; teamId: string }) => {
    const qs = new URLSearchParams();
    if (teamFilter) qs.set("team", teamFilter);
    qs.set("task", t.key);
    qs.set("in", teamById.get(t.teamId)?.slug ?? "");
    return `/my-work?${qs.toString()}`;
  };
  const writable = readable.filter(canWriteTeam);
  const primary = writable[0];
  const primaryWorkspace = primary ? await getTeamWorkspace(primary.id) : null;

  return (
    <div className="flex flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        title="My Work"
        description={
          active.length
            ? `${active.length} open task${active.length === 1 ? "" : "s"} assigned to you${blocked.length ? `, ${blocked.length} blocked` : ""}.`
            : "Tasks assigned to you across your teams."
        }
        actions={
          primary &&
          primaryWorkspace && (
            <NewTaskButton
              teamSlug={primary.slug}
              statuses={primaryWorkspace.statuses}
              members={primaryWorkspace.members}
              projects={primaryWorkspace.projects}
              viewerId={viewer.id}
              label={writable.length > 1 ? `New task in ${primary.name}` : "New task"}
            />
          )
        }
      />

      {readable.length > 1 && (
        <nav aria-label="Filter by team" className="-mt-4 flex flex-wrap gap-1.5">
          {[{ slug: "", name: "All teams" }, ...readable].map((t) => (
            <Link
              key={t.slug || "all"}
              href={t.slug ? `/my-work?team=${t.slug}` : "/my-work"}
              aria-current={teamFilter === t.slug ? "page" : undefined}
              className={
                teamFilter === t.slug
                  ? "inline-flex h-8 items-center rounded-sm border border-accent bg-accent-soft px-3 text-label font-medium text-fg"
                  : "inline-flex h-8 items-center rounded-sm border border-line-strong bg-surface px-3 text-label text-fg-2 hover:text-fg"
              }
            >
              {t.name}
            </Link>
          ))}
        </nav>
      )}

      {active.length === 0 && toReview.length === 0 ? (
        <EmptyState
          title="Nothing assigned to you"
          body={
            readable.length
              ? "Pick something up from your team's Ready column, or create a task."
              : "You aren't on a team yet. You can still submit and follow work requests."
          }
          action={
            readable[0] ? (
              <Link href={`/t/${readable[0].slug}/board`} className="text-body font-medium text-accent hover:text-accent-hover">
                Open {readable[0].name} board
              </Link>
            ) : (
              <Link href="/requests" className="text-body font-medium text-accent hover:text-accent-hover">
                Go to Requests
              </Link>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {toReview.length > 0 && (
            <Section title="Waiting for your review" description="Tasks in review where you're the reviewer.">
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
                {toReview.map((t) => (
                  <WorkRow
                    key={t.id}
                    href={href(t)}
                    taskKey={t.key}
                    title={t.title}
                    statusKey={t.status.key}
                    statusLabel={t.status.label}
                    dueDate={t.dueDate}
                    teamName={teamById.get(t.teamId)?.name}
                    today={today}
                  />
                ))}
              </ul>
            </Section>
          )}
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <Section key={g.id} id={`group-${g.id}`} title={`${g.title} · ${g.items.length}`}>
                <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
                  {g.items.map((t) => (
                    <WorkRow
                      key={t.id}
                      href={href(t)}
                      taskKey={t.key}
                      title={t.title}
                      statusKey={t.status.key}
                      statusLabel={t.status.label}
                      priority={t.priority}
                      dueDate={t.dueDate}
                      blocked={t.blocked}
                      blockedReason={t.blockedReason}
                      teamName={readable.length > 1 ? teamById.get(t.teamId)?.name : undefined}
                      today={today}
                    />
                  ))}
                </ul>
              </Section>
            ))}
        </div>
      )}

      {followed.length > 0 && (
        <Section title="Requests you're following" description="Latest published status from the receiving team.">
          <RequestRows rows={followed} perspective="requester" teamNames={teamNames} timezone={viewer.timezone} today={today} />
        </Section>
      )}

      {recentlyDone.length > 0 && (
        <Section title="Completed this week">
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
            {recentlyDone.map((t) => (
              <WorkRow
                key={t.id}
                href={href(t)}
                taskKey={t.key}
                title={t.title}
                statusKey={t.status.key}
                statusLabel={t.status.label}
                dueDate={null}
                teamName={teamById.get(t.teamId)?.name}
                today={today}
                done
              />
            ))}
          </ul>
        </Section>
      )}

      {detail && workspace && panelTeam ? (
        <TaskPanel
          task={detail}
          workspace={workspace}
          teamSlug={panelTeam.slug}
          teamName={panelTeam.name}
          canWrite={canWriteTeam(panelTeam)}
          canComment={canCommentTeam(panelTeam)}
          viewerId={viewer.id}
          timezone={viewer.timezone}
          today={today}
        />
      ) : taskKey ? (
        <TaskMissingPanel />
      ) : null}
    </div>
  );
}
