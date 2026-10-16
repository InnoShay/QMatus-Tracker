import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { MyTimeList, RunningTimer } from "@/features/time/components/my-time";
import { todayIn } from "@/lib/dates";
import { formatDuration } from "@/lib/time";
import { requireViewer } from "@/server/auth/viewer";
import { getActiveTimer, listMyTime, MY_TIME_DAYS } from "@/server/dal/time";

export const metadata: Metadata = { title: "My Time" };

/** The viewer's own time entries. Never shows anyone else's time or any ranking. */
export default async function MyTimePage() {
  const viewer = await requireViewer();
  const [active, { entries, truncated }] = await Promise.all([getActiveTimer(), listMyTime()]);
  const serverNow = new Date().toISOString();
  const total = entries.reduce((s, e) => s + (e.seconds ?? 0), 0);
  const today = todayIn(viewer.timezone);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        title="My Time"
        description="Your timers and logged time. Only you can see these entries and notes — not your team, its leads or workspace admins."
      />
      {active && <RunningTimer active={active} serverNow={serverNow} />}
      {entries.some((e) => e.endedAt) ? (
        <>
          <p className="text-body text-fg-2">
            <span className="tabular font-medium text-fg">{formatDuration(total)}</span> logged in the last {MY_TIME_DAYS} days. Days follow
            your time zone ({viewer.timezone}); an entry counts on the day it started.
          </p>
          <MyTimeList entries={entries} timezone={viewer.timezone} today={today} />
          {truncated && <p className="text-meta text-fg-3">Showing your most recent 500 entries.</p>}
        </>
      ) : (
        !active && (
          <EmptyState
            title="No time logged yet"
            body="Open a task and use Start timer or Log time. Time tracking is optional, and your entries stay private to you."
          />
        )
      )}
    </div>
  );
}
