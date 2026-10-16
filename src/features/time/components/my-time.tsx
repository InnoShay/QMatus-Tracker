"use client";

import { Ellipsis, Pencil, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { IssueKey } from "@/components/ui/badges";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { addDays } from "@/lib/dates";
import { formatDuration, LONG_ENTRY_SECONDS, utcToZoned } from "@/lib/time";
import { correctTimeEntry, deleteTimeEntry, stopTimer } from "../actions";
import type { ActiveTimer, MyTimeEntry } from "../types";
import { Elapsed } from "./elapsed";
import { EntryForm } from "./entry-form";

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

const STOP_NOTE: Partial<Record<NonNullable<MyTimeEntry["stopReason"]>, string>> = {
  switched: "Stopped when you started another timer",
  access_lost: "Stopped automatically: your access to this task ended",
  suspended: "Stopped automatically: your account was suspended",
  task_archived: "Stopped automatically: the task was archived",
};

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return DAY.format(new Date(`${date}T00:00:00Z`));
}

export function RunningTimer({ active, serverNow }: { active: ActiveTimer; serverNow: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <section
      aria-label="Running timer"
      className="flex flex-wrap items-center gap-3 rounded-md border border-line-strong bg-surface px-4 py-3"
    >
      <span className="size-2 rounded-full bg-success" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-label text-fg-3">Timer running</p>
        <p className="truncate text-body text-fg">
          {active.taskKey && active.teamSlug ? (
            <Link href={`/t/${active.teamSlug}/tasks/${active.taskKey}`} className="hover:text-accent">
              <IssueKey>{active.taskKey}</IssueKey> {active.taskTitle}
            </Link>
          ) : (
            "Task no longer available"
          )}
        </p>
      </div>
      <Elapsed startedAt={active.startedAt} serverNow={serverNow} className="tabular text-section font-semibold text-fg" />
      <Button
        size="sm"
        variant="primary"
        icon={<Square className="size-3.5" aria-hidden />}
        pending={pending}
        pendingLabel="Stopping…"
        onClick={() =>
          startTransition(async () => {
            const res = await stopTimer(active.id);
            toast(res.ok ? "Timer stopped." : res.error.message, res.ok ? "success" : "error");
          })
        }
      >
        Stop timer
      </Button>
    </section>
  );
}

export function MyTimeList({ entries, timezone, today }: { entries: MyTimeEntry[]; timezone: string; today: string }) {
  const finished = entries.filter((e) => e.endedAt);
  const days = new Map<string, MyTimeEntry[]>();
  for (const e of finished) {
    const day = utcToZoned(e.startedAt, timezone).date;
    days.set(day, [...(days.get(day) ?? []), e]);
  }

  return (
    <div className="flex flex-col gap-6">
      {[...days.entries()].map(([day, list]) => {
        const total = list.reduce((s, e) => s + (e.seconds ?? 0), 0);
        return (
          <section key={day} aria-labelledby={`day-${day}`} className="flex flex-col gap-2">
            <h2 id={`day-${day}`} className="flex items-baseline justify-between text-label font-semibold text-fg">
              <span>{dayLabel(day, today)}</span>
              <span className="tabular font-normal text-fg-2">{formatDuration(total)}</span>
            </h2>
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
              {list.map((e) => (
                <EntryRow key={e.id} entry={e} timezone={timezone} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function EntryRow({ entry: e, timezone }: { entry: MyTimeEntry; timezone: string }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();
  const from = utcToZoned(e.startedAt, timezone);
  const to = utcToZoned(e.endedAt!, timezone);
  const available = !!(e.taskKey && e.teamSlug);
  const stopNote = e.stopReason ? STOP_NOTE[e.stopReason] : undefined;

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5" data-testid="time-entry">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body text-fg">
            {available ? (
              <Link href={`/t/${e.teamSlug}/tasks/${e.taskKey}`} className="hover:text-accent">
                <IssueKey>{e.taskKey}</IssueKey> {e.taskTitle}
              </Link>
            ) : (
              <span className="text-fg-3">Task no longer available</span>
            )}
          </p>
          <p className="flex flex-wrap gap-x-2 text-meta text-fg-3">
            <span className="tabular">
              {from.time}–{to.time}
              {to.date !== from.date ? " (next day)" : ""}
            </span>
            {e.source === "manual" && <span>· Logged manually</span>}
            {e.corrected && <span>· Corrected</span>}
            {stopNote && <span>· {stopNote}</span>}
          </p>
        </div>
        <span className="tabular shrink-0 text-body font-medium text-fg">{formatDuration(e.seconds ?? 0)}</span>
        {available && (
          <Menu>
            <MenuTrigger asChild>
              <IconButton label={`Actions for ${e.taskKey} entry at ${from.time}`} size="sm">
                <Ellipsis className="size-4" aria-hidden />
              </IconButton>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => setEditing(true)}>
                <Pencil className="size-4 text-fg-3" aria-hidden /> Correct
              </MenuItem>
              <MenuItem danger onSelect={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden /> Delete
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
      {e.note && <p className="text-label text-fg-2">{e.note}</p>}
      {(e.seconds ?? 0) > LONG_ENTRY_SECONDS && (
        <p className="text-meta font-medium text-warning">Longer than 12 hours. Check that it’s right, and correct it if not.</p>
      )}
      {editing && (
        <EntryForm
          initial={{ date: from.date, start: from.time, end: to.time, note: e.note ?? "" }}
          timezone={timezone}
          submitLabel="Save correction"
          onCancel={() => setEditing(false)}
          onSubmit={async (v) => {
            const res = await correctTimeEntry({ entryId: e.id, version: e.version, ...v });
            if (res.ok) {
              setEditing(false);
              toast("Entry corrected. The previous times are kept in its history.");
            }
            return res;
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this time entry?"
        consequence={`${formatDuration(e.seconds ?? 0)} on ${e.taskKey ?? "this task"} will no longer count toward your totals.`}
        confirmLabel="Delete"
        danger
        onConfirm={() =>
          startTransition(async () => {
            const res = await deleteTimeEntry(e.id, e.version);
            setConfirmDelete(false);
            toast(res.ok ? "Entry deleted." : res.error.message, res.ok ? "success" : "error");
          })
        }
      />
    </li>
  );
}
