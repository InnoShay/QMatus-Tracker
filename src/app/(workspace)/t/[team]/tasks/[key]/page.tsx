import type { Metadata } from "next";
import Link from "next/link";
import { NotAvailable } from "@/components/ui/layout";
import { TaskDetailView } from "@/features/tasks/components/task-detail";
import { getTaskDetail, getTeamWorkspace } from "@/server/dal/tasks";
import { loadTeamPage } from "@/server/dal/team-page";
import { canCommentTeam, canWriteTeam } from "@/server/policies";

export const metadata: Metadata = { title: "Task" };

/** Full-page task for deep links, deep editing and narrow screens. */
export default async function TaskPage({ params }: PageProps<"/t/[team]/tasks/[key]">) {
  const { team: slug, key } = await params;
  const ctx = await loadTeamPage(slug);
  if (!ctx || !/^[A-Za-z]{2,6}-\d{1,7}$/.test(key)) return <NotAvailable />;
  const { viewer, team, today } = ctx;
  const [task, workspace] = await Promise.all([getTaskDetail(team.id, key), getTeamWorkspace(team.id)]);
  if (!task) return <NotAvailable />;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-0 sm:px-6 sm:py-5">
      <p className="px-5 pt-4 text-label text-fg-3 sm:px-0 sm:pt-0">
        <Link href={`/t/${team.slug}/board`} className="hover:text-fg">
          {team.name} · Board
        </Link>
      </p>
      <div className="mt-2 flex flex-1 flex-col border-line bg-surface sm:rounded-lg sm:border">
        <TaskDetailView
          task={task}
          workspace={workspace}
          teamSlug={team.slug}
          teamName={team.name}
          canWrite={canWriteTeam(team)}
          canComment={canCommentTeam(team)}
          viewerId={viewer.id}
          timezone={viewer.timezone}
          today={today}
        />
      </div>
    </div>
  );
}
