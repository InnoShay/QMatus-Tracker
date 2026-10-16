"use client";

import { Clock, Play, Plus, Square } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AudienceSeam } from "@/components/ui/layout";
import { toast } from "@/components/ui/toast";
import { formatDuration, utcToZoned } from "@/lib/time";
import { addTimeEntry, startTimer, stopTimer } from "../actions";
import type { TaskTime } from "../types";
import { Elapsed } from "./elapsed";
import { EntryForm, type EntryValues } from "./entry-form";

/**
 * The viewer's own timer and logged time for one task. Private to the viewer:
 * no one else's time, no team totals and no activity metrics appear here.
 * Every state change waits for the server; elapsed time comes from its timestamp.
 */
export function TaskTimer({
  taskId,
  taskKey,
  time,
  canLog,
  timezone,
}: {
  taskId: string;
  taskKey: string;
  time: TaskTime;
  canLog: boolean;
  timezone: string;
}) {
  const [pending, startTransition] = useTransition();
  const [logging, setLogging] = useState<{ requestId: string; initial: EntryValues } | null>(null);
  const runningHere = time.active?.taskId === taskId ? time.active : null;
  const elsewhere = time.active && !runningHere ? time.active : null;

  if (!canLog && time.mySeconds === 0 && !runningHere) return null;

  const start = () =>
    startTransition(async () => {
      const res = await startTimer(taskId);
      toast(res.ok ? `Timer started on ${taskKey}.` : res.error.message, res.ok ? "success" : "error");
    });
  const stop = () =>
    startTransition(async () => {
      const res = await stopTimer(runningHere?.id);
      toast(
        res.ok ? `Timer stopped${res.data.seconds != null ? ` · ${formatDuration(res.data.seconds)}` : ""}.` : res.error.message,
        res.ok ? "success" : "error",
      );
    });
  const openLog = () => {
    const now = Date.now();
    const to = utcToZoned(new Date(now).toISOString(), timezone);
    const from = utcToZoned(new Date(now - 3_600_000).toISOString(), timezone);
    setLogging({ requestId: crypto.randomUUID(), initial: { date: from.date, start: from.time, end: to.time, note: "" } });
  };

  return (
    <section aria-labelledby="your-time" className="flex flex-col gap-2">
      <h3 id="your-time" className="text-label font-semibold text-fg">
        Your time
      </h3>
      <AudienceSeam audience="Only you" />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {runningHere ? (
          <>
            <Button
              size="sm"
              variant="primary"
              icon={<Square className="size-3.5" aria-hidden />}
              onClick={stop}
              pending={pending}
              pendingLabel="Stopping…"
            >
              Stop timer
            </Button>
            <span className="inline-flex items-center gap-1.5 text-body text-fg">
              <span className="size-2 rounded-full bg-success" aria-hidden />
              <span className="sr-only">Running for</span>
              <Elapsed startedAt={runningHere.startedAt} serverNow={time.serverNow} className="tabular font-medium" />
            </span>
          </>
        ) : (
          canLog && (
            <Button size="sm" icon={<Play className="size-3.5" aria-hidden />} onClick={start} pending={pending} pendingLabel="Starting…">
              Start timer
            </Button>
          )
        )}
        {canLog && !logging && (
          <Button size="sm" variant="quiet" icon={<Plus className="size-3.5" aria-hidden />} onClick={openLog}>
            Log time
          </Button>
        )}
        <span className="inline-flex items-center gap-1.5 text-label text-fg-2">
          <Clock className="size-3.5 text-fg-3" aria-hidden />
          <span className="tabular" data-testid="my-task-total">
            {formatDuration(time.mySeconds)}
          </span>{" "}
          logged by you
        </span>
      </div>
      {elsewhere && canLog && (
        <p className="text-meta text-fg-3">
          Your timer is running on{" "}
          {elsewhere.taskKey && elsewhere.teamSlug ? (
            <Link href={`/t/${elsewhere.teamSlug}/tasks/${elsewhere.taskKey}`} className="text-accent hover:text-accent-hover">
              {elsewhere.taskKey}
            </Link>
          ) : (
            "another task"
          )}
          . Starting it here stops that one.
        </p>
      )}
      {logging && (
        <EntryForm
          initial={logging.initial}
          timezone={timezone}
          submitLabel="Save time"
          onCancel={() => setLogging(null)}
          onSubmit={async (v) => {
            const res = await addTimeEntry({ taskId, ...v, requestId: logging.requestId });
            if (res.ok) {
              setLogging(null);
              toast("Time logged.");
            }
            return res;
          }}
        />
      )}
      <Link href="/my-time" className="self-start text-meta font-medium text-accent hover:text-accent-hover">
        See all your time
      </Link>
    </section>
  );
}
