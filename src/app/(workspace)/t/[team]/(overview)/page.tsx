import type { Metadata } from "next";
import { ArrowUpRight, Kanban, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Badge, BlockedBadge, IssueKey, StatusIcon } from "@/components/ui/badges";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { NotAvailable } from "@/components/ui/layout";
import { FlowChart } from "@/features/dashboard/components/flow-chart";
import { Delta, Figure, Panel, PanelLink } from "@/features/dashboard/components/panels";
import { HEALTH, projectProgress } from "@/features/projects/progress";
import { RequestRows } from "@/features/requests/components/request-rows";
import { PRIORITY_ORDER } from "@/features/tasks/meta";
import { DueCue } from "@/features/tasks/components/task-card";
import { NewTaskButton } from "@/features/tasks/components/new-task-button";
import { addDays, daysBetween, todayIn } from "@/lib/dates";
import { formatDuration } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { findTeam, requireViewer } from "@/server/auth/viewer";
import { FLOW_RANGES, getTeamFlow, type FlowRange } from "@/server/dal/dashboard";
import { listProjects } from "@/server/dal/projects";
import { listIntake } from "@/server/dal/requests";
import { getTeamWorkspace, listTeamTasks } from "@/server/dal/tasks";
import { canReadTeam, canWriteTeam, describeAccess, isTeamLead } from "@/server/policies";

export const metadata: Metadata = { title: "Dashboard" };

type Summary = {
  backlog: number | null;
  in_progress: number | null;
  in_review: number | null;
  blocked: number | null;
  overdue: number | null;
  completed_14d: number | null;
  full_access: boolean;
};

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);

