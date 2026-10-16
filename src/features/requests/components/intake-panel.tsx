"use client";

import { RelativeTime } from "@/components/ui/relative-time";
import { Eye, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { IssueKey, StatusIcon } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { AudienceSeam } from "@/components/ui/layout";
import { Modal } from "@/components/ui/overlays";
import { RichText } from "@/components/ui/rich-text";
import { toast } from "@/components/ui/toast";
import { PRIORITIES } from "@/features/tasks/meta";
import { acceptRequest, addInternalNote, linkTaskByKey, publishUpdate, setTriageOwner, transitionRequest } from "../actions";
import { REQUESTER_LABEL, REQUEST_TRANSITIONS, TEAM_LABEL, type RequestStatus } from "../meta";
import type { RequestInternal } from "@/server/dal/requests";

type Props = {
  requestId: string;
  requestNumber: number;
  status: RequestStatus;
  requestedPriority: string;
  requestedDate: string | null;
  requestTitle: string;
  teamId: string;
  teamSlug: string;
  teamName: string;
  members: { id: string; name: string }[];
  internal: RequestInternal;
  canAct: boolean;
  timezone: string;
};

type Dialog = null | "ask" | "accept" | "decline" | "close" | "reopen" | "progress" | "deliver";

/** Receiving-team controls. Everything here is private to the team, and says so. */
export function IntakePanel(p: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, startTransition] = useTransition();
  const allowed = REQUEST_TRANSITIONS[p.status];

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast(success);
        setDialog(null);
        after?.();
      } else toast(res.error?.message ?? "That didn't work.", "error");
    });

  const simple = (to: RequestStatus, publicSummary = "", reason = "") =>
    run(
      () => transitionRequest({ requestId: p.requestId, expected: p.status, to, publicSummary, reason }),
      `Request is now ${TEAM_LABEL[to].toLowerCase()}.`,
    );

  return (
    <aside aria-label="Intake (team only)" className="flex flex-col gap-5">
      <AudienceSeam audience={`${p.teamName} only`} />

      {p.canAct ? (
        <section aria-labelledby="triage-actions" className="flex flex-col gap-3">
          <h2 id="triage-actions" className="text-section font-semibold text-fg">
            Triage
          </h2>
          <p className="text-label text-fg-2">
            Status: <span className="font-medium text-fg">{TEAM_LABEL[p.status]}</span>
            <span className="text-fg-3"> · requester sees “{REQUESTER_LABEL[p.status]}”</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {allowed.includes("in_triage") && p.status === "submitted" && (
              <Button size="sm" variant="primary" pending={pending} onClick={() => simple("in_triage")}>
                Start triage
              </Button>
            )}
            {allowed.includes("accepted") && p.status !== "in_progress" && (
              <Button size="sm" variant="primary" onClick={() => setDialog("accept")}>
                Accept and plan
              </Button>
            )}
            {allowed.includes("needs_info") && (
              <Button size="sm" onClick={() => setDialog("ask")}>
                Ask for information
              </Button>
            )}
            {p.status === "needs_info" && (
              <Button size="sm" onClick={() => simple("in_triage")} pending={pending}>
                Resume triage
              </Button>
            )}
            {allowed.includes("in_progress") && (
              <Button size="sm" variant="primary" onClick={() => setDialog("progress")}>
                Mark in progress
              </Button>
            )}
            {allowed.includes("delivered") && (
              <Button size="sm" onClick={() => setDialog("deliver")}>
                Mark delivered
              </Button>
            )}
            {allowed.includes("closed") && (
              <Button size="sm" onClick={() => setDialog("close")}>
                Close request
              </Button>
            )}
            {(p.status === "closed" || p.status === "declined") && (
              <Button size="sm" onClick={() => setDialog("reopen")}>
                Reopen
              </Button>
            )}
            {allowed.includes("declined") && (
              <Button size="sm" variant="danger" onClick={() => setDialog("decline")}>
                Decline
              </Button>
            )}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-label font-medium text-fg-2">Triage owner</span>
            <Select
              value={p.internal.triageOwnerId ?? ""}
              onChange={(e) => run(() => setTriageOwner(p.requestId, e.target.value || null), "Triage owner updated.")}
              className="h-8"
            >
              <option value="">No owner yet</option>
              {p.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </label>
        </section>
      ) : (
        <p className="flex items-center gap-2 text-label text-fg-2">
          <Eye className="size-4 text-fg-3" aria-hidden /> You can read the team&apos;s intake notes, but only team members can triage.
        </p>
      )}

      {p.canAct && !["draft", "submitted", "closed", "declined"].includes(p.status) && <PublishUpdate requestId={p.requestId} />}

      <section aria-labelledby="linked-tasks" className="flex flex-col gap-2">
        <h2 id="linked-tasks" className="text-section font-semibold text-fg">
          Linked tasks
        </h2>
        {p.internal.linkedTasks.length === 0 ? (
          <p className="text-body text-fg-3">No tasks linked yet. Accepting the request can create them.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {p.internal.linkedTasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/t/${p.teamSlug}/board?task=${t.key}`}
                  className="flex min-h-9 items-center gap-2.5 px-3 py-1.5 hover:bg-hover"
                >
                  <StatusIcon statusKey={t.statusKey} />
                  <span className="sr-only">{t.statusLabel}</span>
                  <IssueKey>{t.key}</IssueKey>
                  <span className="min-w-0 flex-1 truncate text-body text-fg">{t.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {p.canAct && <LinkTaskForm requestId={p.requestId} teamId={p.teamId} />}
      </section>

      <InternalNotes requestId={p.requestId} notes={p.internal.notes} canWrite={p.canAct} timezone={p.timezone} />

      {/* Dialogs */}
      <TextDialog
        open={dialog === "ask"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Ask the requester for information"
        label="Your question"
        hint="The requester sees this exactly as written."
        required
        confirm="Send question"
        pending={pending}
        onConfirm={(text) => simple("needs_info", text)}
      />
      <TextDialog
        open={dialog === "progress"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Mark as in progress"
        label="Update for the requester"
        optional
        defaultValue="Implementation has started."
        confirm="Mark in progress"
        pending={pending}
        onConfirm={(text) => simple("in_progress", text)}
      />
      <TextDialog
        open={dialog === "deliver"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Mark as delivered"
        label="What was delivered"
        optional
        confirm="Mark delivered"
        pending={pending}
        onConfirm={(text) => simple("delivered", text)}
      />
      <TextDialog
        open={dialog === "close"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Close this request"
        label="Closing note"
        hint="Shown to the requester. The request and its history stay available."
        required
        confirm="Close request"
        pending={pending}
        onConfirm={(text) => simple("closed", "", text)}
      />
      <TextDialog
        open={dialog === "reopen"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Reopen this request"
        label="Why it's being reopened"
        hint="Shown to the requester."
        required
        confirm="Reopen"
        pending={pending}
        onConfirm={(text) => simple("in_triage", text, text)}
      />
      <TextDialog
        open={dialog === "decline"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Decline this request"
        label="Reason, as the requester will read it"
        hint="Be specific and kind. Keep internal reasoning in an internal note."
        required
        danger
        confirm="Decline request"
        pending={pending}
        onConfirm={(text) => simple("declined", "", text)}
      />
      <AcceptDialog {...p} open={dialog === "accept"} onOpenChange={(o) => !o && setDialog(null)} />
    </aside>
  );
}

function TextDialog({
  open,
  onOpenChange,
  title,
  label,
  hint,
  required,
  optional,
  defaultValue = "",
  confirm,
  danger,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  defaultValue?: string;
  confirm: string;
  danger?: boolean;
  pending: boolean;
  onConfirm: (text: string) => void;
}) {
  const [text, setText] = useState(defaultValue);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (required && !text.trim()) return;
          onConfirm(text.trim());
        }}
      >
        <Field label={label} hint={hint} optional={optional}>
          {(f) => <Textarea {...f} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} autoFocus />}
        </Field>
        {text.trim() && <RequesterPreview text={text.trim()} />}
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="submit"
            variant={danger ? "danger" : "primary"}
            disabled={required && !text.trim()}
            pending={pending}
            pendingLabel="Saving…"
          >
            {confirm}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RequesterPreview({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <AudienceSeam audience="The requester will see" tone="shared" />
      <p className="rounded-sm bg-subtle px-3 py-2 text-body text-fg [overflow-wrap:anywhere]">{text}</p>
    </div>
  );
}

function AcceptDialog(p: Props & { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [priority, setPriority] = useState(p.requestedPriority === "none" ? "medium" : p.requestedPriority);
  const [date, setDate] = useState(p.requestedDate ?? "");
  const [summary, setSummary] = useState("Accepted. We've planned this and will share progress here.");
  const [tasks, setTasks] = useState([{ title: p.requestTitle.slice(0, 200), assigneeId: "" }]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await acceptRequest({
        requestId: p.requestId,
        expected: p.status,
        committedPriority: priority as never,
        committedDate: date,
        publicSummary: summary,
        tasks: tasks.filter((t) => t.title.trim()),
      });
      if (res.ok) {
        toast(
          `Accepted REQ-${p.requestNumber}${res.data.created ? ` and created ${res.data.created} private task${res.data.created === 1 ? "" : "s"}` : ""}.`,
        );
        p.onOpenChange(false);
      } else setError(res.error.message);
    });
  };

  return (
    <Modal
      open={p.open}
      onOpenChange={p.onOpenChange}
      title={`Accept REQ-${p.requestNumber}`}
      description="Commit to a priority and date, and create the private tasks your team will work from."
      className="max-w-xl"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Committed priority">
            {(f) => (
              <Select {...f} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Committed date" optional hint={p.requestedDate ? `Requested: ${p.requestedDate}` : "No date was requested."}>
            {(f) => <Input {...f} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        </div>
        <Field label="Message to the requester">
          {(f) => <Textarea {...f} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={2000} />}
        </Field>
        {summary.trim() && <RequesterPreview text={summary.trim()} />}

        <fieldset className="flex flex-col gap-2">
          <AudienceSeam audience={`Private tasks · ${p.teamName} only`} />
          <legend className="sr-only">Private tasks to create</legend>
          {tasks.map((t, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor={`accept-task-${i}`}>
                Task {i + 1} title
              </label>
              <Input
                id={`accept-task-${i}`}
                value={t.title}
                maxLength={200}
                placeholder="Task title"
                onChange={(e) => setTasks((all) => all.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              />
              <label className="sr-only" htmlFor={`accept-assignee-${i}`}>
                Task {i + 1} assignee
              </label>
              <Select
                id={`accept-assignee-${i}`}
                value={t.assigneeId}
                onChange={(e) => setTasks((all) => all.map((x, j) => (j === i ? { ...x, assigneeId: e.target.value } : x)))}
                className="sm:w-44"
              >
                <option value="">Unassigned</option>
                {p.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
              {tasks.length > 1 && (
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => setTasks((all) => all.filter((_, j) => j !== i))}
                  aria-label={`Remove task ${i + 1}`}
                  className="self-start sm:self-center"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </div>
          ))}
          {tasks.length < 20 && (
            <Button
              size="sm"
              variant="quiet"
              className="self-start"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => setTasks((all) => [...all, { title: "", assigneeId: "" }])}
            >
              Add another task
            </Button>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-body text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button onClick={() => p.onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" pending={pending} pendingLabel="Accepting…" disabled={!summary.trim()}>
            Accept request
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PublishUpdate({ requestId }: { requestId: string }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <section aria-labelledby="publish-update" className="flex flex-col gap-2">
      <h2 id="publish-update" className="text-section font-semibold text-fg">
        Publish a progress update
      </h2>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await publishUpdate(requestId, text);
            if (res.ok) {
              setText("");
              toast("Update published to the requester.");
            } else toast(res.error.message, "error");
          });
        }}
      >
        <label htmlFor="update-text" className="sr-only">
          Update text
        </label>
        <Textarea
          id="update-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="What's changed, in words the requester will understand"
        />
        {text.trim() && <RequesterPreview text={text.trim()} />}
        <Button
          type="submit"
          size="sm"
          variant="primary"
          disabled={!text.trim()}
          pending={pending}
          pendingLabel="Publishing…"
          className="self-start"
        >
          Publish update
        </Button>
      </form>
    </section>
  );
}

function LinkTaskForm({ requestId, teamId }: { requestId: string; teamId: string }) {
  const [key, setKey] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await linkTaskByKey(requestId, teamId, key);
          if (res.ok) {
            setKey("");
            toast("Task linked.");
          } else toast(res.error.message, "error");
        });
      }}
    >
      <label htmlFor="link-task" className="sr-only">
        Link an existing task by key
      </label>
      <Input
        id="link-task"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Link existing task, e.g. DEV-12"
        className="h-8 font-mono"
        maxLength={15}
      />
      <Button type="submit" size="sm" disabled={!key.trim()} pending={pending}>
        Link
      </Button>
    </form>
  );
}

function InternalNotes({
  requestId,
  notes,
  canWrite,
  timezone,
}: {
  requestId: string;
  notes: RequestInternal["notes"];
  canWrite: boolean;
  timezone: string;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <section aria-labelledby="internal-notes" className="flex flex-col gap-3">
      <h2 id="internal-notes" className="text-section font-semibold text-fg">
        Internal notes
      </h2>
      {notes.length === 0 && <p className="text-body text-fg-3">No internal notes yet.</p>}
      <ul className="flex flex-col gap-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-md border border-line bg-subtle px-3 py-2">
            <p className="text-label text-fg-2">
              <span className="font-medium text-fg">{n.authorName}</span> ·{" "}
              <span className="text-fg-3">
                <RelativeTime iso={n.createdAt} timeZone={timezone} />
              </span>
            </p>
            <RichText text={n.body} className="mt-1" />
          </li>
        ))}
      </ul>
      {canWrite && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await addInternalNote(requestId, text);
              if (res.ok) setText("");
              else toast(res.error.message, "error");
            });
          }}
        >
          <label htmlFor="internal-note" className="sr-only">
            Internal note, visible to your team only
          </label>
          <Textarea
            id="internal-note"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={5000}
            placeholder="Note for your team only"
          />
          <Button type="submit" size="sm" disabled={!text.trim()} pending={pending} className="self-start">
            Add note
          </Button>
        </form>
      )}
    </section>
  );
}
