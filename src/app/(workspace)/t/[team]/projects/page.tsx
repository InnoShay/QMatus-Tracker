import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badges";
import { EmptyState, NotAvailable, PageHeader } from "@/components/ui/layout";
import { ProjectFormButton } from "@/features/projects/components";
import { HEALTH, PROJECT_STATUS, projectProgress } from "@/features/projects/progress";
import { formatDueDate } from "@/lib/dates";
import { listProjects } from "@/server/dal/projects";
import { getTeamWorkspace, listTeamTasks } from "@/server/dal/tasks";
import { loadTeamPage } from "@/server/dal/team-page";
import { canWriteTeam } from "@/server/policies";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ params }: PageProps<"/t/[team]/projects">) {
  const { team: slug } = await params;
  const ctx = await loadTeamPage(slug);
  if (!ctx) return <NotAvailable />;
  const { team, today } = ctx;
  const [projects, workspace, { tasks }] = await Promise.all([listProjects(team.id), getTeamWorkspace(team.id), listTeamTasks(team.id)]);
  const category = new Map(workspace.statuses.map((s) => [s.id, s.category]));
  const members = workspace.members.filter((m) => m.active);
  const name = (id: string | null) => workspace.members.find((m) => m.id === id)?.name;

  return (
    <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        context={team.name}
        title="Projects"
        description="Outcomes the team is working towards. Progress counts completed tasks out of all non-canceled tasks in the project."
        actions={canWriteTeam(team) && <ProjectFormButton teamSlug={team.slug} members={members} />}
      />
      {projects.length === 0 ? (
        <EmptyState title="No projects yet" body="Group related tasks under a project when they share an outcome and a target date." />
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
          {projects.map((p) => {
            const prog = projectProgress(
              tasks.filter((t) => t.projectId === p.id).map((t) => ({ statusCategory: category.get(t.statusId) ?? "backlog" })),
            );
            const next = p.milestones.find((m) => !m.done);
            return (
              <li key={p.id} className="relative flex flex-col gap-2 px-4 py-4 hover:bg-hover lg:flex-row lg:items-center lg:gap-6">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/t/${team.slug}/projects/${p.id}`}
                    className="text-body font-semibold text-fg outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
                  >
                    {p.name}
                  </Link>
                  {p.purpose && <p className="mt-0.5 line-clamp-1 text-label text-fg-2">{p.purpose}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-label text-fg-2">
                  <Badge>{PROJECT_STATUS[p.status]}</Badge>
                  {p.health && <Badge tone={HEALTH[p.health].tone}>{HEALTH[p.health].label}</Badge>}
                  {name(p.leadId) && <span>Lead {name(p.leadId)}</span>}
                  <span className="tabular">
                    {prog.percent === null ? "No tasks yet" : `${prog.done}/${prog.total} done · ${prog.percent}%`}
                  </span>
                  {next && (
                    <span className="text-fg-3">
                      Next: {next.name}
                      {next.dueDate ? ` (${formatDueDate(next.dueDate, today)})` : ""}
                    </span>
                  )}
                  {p.targetDate && <span className="tabular text-fg-3">Target {formatDueDate(p.targetDate, today)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
