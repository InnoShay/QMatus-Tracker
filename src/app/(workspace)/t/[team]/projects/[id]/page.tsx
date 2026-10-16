import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Badge } from "@/components/ui/badges";
import { NotAvailable, PageHeader, Section } from "@/components/ui/layout";
import { RichText } from "@/components/ui/rich-text";
import { Milestones, ProjectFormButton, ProjectUpdateForm } from "@/features/projects/components";
import { HEALTH, PROJECT_STATUS, projectProgress } from "@/features/projects/progress";
import { NewTaskButton } from "@/features/tasks/components/new-task-button";
import { WorkRow } from "@/features/tasks/components/work-row";
import { formatDateLong, formatRelative } from "@/lib/dates";
import { getProject } from "@/server/dal/projects";
import { getTeamWorkspace, listTeamTasks } from "@/server/dal/tasks";
import { loadTeamPage } from "@/server/dal/team-page";
import { canWriteTeam } from "@/server/policies";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/t/[team]/projects/[id]">) {
  const { team: slug, id } = await params;
  if (!z.uuid().safeParse(id).success) return <NotAvailable />;
  const ctx = await loadTeamPage(slug);
  if (!ctx) return <NotAvailable />;
  const { viewer, team, today } = ctx;
  const [project, workspace, { tasks }] = await Promise.all([getProject(team.id, id), getTeamWorkspace(team.id), listTeamTasks(team.id)]);
  if (!project) return <NotAvailable />;

  const statusById = new Map(workspace.statuses.map((s) => [s.id, s]));
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const prog = projectProgress(projectTasks.map((t) => ({ statusCategory: statusById.get(t.statusId)?.category ?? "backlog" })));
  const open = projectTasks.filter((t) => !["completed", "canceled"].includes(statusById.get(t.statusId)?.category ?? ""));
  const blocked = open.filter((t) => t.blocked);
  const milestoneCounts: Record<string, { done: number; total: number }> = {};
  for (const t of projectTasks) {
    const category = statusById.get(t.statusId)?.category;
    if (!t.milestoneId || category === "canceled") continue;
    const c = (milestoneCounts[t.milestoneId] ??= { done: 0, total: 0 });
    c.total += 1;
    if (category === "completed") c.done += 1;
  }
  const canWrite = canWriteTeam(team);
  const members = workspace.members.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }));
  const lead = workspace.members.find((m) => m.id === project.leadId)?.name;
  const taskHref = (key: string) => `/t/${team.slug}/board?project=${project.id}&task=${key}`;

  return (
    <div className="flex flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        context={
          <Link href={`/t/${team.slug}/projects`} className="hover:text-fg">
            {team.name} · Projects
          </Link>
        }
        title={project.name}
        description={project.purpose ?? undefined}
        actions={
          canWrite && (
            <>
              <ProjectFormButton teamSlug={team.slug} members={members} project={project} />
              <NewTaskButton
                teamSlug={team.slug}
                statuses={workspace.statuses}
                members={workspace.members}
                projects={workspace.projects}
                viewerId={viewer.id}
                defaultProjectId={project.id}
                label="Add task"
                variant="secondary"
              />
            </>
          )
        }
      />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line bg-surface shadow-panel px-4 py-3 md:grid-cols-5">
        <div>
          <dt className="text-meta text-fg-3">Status</dt>
          <dd className="mt-1">
            <Badge>{PROJECT_STATUS[project.status]}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg-3">Health</dt>
          <dd className="mt-1" title={project.health ? HEALTH[project.health].definition : undefined}>
            {project.health ? (
              <Badge tone={HEALTH[project.health].tone}>{HEALTH[project.health].label}</Badge>
            ) : (
              <span className="text-body text-fg-3">Not set</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg-3">Lead</dt>
          <dd className="mt-1 text-body text-fg">{lead ?? <span className="text-fg-3">None</span>}</dd>
        </div>
        <div>
          <dt className="text-meta text-fg-3">Target date</dt>
          <dd className="mt-1 text-body text-fg">
            {project.targetDate ? formatDateLong(project.targetDate) : <span className="text-fg-3">None</span>}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-fg-3">Progress</dt>
          <dd className="mt-1 text-body text-fg tabular">
            {prog.percent === null ? (
              <span className="text-fg-3">No tasks yet</span>
            ) : (
              `${prog.done} of ${prog.total} tasks · ${prog.percent}%`
            )}
          </dd>
        </div>
      </dl>
      {project.health && (
        <p className="-mt-6 text-meta text-fg-3">
          {HEALTH[project.health].label}: {HEALTH[project.health].definition}
        </p>
      )}

      {blocked.length > 0 && (
        <Section title={`Blocked · ${blocked.length}`} description="Shown first because these stop the project moving.">
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
            {blocked.map((t) => {
              const s = statusById.get(t.statusId)!;
              return (
                <WorkRow
                  key={t.id}
                  href={taskHref(t.key)}
                  taskKey={t.key}
                  title={t.title}
                  statusKey={s.key}
                  statusLabel={s.label}
                  priority={t.priority}
                  dueDate={t.dueDate}
                  blocked
                  blockedReason={t.blockedReason}
                  today={today}
                />
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Latest update">
        {project.latestUpdate ? (
          <div className="rounded-xl border border-line bg-surface shadow-panel px-4 py-3">
            <RichText text={project.latestUpdate} />
            {project.latestUpdateAt && (
              <p className="mt-2 text-meta text-fg-3">Posted {formatRelative(project.latestUpdateAt, viewer.timezone)}</p>
            )}
          </div>
        ) : (
          <p className="text-body text-fg-3">No update has been posted yet.</p>
        )}
        {canWrite && <ProjectUpdateForm projectId={project.id} current={project.latestUpdate} />}
      </Section>

      <Section title="Milestones">
        <Milestones
          teamSlug={team.slug}
          project={project}
          members={members}
          canWrite={canWrite}
          today={today}
          taskCounts={milestoneCounts}
        />
      </Section>

      <Section title={`Open tasks · ${open.length}`}>
        {open.length === 0 ? (
          <p className="text-body text-fg-3">No open tasks in this project.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
            {open.map((t) => {
              const s = statusById.get(t.statusId)!;
              return (
                <WorkRow
                  key={t.id}
                  href={taskHref(t.key)}
                  taskKey={t.key}
                  title={t.title}
                  statusKey={s.key}
                  statusLabel={s.label}
                  priority={t.priority}
                  dueDate={t.dueDate}
                  blocked={t.blocked}
                  today={today}
                />
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
