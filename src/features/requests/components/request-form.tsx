"use client";

import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { PRIORITIES } from "@/features/tasks/meta";
import { submitRequest } from "../actions";

type Props = {
  intakeTeams: { id: string; name: string }[];
  sourceTeams: { id: string; name: string }[];
  people: { id: string; name: string; title: string | null }[];
  viewerId: string;
  defaults?: { title?: string; problem?: string; targetTeamId?: string; sourceTeamId?: string };
  onSubmitted?: (id: string) => void;
};

export function RequestForm({ intakeTeams, sourceTeams, people, viewerId, defaults, onSubmitted }: Props) {
  const router = useRouter();
  // One key per form instance makes a double-submit return the same request.
  const [clientKey] = useState(() => crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"submit" | "draft">("submit");
  const today = new Date().toISOString().slice(0, 10);

  if (intakeTeams.length === 0) {
    return (
      <p className="rounded-md border border-line bg-subtle px-4 py-3 text-body text-fg-2">
        No team is accepting work requests right now. Ask a workspace admin which team to contact.
      </p>
    );
  }

  const onSubmit = (form: FormData) => {
    setErrors({});
    setFormError(null);
    const asDraft = mode === "draft";
    startTransition(async () => {
      const res = await submitRequest({
        clientKey,
        targetTeamId: String(form.get("targetTeamId") ?? ""),
        sourceTeamId: String(form.get("sourceTeamId") ?? ""),
        title: String(form.get("title") ?? ""),
        problem: String(form.get("problem") ?? ""),
        outcome: String(form.get("outcome") ?? ""),
        acceptanceCriteria: String(form.get("acceptanceCriteria") ?? ""),
        links: String(form.get("links") ?? ""),
        requestedPriority: String(form.get("requestedPriority") ?? "none") as never,
        requestedDate: String(form.get("requestedDate") ?? ""),
        audience: form.getAll("audience").map(String),
        asDraft,
      });
      if (!res.ok) {
        setErrors(res.error.fieldErrors ?? {});
        setFormError(res.error.fieldErrors ? "Some fields need attention." : res.error.message);
        return;
      }
      toast(asDraft ? "Draft saved. Only you can see it." : "Request submitted. The receiving team will triage it.");
      if (onSubmitted) onSubmitted(res.data.id);
      else router.push(`/requests/${res.data.id}`);
    });
  };

  return (
    <form action={onSubmit} className="flex max-w-[680px] flex-col gap-5" noValidate>
      <div className="flex gap-3 rounded-md border border-line bg-subtle px-4 py-3 text-body text-fg-2">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <p>
          A request isn&apos;t a commitment yet. The receiving team reviews it, may ask questions, and then confirms the actual priority and
          date. You&apos;ll see the updates they publish here, not their internal board.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Send to" error={errors.targetTeamId}>
          {(p) => (
            <Select {...p} name="targetTeamId" defaultValue={defaults?.targetTeamId ?? intakeTeams[0].id}>
              {intakeTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="On behalf of" optional error={errors.sourceTeamId}>
          {(p) => (
            <Select {...p} name="sourceTeamId" defaultValue={defaults?.sourceTeamId ?? sourceTeams[0]?.id ?? ""}>
              <option value="">Just me</option>
              {sourceTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label="Title" error={errors.title}>
        {(p) => (
          <Input
            {...p}
            name="title"
            maxLength={160}
            defaultValue={defaults?.title}
            placeholder="Customers can export their tasks to CSV"
            required
          />
        )}
      </Field>
      <Field label="Problem or background" error={errors.problem}>
        {(p) => (
          <Textarea
            {...p}
            name="problem"
            rows={4}
            maxLength={5000}
            defaultValue={defaults?.problem}
            placeholder="What's happening today, and who is affected?"
          />
        )}
      </Field>
      <Field label="Desired outcome and why it matters" error={errors.outcome}>
        {(p) => <Textarea {...p} name="outcome" rows={3} maxLength={3000} placeholder="What should be possible afterwards?" />}
      </Field>
      <Field
        label="How we'll know it's done"
        optional
        hint="Acceptance criteria. One per line works well."
        error={errors.acceptanceCriteria}
      >
        {(p) => (
          <Textarea
            {...p}
            name="acceptanceCriteria"
            rows={3}
            maxLength={3000}
            placeholder={"- Export includes status and dates\n- Works for large workspaces"}
          />
        )}
      </Field>
      <Field label="Links" optional hint="Shared documents or references, one per line. Only http(s) links." error={errors.links}>
        {(p) => <Textarea {...p} name="links" rows={2} maxLength={2000} placeholder="https://" />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Requested priority" hint="Your suggestion. The team sets the committed priority.">
          {(p) => (
            <Select {...p} name="requestedPriority" defaultValue="medium">
              {PRIORITIES.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Requested by" optional hint="When you'd like it. Not a promised date." error={errors.requestedDate}>
          {(p) => <Input {...p} type="date" name="requestedDate" min={today} />}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label font-medium text-fg-2">Who else should follow this request?</legend>
        <p className="text-meta text-fg-3">
          They&apos;ll see the request, its published updates and the shared discussion. You&apos;re always included.
        </p>
        <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border border-line p-2 sm:grid-cols-2">
          {people
            .filter((p) => p.id !== viewerId)
            .map((p) => (
              <label key={p.id} className="flex min-h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-body hover:bg-hover">
                <input type="checkbox" name="audience" value={p.id} className="size-4 accent-[var(--accent)]" />
                <span className="truncate">{p.name}</span>
                {p.title && <span className="truncate text-meta text-fg-3">{p.title}</span>}
              </label>
            ))}
        </div>
      </fieldset>

      {formError && (
        <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-body text-danger">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button
          type="submit"
          variant="primary"
          pending={pending && mode === "submit"}
          pendingLabel="Submitting…"
          onClick={() => setMode("submit")}
        >
          Submit request
        </Button>
        <Button type="submit" pending={pending && mode === "draft"} pendingLabel="Saving…" onClick={() => setMode("draft")}>
          Save as draft
        </Button>
      </div>
    </form>
  );
}