export default async function TeamDashboard({ params, searchParams }: PageProps<"/t/[team]">) {
  const { team: slug } = await params;
  const sp = await searchParams;
  const viewer = await requireViewer();
  const team = findTeam(viewer, slug);
  if (!team) return <NotAvailable />;
  const today = todayIn(viewer.timezone);
  const supabase = await createClient();
  const range: FlowRange = FLOW_RANGES.find((r) => String(r) === sp.range) ?? 14;
  const readable = canReadTeam(team);
  // Every read starts at once: one round trip of latency for the whole page.
  const [{ data }, full, timeRes] = await Promise.all([
    supabase.rpc("team_dashboard_summary", { p_team: team.id }),
    readable
      ? Promise.all([
          getTeamWorkspace(team.id),
          listTeamTasks(team.id),
          listProjects(team.id),
          team.acceptsRequests ? listIntake(team.id) : Promise.resolve([]),
          getTeamFlow(team.id, today, range, viewer.timezone),
        ])
      : null,
    // Team time totals are a lead-only capability: one suppressed aggregate, no people (DECISIONS D-022).
    isTeamLead(team) ? supabase.rpc("team_time_totals", { p_team: team.id, p_from: addDays(today, -13), p_to: today }) : null,
  ]);
  const summary = data as Summary | null;
  if (!summary) return <NotAvailable />;

  // Summary-only grant: allowlisted aggregates, nothing else (spec §7.4).
  if (!readable || !full) {
    const n = (v: number | null) => (v === null ? "Fewer than 3" : String(v));
    return (
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <p className="text-label text-fg-3">{describeAccess(team.access)}</p>
          <h1 className="mt-1 text-[30px] leading-9 font-semibold tracking-[-0.02em] text-fg">{`${team.name} summary`}</h1>
          <p className="mt-1 max-w-[68ch] text-body text-fg-2">
            Aggregate counts only. Task details, names and activity are private to the team.
          </p>
        </header>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["Not started", summary.backlog, "bg-st-backlog"],
              ["In progress", summary.in_progress, "bg-st-progress"],
              ["In review", summary.in_review, "bg-st-review"],
              ["Blocked", summary.blocked, "bg-st-blocked"],
              ["Overdue", summary.overdue, "bg-ember"],
              ["Completed, last 14 days", summary.completed_14d, "bg-st-done"],
            ] as const
          ).map(([label, value, dot]) => (
            <div key={label} className="qm-card px-4 py-4">
              <dt className="flex items-center gap-2 text-label text-fg-2">
                <span className={cn("size-2 rounded-full", dot)} aria-hidden />
                {label}
              </dt>
              <dd className={value === null ? "mt-3 text-body text-fg-3" : "mt-2"}>
                {value === null ? n(value) : <Figure value={value} className="text-[32px] leading-10" />}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-meta text-fg-3">
          Counts under 3 are hidden so individual tasks can&apos;t be inferred.
          {team.grantExpiresAt ? ` Access ends ${team.grantExpiresAt.slice(0, 10)}.` : ""}
        </p>
      </div>
    );
  }

  const [workspace, { tasks }, projects, intake, flow] = full;
  const statusById = new Map(workspace.statuses.map((s) => [s.id, s]));
  const category = (statusId: string) => statusById.get(statusId)?.category ?? "backlog";
  const isOpen = (statusId: string) => !["completed", "canceled"].includes(category(statusId));
  const openTasks = tasks.filter((t) => isOpen(t.statusId));
  const isBlocked = (t: (typeof tasks)[number]) => t.blocked || t.openBlockers > 0;
  const isOverdue = (t: (typeof tasks)[number]) => !!t.dueDate && t.dueDate < today;

  const mine = openTasks
    .filter((t) => t.assigneeId === viewer.id)
    .sort(
      (a, b) =>
        Number(isOverdue(b)) - Number(isOverdue(a)) ||
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
  const mineDueThisWeek = mine.filter((t) => t.dueDate && daysBetween(today, t.dueDate) <= 7).length;
  const blocked = openTasks.filter(isBlocked);
  const overdue = openTasks.filter(isOverdue);
  const attention = openTasks
    .filter((t) => isBlocked(t) || isOverdue(t))
    .sort((a, b) => Number(isBlocked(b)) - Number(isBlocked(a)) || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"))
    .slice(0, 6);
  const attentionCount = blocked.length + overdue.length - blocked.filter(isOverdue).length;
  const needsTriage = intake.filter((r) => r.status === "submitted" || r.status === "in_triage");
  const milestones = projects
    .flatMap((p) => p.milestones.filter((m) => !m.done && m.dueDate).map((m) => ({ ...m, project: p })))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 5);
  const activeProjects = projects
    .filter((p) => p.status === "active")
    .map((p) => ({
      ...p,
      progress: projectProgress(tasks.filter((t) => t.projectId === p.id).map((t) => ({ statusCategory: category(t.statusId) }))),
    }));
  const canWrite = canWriteTeam(team);
  const timeTotals = (timeRes?.data ?? null) as { suppressed: boolean; total_seconds: number | null } | null;

  const base = `/t/${team.slug}`;
  const board = `${base}/board`;
  const inProgress = summary.in_progress ?? 0;
  const overLimit = team.wipLimit !== null && inProgress > team.wipLimit;
  const net = flow.totals.created - flow.totals.completed;

  const tiles = [
    {
      label: "Assigned to you",
      value: mine.length,
      dot: "bg-brand",
      href: `${board}?assignee=me`,
      caption: mineDueThisWeek ? `${mineDueThisWeek} due within a week` : "Nothing due this week",
    },
    {
      label: "In progress",
      value: inProgress,
      dot: "bg-st-progress",
      href: board,
      caption: team.wipLimit ? `WIP limit ${team.wipLimit}` : "Being worked on now",
      meter: team.wipLimit ? Math.min(1, inProgress / team.wipLimit) : null,
    },
    { label: "In review", value: summary.in_review ?? 0, dot: "bg-st-review", href: board, caption: "Waiting on a reviewer" },
    {
      label: "Blocked",
      value: blocked.length,
      dot: "bg-st-blocked",
      href: `${board}?blocked=1`,
      caption: blocked.length ? `${blocked.filter((t) => t.openBlockers > 0).length} waiting on other tasks` : "Nothing is blocked",
      alert: blocked.length > 0,
    },
    {
      label: "Overdue",
      value: overdue.length,
      dot: "bg-ember",
      href: `${base}/list?due=overdue&sort=due`,
      caption: overdue.length ? "Past their due date" : "Everything is on time",
      alert: overdue.length > 0,
    },
  ];

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.025em] text-balance text-fg">{team.name}</h1>
          <p className="mt-1 max-w-[68ch] text-body text-fg-2">
            {team.description ? `${team.description} · ` : ""}
            <time dateTime={today}>{DAY.format(asDate(today))}</time>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <LinkButton href={board} icon={<Kanban className="size-4" aria-hidden />}>
            Open board
          </LinkButton>
          {canWrite && (
            <NewTaskButton
              teamSlug={team.slug}
              statuses={workspace.statuses}
              members={workspace.members}
              projects={workspace.projects}
              viewerId={viewer.id}
            />
          )}
        </div>
      </header>

      <nav aria-label="Team summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="qm-card group flex flex-col gap-3 px-4 py-4 transition-[border-color,background-color] duration-[120ms] hover:border-line-strong hover:bg-hover last:col-span-2 sm:last:col-span-1"
          >
            <span className="flex items-center gap-2 text-label text-fg-2">
              <span className={cn("size-2 rounded-full", t.dot)} aria-hidden />
              {t.label}
              <ArrowUpRight className="ml-auto size-4 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </span>
            <Figure
              value={t.value}
              testId={`tile-${t.label.toLowerCase().replace(/ /g, "-")}`}
              className={cn("text-[40px] leading-[44px]", t.alert && (t.label === "Blocked" ? "text-st-blocked" : "text-ember-ink"))}
            />
            {"meter" in t && t.meter !== null && t.meter !== undefined ? (
              <span className="flex flex-col gap-1.5">
                <span className="h-1.5 overflow-hidden rounded-full bg-chart-track" aria-hidden>
                  <span
                    className={cn("block h-full rounded-full", overLimit ? "bg-ember" : "bg-brand")}
                    style={{ width: `${Math.max(4, t.meter * 100)}%` }}
                  />
                </span>
                <span className={cn("text-meta", overLimit ? "font-medium text-ember-ink" : "text-fg-3")}>
                  {overLimit ? `Over the WIP limit of ${team.wipLimit}` : t.caption}
                </span>
              </span>
            ) : (
              <span className="text-meta text-fg-3">{t.caption}</span>
            )}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Flow over time */}
        <Panel
          id="flow"
          title="Flow"
          caption={`Tasks created and completed per day, last ${range} days`}
          className="xl:col-span-8"
          action={
            <div role="group" aria-label="Time range" className="inline-flex rounded-full border border-line bg-subtle p-0.5">
              {FLOW_RANGES.map((r) => (
                <Link
                  key={r}
                  href={r === 14 ? base : `${base}?range=${r}`}
                  scroll={false}
                  aria-current={r === range ? "true" : undefined}
                  className={cn(
                    "inline-flex h-7 items-center rounded-full px-3 text-label font-medium tabular pointer-coarse:h-9",
                    r === range ? "bg-surface text-fg shadow-raised" : "text-fg-3 hover:text-fg",
                  )}
                >
                  {r} days
                </Link>
              ))}
            </div>
          }
        >
          <dl className="flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="flex items-center gap-2 text-label text-fg-2">
                <span className="h-0.5 w-3.5 rounded-full bg-chart-2" aria-hidden />
                Completed
              </dt>
              <dd className="mt-1 flex items-baseline gap-3">
                <Figure value={flow.totals.completed} className="text-[34px] leading-10" testId="flow-completed" />
                <Delta now={flow.totals.completed} before={flow.previous.completed} goodWhenUp />
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-label text-fg-2">
                <span className="h-0.5 w-3.5 rounded-full bg-chart-1" aria-hidden />
                Created
              </dt>
              <dd className="mt-1 flex items-baseline gap-3">
                <Figure value={flow.totals.created} className="text-[34px] leading-10" testId="flow-created" />
                <Delta now={flow.totals.created} before={flow.previous.created} />
              </dd>
            </div>
            <div className="sm:ml-auto sm:text-right">
              <dt className="text-label text-fg-2">Open work</dt>
              <dd className="mt-1 text-body text-fg-2">
                {net === 0 ? (
                  "Held steady"
                ) : (
                  <>
                    <span className={cn("font-semibold tabular", net > 0 ? "text-ember-ink" : "text-success")}>
                      {net > 0 ? "+" : "−"}
                      {Math.abs(net)}
                    </span>{" "}
                    {net > 0 ? "more created than finished" : "more finished than created"}
                  </>
                )}
              </dd>
            </div>
          </dl>
          {flow.totals.created + flow.totals.completed === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-line-strong px-4 py-10 text-center text-body text-fg-3">
              No tasks were created or completed in the last {range} days.
            </p>
          ) : (
            <figure
              className="mt-5"
              aria-label={`Created vs completed per day: ${flow.totals.created} created, ${flow.totals.completed} completed`}
            >
              <FlowChart days={flow.days} />
              <details className="group mt-2">
                <summary className="cursor-pointer list-none text-meta font-medium text-fg-3 hover:text-fg-2 [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show as table</span>
                  <span className="hidden group-open:inline">Hide table</span>
                </summary>
                <div className="mt-2 max-h-64 overflow-auto rounded-md border border-line">
                  <table className="w-full text-left text-label">
                    <thead className="sticky top-0 bg-subtle text-fg-3">
                      <tr>
                        <th className="px-3 py-2 font-medium">Day</th>
                        <th className="px-3 py-2 text-right font-medium">Created</th>
                        <th className="px-3 py-2 text-right font-medium">Completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {[...flow.days].reverse().map((d) => (
                        <tr key={d.date}>
                          <td className="px-3 py-1.5 text-fg-2">{DAY.format(asDate(d.date))}</td>
                          <td className="px-3 py-1.5 text-right text-fg tabular">{d.created}</td>
                          <td className="px-3 py-1.5 text-right text-fg tabular">{d.completed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </figure>
          )}
        </Panel>

        {/* What needs me */}
        <Panel
          id="queue"
          title="Your queue"
          caption="Your open tasks in this team, most urgent first"
          className="xl:col-span-4"
          action={<PanelLink href="/my-work">My Work</PanelLink>}
        >
          {(blocked.length > 0 || overdue.length > 0) && (
            <Link
              href="#attention"
              className="group mb-4 flex scroll-mt-24 items-start gap-3 rounded-lg bg-ember-strong px-4 py-3.5 text-on-ember transition-[filter] duration-[120ms] hover:brightness-110"
            >
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body font-semibold">
                  {attentionCount} team {attentionCount === 1 ? "task needs" : "tasks need"} attention
                </span>
                <span className="text-label opacity-90">
                  {blocked.length} blocked · {overdue.length} overdue
                </span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 opacity-80 group-hover:opacity-100" aria-hidden />
            </Link>
          )}
          {mine.length === 0 ? (
            <p className="py-6 text-body text-fg-3">Nothing is assigned to you here. Pick something from the board’s Ready column.</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {mine.slice(0, 6).map((t) => {
                const s = statusById.get(t.statusId)!;
                return (
                  <li key={t.id} className="relative flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-hover">
                    <StatusIcon statusKey={s.key} />
                    <span className="sr-only">{s.label}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Link
                        href={`${board}?task=${t.key}`}
                        scroll={false}
                        className="truncate text-body font-medium text-fg outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-focus"
                      >
                        {t.title}
                      </Link>
                      <IssueKey>{t.key}</IssueKey>
                    </span>
                    {isBlocked(t) && <span className="size-2 shrink-0 rounded-full bg-st-blocked" title="Blocked" />}
                    {t.dueDate && <DueCue due={t.dueDate} today={today} done={false} />}
                  </li>
                );
              })}
              {mine.length > 6 && (
                <li className="px-2 pt-1 text-meta text-fg-3">
                  <Link href={`${board}?assignee=me`} className="hover:text-fg-2">
                    {mine.length - 6} more on the board
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Panel>

        {/* Projects */}
        <Panel
          id="projects"
          title="Projects"
          caption="Completed tasks out of all non-canceled tasks"
          className="xl:col-span-7"
          action={<PanelLink href={`${base}/projects`}>All projects</PanelLink>}
        >
          {activeProjects.length === 0 ? (
            <p className="py-6 text-body text-fg-3">No active projects. Projects group related tasks under one outcome.</p>
          ) : (
            <ul className="flex flex-col gap-5">
              {activeProjects.map((p) => (
                <li key={p.id} className="flex items-center gap-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Link href={`${base}/projects/${p.id}`} className="min-w-0 truncate text-body font-medium text-fg hover:text-accent">
                        {p.name}
                      </Link>
                      {p.health && <Badge tone={HEALTH[p.health].tone}>{HEALTH[p.health].label}</Badge>}
                    </div>
                    <div
                      className="h-2.5 overflow-hidden rounded-full bg-chart-track"
                      role="progressbar"
                      aria-label={`${p.name} progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={p.progress.percent ?? 0}
                    >
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${p.progress.percent ? Math.max(3, p.progress.percent) : 0}%` }}
                      />
                    </div>
                    <p className="text-meta text-fg-3">
                      {p.progress.total ? `${p.progress.done} of ${p.progress.total} tasks done` : "No tasks yet"}
                      {p.targetDate && <> · target {DAY.format(asDate(p.targetDate)).split(", ")[1]}</>}
                    </p>
                  </div>
                  <Figure
                    value={p.progress.percent ?? "—"}
                    unit={p.progress.percent === null ? undefined : "%"}
                    className="w-20 shrink-0 justify-end text-[30px] leading-9"
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Milestones */}
        <Panel id="milestones" title="Milestones" caption="Next dated milestones across projects" className="xl:col-span-5">
          {milestones.length === 0 ? (
            <p className="py-6 text-body text-fg-3">No dated milestones. Add dates on a project to see them here.</p>
          ) : (
            <ol className="flex flex-col">
              {milestones.map((m, i) => {
                const days = daysBetween(today, m.dueDate!);
                const late = days < 0;
                return (
                  <li key={m.id} className="relative flex gap-4 pb-4 last:pb-0">
                    {i < milestones.length - 1 && <span className="absolute top-12 bottom-1 left-[21px] w-px bg-line" aria-hidden />}
                    <time
                      dateTime={m.dueDate!}
                      className={cn(
                        "flex size-11 shrink-0 flex-col items-center justify-center rounded-md border",
                        late ? "border-danger/40 bg-danger-bg text-danger" : "border-line bg-subtle text-fg",
                      )}
                    >
                      <span className="text-[15px] leading-4 font-semibold tabular">{m.dueDate!.slice(8, 10)}</span>
                      <span className="text-[10px] leading-3 font-medium uppercase opacity-80">{MONTH.format(asDate(m.dueDate!))}</span>
                    </time>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <Link
                        href={`${base}/projects/${m.project.id}`}
                        className="line-clamp-1 text-body font-medium text-fg hover:text-accent"
                      >
                        {m.name}
                      </Link>
                      <p className="text-meta text-fg-3">
                        {m.project.name} ·{" "}
                        <span className={late ? "font-medium text-danger" : days <= 3 ? "font-medium text-ember-ink" : undefined}>
                          {days === 0
                            ? "due today"
                            : late
                              ? `${-days} ${days === -1 ? "day" : "days"} late`
                              : `in ${days} ${days === 1 ? "day" : "days"}`}
                        </span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        {/* Needs attention */}
        <Panel
          id="attention"
          title="Needs attention"
          caption="Blocked or overdue work, blockers first"
          className="xl:col-span-7"
          action={<PanelLink href={`${board}?blocked=1`}>Blocked on board</PanelLink>}
        >
          {attention.length === 0 ? (
            <p className="py-6 text-body text-fg-3">Nothing is blocked or overdue.</p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {attention.map((t) => {
                const s = statusById.get(t.statusId)!;
                const reason =
                  t.blockedReason ??
                  (t.openBlockers > 0 ? `Waiting on ${t.openBlockers} open task${t.openBlockers === 1 ? "" : "s"}` : null);
                return (
                  <li key={t.id} className="relative flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-hover">
                    <StatusIcon statusKey={s.key} className="mt-[3px]" />
                    <span className="sr-only">{s.label}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link
                        href={`${board}?task=${t.key}`}
                        scroll={false}
                        data-task-link={t.key}
                        className="line-clamp-1 text-body font-medium text-fg outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-focus"
                      >
                        {t.title}
                      </Link>
                      <p className="flex min-w-0 items-center gap-1.5 text-meta text-fg-3">
                        <IssueKey className="shrink-0">{t.key}</IssueKey>
                        {isBlocked(t) && reason && <span className="truncate">· {reason}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5 pt-0.5">
                      {isBlocked(t) && <BlockedBadge />}
                      {t.dueDate && <DueCue due={t.dueDate} today={today} done={false} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-4 xl:col-span-5">
          {team.acceptsRequests && (
            <Panel
              id="triage"
              title="Requests to triage"
              caption={needsTriage.length ? `${needsTriage.length} waiting for a decision` : undefined}
              action={<PanelLink href={`${base}/intake`}>Open intake</PanelLink>}
            >
              {needsTriage.length === 0 ? (
                <p className="py-2 text-body text-fg-3">No requests are waiting.</p>
              ) : (
                <RequestRows rows={needsTriage.slice(0, 4)} perspective="team" timezone={viewer.timezone} today={today} />
              )}
            </Panel>
          )}
          {timeTotals && (
            <Panel id="team-time" title="Team time, last 14 days" caption="Leads only. One team total, never per person.">
              {timeTotals.suppressed || timeTotals.total_seconds == null ? (
                <p className="text-body text-fg-3">Hidden until at least 3 people have logged time in this period.</p>
              ) : (
                <p className="flex items-baseline gap-2">
                  <Figure value={formatDuration(timeTotals.total_seconds)} className="text-[30px] leading-9" />
                  <span className="text-body text-fg-3">logged</span>
                </p>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
