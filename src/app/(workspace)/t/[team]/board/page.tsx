import type { Metadata } from "next";
import { EmptyState, NotAvailable, PageHeader } from "@/components/ui/layout";
import { AccessNote } from "@/features/tasks/components/access-note";
import { Board } from "@/features/tasks/components/board";
import { NewTaskButton } from "@/features/tasks/components/new-task-button";
import { TaskMissingPanel, TaskPanel } from "@/features/tasks/components/task-panel";
import { TaskToolbar } from "@/features/tasks/components/task-toolbar";
import { activeFilterCount, applyFilters, parseFilters } from "@/features/tasks/filters";
import { getTaskDetail, getTeamWorkspace, listTeamTasks } from "@/server/dal/tasks";
import { loadTeamPage } from "@/server/dal/team-page";
import { canCommentTeam, canWriteTeam } from "@/server/policies";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({ params, searchParams }: PageProps<"/t/[team]/board">) {
  const { team: slug } = await params;
  const sp = await searchParams;
  const ctx = await loadTeamPage(slug);
  if (!ctx) return <NotAvailable />;
  const { viewer, team, today } = ctx;

  const taskKey = typeof sp.task === "string" ? sp.task.slice(0, 20) : null;
  const [workspace, { tasks, truncated }, detail] = await Promise.all([
    getTeamWorkspace(team.id),
    listTeamTasks(team.id),
    taskKey ? getTaskDetail(team.id, taskKey) : null,
  ]);
  const filters = parseFilters(sp);
  const filtered = applyFilters(tasks, filters, { viewerId: viewer.id, today, statuses: workspace.statuses });
  const canWrite = canWriteTeam(team);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-5 sm:px-6 lg:px-8">
      <PageHeader
        context={team.name}
        title="Board"
        actions={
          canWrite && (
            <NewTaskButton
              teamSlug={team.slug}
              statuses={workspace.statuses}
              members={workspace.members}
              projects={workspace.projects}
              viewerId={viewer.id}
            />
          )
        }
      />
      <AccessNote team={team} />
      <TaskToolbar
        teamSlug={team.slug}
        view="board"
        filters={filters}
        members={workspace.members}
        labels={workspace.labels}
        projects={workspace.projects}
        total={tasks.length}
        shown={filtered.length}
      />
      {truncated && <p className="text-label text-warning">Showing the first 500 tasks. Use filters or the list view to narrow down.</p>}
      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          body={canWrite ? "Create the first task for this team. It will start in Backlog." : "This team hasn't created any tasks yet."}
        />
      ) : filtered.length === 0 && activeFilterCount(filters) > 0 ? (
        <EmptyState title="No tasks match these filters" body="Try removing a filter, or clear them all from the toolbar." />
      ) : (
        <Board
          teamSlug={team.slug}
          statuses={workspace.statuses}
          transitions={workspace.transitions}
          members={workspace.members}
          tasks={filtered}
          allTasks={tasks}
          canWrite={canWrite}
          viewerId={viewer.id}
          today={today}
          wipLimit={team.wipLimit}
        />
      )}
      {detail ? (
        <TaskPanel
          task={detail}
          workspace={workspace}
          teamSlug={team.slug}
          teamName={team.name}
          canWrite={canWrite}
          canComment={canCommentTeam(team)}
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
