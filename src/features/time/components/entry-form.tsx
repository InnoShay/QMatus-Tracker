"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { ActionResult } from "@/lib/errors";

export type EntryValues = { date: string; start: string; end: string; note: string };

/**
 * Day + start/end wall times in the viewer's profile time zone. An end time
 * earlier than the start means the work ran past midnight.
 */
export function EntryForm({
  initial,
  timezone,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: EntryValues;
  timezone: string;
  submitLabel: string;
  onSubmit: (values: EntryValues) => Promise<ActionResult<unknown>>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof EntryValues) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const overnight = values.start && values.end && values.end <= values.start;

  return (
    <form
      aria-label={submitLabel}
      className="flex flex-col gap-3 rounded-md border border-line bg-subtle p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await onSubmit(values);
          if (!res.ok) setError(res.error.message);
        });
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
        <Field label="Date">{(p) => <Input {...p} type="date" value={values.date} onChange={set("date")} required />}</Field>
        <Field label="From">{(p) => <Input {...p} type="time" value={values.start} onChange={set("start")} required />}</Field>
        <Field label="To">{(p) => <Input {...p} type="time" value={values.end} onChange={set("end")} required />}</Field>
      </div>
      <Field label="Note" optional hint="Only you can see this note.">
        {(p) => <Input {...p} value={values.note} onChange={set("note")} maxLength={500} />}
      </Field>
      <p className="text-meta text-fg-3">
        Times are in {timezone}.{overnight ? " Ends the next day." : ""}
      </p>
      {error && (
        <p role="alert" className="text-label font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" pending={pending} pendingLabel="Saving…">
          {submitLabel}
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
