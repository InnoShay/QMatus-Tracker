"use client";

import { RelativeTime } from "@/components/ui/relative-time";
import { Archive, ArchiveRestore, EyeOff, Ellipsis, ExternalLink, Link2, Plus, Send, Tag, Trash2, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { useState, useTransition, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { BlockedBadge, IssueKey, PriorityMark, StatusBadge, StatusIcon } from "@/components/ui/badges";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Input, Select, Textarea } from "@/components/ui/field";
import { AudienceSeam } from "@/components/ui/layout";
import { ConfirmDialog, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlays";
import { RichText } from "@/components/ui/rich-text";
import { toast } from "@/components/ui/toast";
import { TaskTimer } from "@/features/time/components/task-timer";
import { formatDateLong, formatTimestamp } from "@/lib/dates";
import {
  addChecklistItem,
  addComment,
  addDependency,
  createLabel,
  createTask,
  deleteChecklistItem,
  deleteComment,
  editComment,
  moveTask,
  removeDependency,
  setArchived,
  setTaskLabels,
  toggleChecklistItem,
  updateTask,
} from "../actions";
import { PRIORITIES, TYPES, priorityLabel, typeLabel } from "../meta";
import type { UpdateTaskInput } from "../schemas";
import type { TaskDependency, TaskDetail, TeamWorkspace } from "../types";
import { DueCue } from "./task-card";

type Props = {
  task: TaskDetail;
  workspace: TeamWorkspace;
  teamSlug: string;
  teamName: string;
  canWrite: boolean;
  canComment: boolean;
  viewerId: string;
  timezone: string;
  today: string;
  closeSlot?: ReactNode;
  fullPageHref?: string;
};

export function TaskDetailView({
  task,
  workspace,
  teamSlug,
  teamName,
  canWrite,
  canComment,
  viewerId,
  timezone,
  today,
  closeSlot,
  fullPageHref,
}: Props) {
  const router = useRouter();
  // Local version advances after our own writes; fresh props may advance it too.
  const [localVersion, setVersion] = useState(task.version);
  const version = Math.max(localVersion, task.version);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [, startTransition] = useTransition();
  const [confirmArchive, setConfirmArchive] = useState(false);

  const status = workspace.statuses.find((s) => s.id === task.statusId)!;
  const allowed = workspace.statuses.filter((s) => workspace.transitions.some((t) => t.from === task.statusId && t.to === s.id));
  const memberName = (id: string | null) => (id ? (workspace.members.find((m) => m.id === id)?.name ?? "Former member") : null);
  const project = workspace.projects.find((p) => p.id === task.projectId);
  const done = status.category === "completed" || status.category === "canceled";
  const archived = !!task.archivedAt;
  const editable = canWrite && !archived;

  const save = (patch: UpdateTaskInput, success?: string) => {
    setSaveState("saving");
    startTransition(async () => {
      const res = await updateTask(task.id, version, patch);
      if (res.ok) {
        setVersion(res.data.version);
        setSaveState("saved");
        if (success) toast(success);
      } else {
        setSaveState("idle");
        toast(res.error.message, "error");
        if (res.error.code === "conflict") router.refresh();
      }
    });
  };

  const changeStatus = (statusId: string) => {
    if (statusId === task.statusId) return;
    setSaveState("saving");
    startTransition(async () => {
      const res = await moveTask({ taskId: task.id, statusId, version });
      if (res.ok) {
        setVersion(res.data.version);
        setSaveState("saved");
        toast(`${task.key} moved to ${workspace.statuses.find((s) => s.id === statusId)?.label}.`);
      } else {
        setSaveState("idle");
        toast(res.error.message, "error");
        if (res.error.code === "conflict") router.refresh();
      }
    });
  };

  const doArchive = () => {
    startTransition(async () => {
      const res = await setArchived(task.id, version, !archived);
      setConfirmArchive(false);
      toast(
        res.ok ? (archived ? `${task.key} restored.` : `${task.key} archived. You can restore it from this page.`) : res.error.message,
        res.ok ? "success" : "error",
      );
    });
  };

  const taskUrl = fullPageHref ?? `/t/${teamSlug}/tasks/${task.key}`;
  // In the panel, related tasks open in place; on the full page they open as pages.
  const relatedHref = (key: string) => (fullPageHref ? `?task=${key}` : `/t/${teamSlug}/tasks/${key}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 1. Top row: key, status, save state, actions, close */}
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <IssueKey className="text-label">{task.key}</IssueKey>
        {editable ? (
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Status</span>
            <StatusIcon statusKey={status.key} />
            <Select
              value={task.statusId}
              onChange={(e) => changeStatus(e.target.value)}
              className="h-7 w-auto border-line-strong pr-8 pl-2 text-label pointer-coarse:h-9"
            >
              <option value={status.id}>{status.label}</option>
              {allowed.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <StatusBadge statusKey={status.key} label={status.label} />
        )}
        <span role="status" className="text-meta text-fg-3">
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="More actions">
                <Ellipsis className="size-4" aria-hidden />
              </IconButton>
            </MenuTrigger>
            <MenuContent>
              <MenuItem
                onSelect={() =>
                  navigator.clipboard?.writeText(new URL(taskUrl, window.location.origin).toString()).then(
                    () => toast("Link copied."),
                    () => toast("Couldn't copy the link.", "error"),
                  )
                }
              >
                <Link2 className="size-4 text-fg-3" aria-hidden /> Copy link
              </MenuItem>
              {fullPageHref && (
                <MenuItem asChild>
                  <Link href={fullPageHref}>
                    <ExternalLink className="size-4 text-fg-3" aria-hidden /> Open as page
                  </Link>
                </MenuItem>
              )}
              {canWrite && (
                <>
                  <MenuSeparator />
                  <MenuItem onSelect={() => setConfirmArchive(true)}>
                    {archived ? (
                      <ArchiveRestore className="size-4 text-fg-3" aria-hidden />
                    ) : (
                      <Archive className="size-4 text-fg-3" aria-hidden />
                    )}
                    {archived ? "Restore task" : "Archive task"}
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
          {closeSlot}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-6 px-5 py-5">
          {archived && (
            <p role="status" className="flex items-center gap-2 rounded-sm bg-warning-bg px-3 py-2 text-body text-warning">
              <Archive className="size-4" aria-hidden /> This task is archived. It’s hidden from the board and list until restored.
            </p>
          )}
          {task.parent && (
            <p className="text-label text-fg-3">
              Subtask of{" "}
              <Link href={relatedHref(task.parent.key)} scroll={false} className="text-accent hover:text-accent-hover">
                {task.parent.key} {task.parent.title}
              </Link>
            </p>
          )}

          {/* 2. Title and description */}
          <TitleEditor value={task.title} editable={editable} onSave={(title) => save({ title })} />
          <DescriptionEditor
            value={task.description}
            editable={editable}
            onSave={(description) => save({ description }, "Description saved.")}
          />

          {/* 3. Key fields */}
          <dl className="grid grid-cols-[minmax(96px,auto)_1fr] items-center gap-x-4 gap-y-2.5 text-body">
            <Prop label="Assignee">
              {editable ? (
                <Select
                  aria-label="Assignee"
                  value={task.assigneeId ?? ""}
                  onChange={(e) => save({ assigneeId: e.target.value || null })}
                  className="h-8 pointer-coarse:h-10"
                >
                  <option value="">Unassigned</option>
                  {workspace.members
                    .filter((m) => m.active || m.id === task.assigneeId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.id === viewerId ? " (you)" : ""}
                        {!m.active ? " (no longer on team)" : ""}
                      </option>
                    ))}
                </Select>
              ) : (
                <span className="inline-flex items-center gap-2">
                  {task.assigneeId && <Avatar name={memberName(task.assigneeId)} size="sm" />}
                  {memberName(task.assigneeId) ?? <span className="text-fg-3">Unassigned</span>}
                </span>
              )}
            </Prop>
            <Prop label="Reviewer">
              {editable ? (
                <Select
                  aria-label="Reviewer"
                  value={task.reviewerId ?? ""}
                  onChange={(e) => save({ reviewerId: e.target.value || null }, "Reviewer updated.")}
                  className="h-8 pointer-coarse:h-10"
                >
                  <option value="">No reviewer</option>
                  {workspace.members
                    .filter((m) => (m.active && m.id !== task.assigneeId) || m.id === task.reviewerId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.id === viewerId ? " (you)" : ""}
                      </option>
                    ))}
                </Select>
              ) : (
                <span>{memberName(task.reviewerId) ?? <span className="text-fg-3">None</span>}</span>
              )}
            </Prop>
            <Prop label="Priority">
              {editable ? (
                <Select
                  aria-label="Priority"
                  value={task.priority}
                  onChange={(e) => save({ priority: e.target.value as never })}
                  className="h-8 pointer-coarse:h-10"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <PriorityMark priority={task.priority} withLabel />
              )}
            </Prop>
            <Prop label="Due date">
              {editable ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    aria-label="Due date"
                    defaultValue={task.dueDate ?? ""}
                    key={task.dueDate ?? "none"}
                    onBlur={(e) => e.target.value !== (task.dueDate ?? "") && save({ dueDate: e.target.value || null })}
                    className="h-8 w-44 pointer-coarse:h-10"
                  />
                  {task.dueDate && <DueCue due={task.dueDate} today={today} done={done} />}
                </div>
              ) : task.dueDate ? (
                <span>{formatDateLong(task.dueDate)}</span>
              ) : (
                <span className="text-fg-3">None</span>
              )}
            </Prop>
            <Prop label="Type">
              {editable ? (
                <Select
                  aria-label="Type"
                  value={task.type}
                  onChange={(e) => save({ type: e.target.value as never })}
                  className="h-8 pointer-coarse:h-10"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <span>{typeLabel(task.type)}</span>
              )}
            </Prop>
            <Prop label="Project">
              {editable ? (
                <Select
                  aria-label="Project"
                  value={task.projectId ?? ""}
                  onChange={(e) => save({ projectId: e.target.value || null })}
                  className="h-8 pointer-coarse:h-10"
                >
                  <option value="">No project</option>
                  {workspace.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              ) : project ? (
                <Link href={`/t/${teamSlug}/projects/${project.id}`} className="text-accent hover:text-accent-hover">
                  {project.name}
                </Link>
              ) : (
                <span className="text-fg-3">None</span>
              )}
            </Prop>
            {project && (project.milestones.length > 0 || task.milestoneId) && (
              <Prop label="Milestone">
                {editable ? (
                  <Select
                    aria-label="Milestone"
                    value={task.milestoneId ?? ""}
                    onChange={(e) => save({ projectId: task.projectId, milestoneId: e.target.value || null })}
                    className="h-8 pointer-coarse:h-10"
                  >
                    <option value="">No milestone</option>
                    {project.milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <span>{project.milestones.find((m) => m.id === task.milestoneId)?.name ?? "None"}</span>
                )}
              </Prop>
            )}
            <Prop label="Labels">
              <LabelPicker task={task} workspace={workspace} teamSlug={teamSlug} editable={editable} />
            </Prop>
            <Prop label="Created">
              <span className="text-fg-2">
                {task.creatorName ?? "Someone"} · <time dateTime={task.createdAt}>{formatTimestamp(task.createdAt, timezone)}</time>
              </span>
            </Prop>
          </dl>

          <BlockerEditor
            task={task}
            editable={editable}
            onSave={(blocked, blockedReason) => save({ blocked, blockedReason }, blocked ? "Marked as blocked." : "Blocker cleared.")}
          />

          <Dependencies task={task} teamSlug={teamSlug} editable={editable} hrefFor={relatedHref} />

          {/* Personal time: the viewer's own timer and entries only */}
          <TaskTimer taskId={task.id} taskKey={task.key} time={task.time} canLog={editable} timezone={timezone} />

          {/* 4. Checklist and subtasks */}
          <Checklist task={task} editable={editable} />
          <Subtasks task={task} workspace={workspace} teamSlug={teamSlug} editable={editable && !task.parentId} hrefFor={relatedHref} />

          {task.linkedRequests.length > 0 && (
            <section aria-labelledby="linked-requests" className="flex flex-col gap-2">
              <h3 id="linked-requests" className="text-label font-semibold text-fg">
                Linked work request
              </h3>
              {task.linkedRequests.map((r) => (
                <Link
                  key={r.id}
                  href={`/requests/${r.id}`}
                  className="flex items-center gap-2 rounded-sm border border-line px-3 py-2 hover:bg-hover"
                >
                  <Send className="size-4 text-fg-3" aria-hidden />
                  <IssueKey>REQ-{r.number}</IssueKey>
                  <span className="min-w-0 flex-1 truncate text-body text-fg">{r.title}</span>
                </Link>
              ))}
              <p className="text-meta text-fg-3">The requester sees only updates your team publishes on the request, never this task.</p>
            </section>
          )}

          {/* 5. Discussion — private to the team, stated explicitly */}
          <section aria-labelledby="discussion" className="flex flex-col gap-3">
            <h3 id="discussion" className="text-label font-semibold text-fg">
              Discussion
            </h3>
            <AudienceSeam audience={`${teamName} only`} />
            <Comments task={task} teamSlug={teamSlug} canComment={canComment && !archived} viewerId={viewerId} timezone={timezone} />
          </section>

          {/* 6. Activity */}
          <section aria-labelledby="activity" className="flex flex-col gap-2 pb-4">
            <h3 id="activity" className="text-label font-semibold text-fg">
              Activity
            </h3>
            <ol className="flex flex-col gap-2 border-l border-line pl-3">
              {task.activity.map((a) => (
                <li key={a.id} className="text-label text-fg-2">
                  <span className="font-medium text-fg">{a.actorName ?? "System"}</span>{" "}
                  {describeActivity(a.event, a.data, memberName, a.relatedKey)}{" "}
                  <time dateTime={a.createdAt} title={formatTimestamp(a.createdAt, timezone)} className="text-fg-3">
                    · <RelativeTime iso={a.createdAt} timeZone={timezone} />
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={archived ? `Restore ${task.key}?` : `Archive ${task.key}?`}
        consequence={
          archived
            ? "It will reappear on the board and list in its current status."
            : "It will be hidden from the board, list and My Work. Its history is kept, and you can restore it at any time."
        }
        confirmLabel={archived ? "Restore" : "Archive"}
        danger={!archived}
        onConfirm={doArchive}
      />
    </div>
  );
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-label text-fg-3">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function TitleEditor({ value, editable, onSave }: { value: string; editable: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setDraft(value);
  }
  if (!editable) return <h2 className="text-[18px] leading-6 font-semibold text-fg [overflow-wrap:anywhere]">{value}</h2>;
  const commit = () => {
    const v = draft.trim();
    if (!v) return setDraft(value);
    if (v !== value) onSave(v);
  };
  return (
    <div>
      <label htmlFor="task-title" className="sr-only">
        Title
      </label>
      <textarea
        id="task-title"
        value={draft}
        rows={1}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value.replace(/\n/g, " "))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
          if (e.key === "Escape") setDraft(value);
        }}
        className="field-sizing-content w-full resize-none rounded-sm border border-transparent bg-transparent px-1.5 py-1 -mx-1.5 text-[18px] leading-6 font-semibold text-fg hover:border-line focus-visible:border-control focus-visible:outline-2 focus-visible:outline-focus"
      />
    </div>
  );
}

function DescriptionEditor({ value, editable, onSave }: { value: string | null; editable: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    // Never overwrite text someone is in the middle of editing.
    if (!editing) setDraft(value ?? "");
  }
  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor="task-description" className="text-label font-medium text-fg-2">
          Description
        </label>
        <Textarea id="task-description" value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} autoFocus maxLength={20000} />
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onSave(draft);
              setEditing(false);
            }}
          >
            Save description
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="group flex flex-col gap-1">
      {value ? <RichText text={value} /> : <p className="text-body text-fg-3">No description yet.</p>}
      {editable && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start rounded-xs text-label font-medium text-accent hover:text-accent-hover"
        >
          {value ? "Edit description" : "Add a description"}
        </button>
      )}
    </div>
  );
}

function BlockerEditor({
  task,
  editable,
  onSave,
}: {
  task: TaskDetail;
  editable: boolean;
  onSave: (blocked: boolean, reason: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(task.blockedReason ?? "");
  const [prev, setPrev] = useState(task.blockedReason);
  if (task.blockedReason !== prev) {
    setPrev(task.blockedReason);
    if (!editing) setReason(task.blockedReason ?? "");
  }

  if (task.blocked && !editing) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-st-blocked/40 bg-st-blocked-bg px-3 py-2.5">
        <div className="flex items-center gap-2">
          <BlockedBadge />
          {editable && (
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="quiet" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onSave(false, "")}>
                Clear blocker
              </Button>
            </div>
          )}
        </div>
        <p className="text-body text-fg">{task.blockedReason}</p>
      </div>
    );
  }
  if (!editable) return null;
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 self-start text-label font-medium text-fg-2 hover:text-fg"
      >
        <TriangleAlert className="size-4" aria-hidden /> Mark as blocked
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason.trim()) return;
        onSave(true, reason.trim());
        setEditing(false);
      }}
    >
      <label htmlFor="blocker" className="text-label font-medium text-fg-2">
        What’s blocking this?
      </label>
      <Input
        id="blocker"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        autoFocus
        placeholder="Waiting on…"
        required
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!reason.trim()}>
          Save blocker
        </Button>
        <Button size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function LabelPicker({
  task,
  workspace,
  teamSlug,
  editable,
}: {
  task: TaskDetail;
  workspace: TeamWorkspace;
  teamSlug: string;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");
  const selected = new Set(task.labels.map((l) => l.id));
  const list = (
    <span className="flex flex-wrap gap-1">
      {task.labels.length === 0 && <span className="text-fg-3">None</span>}
      {task.labels.map((l) => (
        <span key={l.id} className="inline-flex h-5 items-center rounded-xs border border-line px-1.5 text-meta text-fg-2">
          {l.name}
        </span>
      ))}
    </span>
  );
  if (!editable) return list;
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    startTransition(async () => {
      const res = await setTaskLabels(task.id, teamSlug, [...next]);
      if (!res.ok) toast(res.error.message, "error");
    });
  };
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex min-h-8 w-full items-center gap-2 rounded-sm px-1.5 py-1 -mx-1.5 text-left hover:bg-hover"
          aria-label="Edit labels"
        >
          {list}
          <Tag className="ml-auto size-3.5 shrink-0 text-fg-3" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="qm-popover z-50 w-64 rounded-md border border-line-strong bg-surface p-2 shadow-float"
        >
          <fieldset disabled={pending} className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
            <legend className="sr-only">Labels</legend>
            {workspace.labels.map((l) => (
              <label key={l.id} className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-body hover:bg-hover">
                <input
                  type="checkbox"
                  checked={selected.has(l.id)}
                  onChange={() => toggle(l.id)}
                  className="size-3.5 accent-[var(--accent)]"
                />
                {l.name}
              </label>
            ))}
          </fieldset>
          <form
            className="mt-2 flex gap-1.5 border-t border-line pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newLabel.trim();
              if (!name) return;
              startTransition(async () => {
                const res = await createLabel(teamSlug, name);
                if (!res.ok) return toast(res.error.message, "error");
                setNewLabel("");
                const r2 = await setTaskLabels(task.id, teamSlug, [...selected, res.data.id]);
                if (!r2.ok) toast(r2.error.message, "error");
              });
            }}
          >
            <label htmlFor="new-label" className="sr-only">
              New label
            </label>
            <Input
              id="new-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="New label"
              maxLength={32}
              className="h-8"
            />
            <Button type="submit" size="sm" disabled={!newLabel.trim() || pending}>
              Add
            </Button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Checklist({ task, editable }: { task: TaskDetail; editable: boolean }) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const doneCount = task.checklist.filter((c) => c.done).length;
  if (!editable && task.checklist.length === 0) return null;
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast(res.error?.message ?? "That didn't save.", "error");
    });
  return (
    <section aria-labelledby="checklist" className="flex flex-col gap-2">
      <h3 id="checklist" className="flex items-baseline gap-2 text-label font-semibold text-fg">
        Checklist
        {task.checklist.length > 0 && (
          <span className="tabular font-normal text-fg-3">
            {doneCount} of {task.checklist.length} done
          </span>
        )}
      </h3>
      <ul className="flex flex-col">
        {task.checklist.map((item) => (
          <li key={item.id} className="group flex min-h-8 items-center gap-2.5 rounded-sm px-1 hover:bg-hover">
            <input
              type="checkbox"
              id={`check-${item.id}`}
              checked={item.done}
              disabled={!editable || pending}
              onChange={(e) => run(() => toggleChecklistItem(item.id, e.target.checked))}
              className="size-4 shrink-0 accent-[var(--accent)]"
            />
            <label htmlFor={`check-${item.id}`} className={cn("flex-1 text-body", item.done ? "text-fg-3 line-through" : "text-fg")}>
              {item.body}
            </label>
            {editable && (
              <IconButton
                label={`Remove step: ${item.body}`}
                size="sm"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                onClick={() => run(() => deleteChecklistItem(item.id))}
              >
                <X className="size-3.5" aria-hidden />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const body = draft.trim();
            if (!body) return;
            run(async () => {
              const res = await addChecklistItem({ taskId: task.id, body }, task.checklist.length);
              if (res.ok) setDraft("");
              return res;
            });
          }}
        >
          <label htmlFor="new-step" className="sr-only">
            Add a checklist step
          </label>
          <Input
            id="new-step"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a step"
            maxLength={300}
            className="h-8"
          />
          <Button type="submit" size="sm" disabled={!draft.trim() || pending}>
            Add
          </Button>
        </form>
      )}
    </section>
  );
}

function Subtasks({
  task,
  workspace,
  teamSlug,
  editable,
  hrefFor,
}: {
  task: TaskDetail;
  workspace: TeamWorkspace;
  teamSlug: string;
  editable: boolean;
  hrefFor: (key: string) => string;
}) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  if (!editable && task.subtasks.length === 0) return null;
  const statusOf = (id: string) => workspace.statuses.find((s) => s.id === id);
  return (
    <section aria-labelledby="subtasks" className="flex flex-col gap-2">
      <h3 id="subtasks" className="text-label font-semibold text-fg">
        Subtasks
      </h3>
      {task.subtasks.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {task.subtasks.map((s) => {
            const st = statusOf(s.statusId);
            return (
              <li key={s.id}>
                <Link href={hrefFor(s.key)} scroll={false} className="flex min-h-9 items-center gap-2.5 px-3 py-1.5 hover:bg-hover">
                  {st && <StatusIcon statusKey={st.key} />}
                  <span className="sr-only">{st?.label}</span>
                  <IssueKey>{s.key}</IssueKey>
                  <span className="min-w-0 flex-1 truncate text-body text-fg">{s.title}</span>
                  {s.assigneeId && <Avatar name={workspace.members.find((m) => m.id === s.assigneeId)?.name} size="sm" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {editable && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const title = draft.trim();
            if (!title) return;
            startTransition(async () => {
              const res = await createTask({ teamSlug, title, parentId: task.id, projectId: task.projectId });
              if (res.ok) {
                setDraft("");
                toast(`${res.data.key} added as a subtask.`);
              } else toast(res.error.message, "error");
            });
          }}
        >
          <label htmlFor="new-subtask" className="sr-only">
            New subtask title
          </label>
          <Input
            id="new-subtask"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a subtask"
            maxLength={200}
            className="h-8"
          />
          <Button type="submit" size="sm" icon={<Plus className="size-3.5" aria-hidden />} disabled={!draft.trim() || pending}>
            Add
          </Button>
        </form>
      )}
    </section>
  );
}

/**
 * "Blocked by" / "Blocking" links (spec §7.14). Warning-only: an open blocker
 * never stops a status change. A linked task the viewer can't read appears as
 * a generic row with no key, title or team.
 */
function Dependencies({
  task,
  teamSlug,
  editable,
  hrefFor,
}: {
  task: TaskDetail;
  teamSlug: string;
  editable: boolean;
  hrefFor: (key: string) => string;
}) {
  const [direction, setDirection] = useState<TaskDependency["direction"]>("blocked_by");
  const [key, setKey] = useState("");
  const [pending, startTransition] = useTransition();
  const blockedBy = task.dependencies.filter((d) => d.direction === "blocked_by");
  const blocking = task.dependencies.filter((d) => d.direction === "blocks");
  if (!editable && task.dependencies.length === 0) return null;

  const hrefOf = (d: TaskDependency) =>
    d.other ? (d.other.teamSlug === teamSlug ? hrefFor(d.other.key) : `/t/${d.other.teamSlug}/tasks/${d.other.key}`) : null;

  const remove = (d: TaskDependency) =>
    startTransition(async () => {
      const res = await removeDependency(d.linkId);
      toast(res.ok ? "Link removed. It stays in the activity history." : res.error.message, res.ok ? "success" : "error");
    });

  const group = (label: string, items: TaskDependency[], id: string) =>
    items.length > 0 && (
      <div className="flex flex-col gap-1.5">
        <h4 id={id} className="text-meta font-medium text-fg-3">
          {label}
        </h4>
        <ul aria-labelledby={id} className="flex flex-col divide-y divide-line rounded-md border border-line">
          {items.map((d) => {
            const href = hrefOf(d);
            const crossTeam = d.other && d.other.teamSlug !== teamSlug;
            return (
              <li key={d.linkId} className="flex min-h-9 items-center gap-2.5 px-3 py-1.5">
                {d.other && href ? (
                  <Link href={href} scroll={false} className="flex min-w-0 flex-1 items-center gap-2.5 hover:text-accent">
                    <IssueKey>{d.other.key}</IssueKey>
                    <span className={cn("min-w-0 flex-1 truncate text-body", d.resolved ? "text-fg-2 line-through" : "text-fg")}>
                      {d.other.title}
                    </span>
                    {crossTeam && <span className="shrink-0 text-meta text-fg-3">{d.other.teamName}</span>}
                  </Link>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-2.5 text-body text-fg-2">
                    <EyeOff className="size-3.5 shrink-0 text-fg-3" aria-hidden />A task you can’t view
                  </span>
                )}
                <span className={cn("shrink-0 text-meta", d.resolved ? "text-fg-3" : "font-medium text-st-blocked")}>
                  {d.other?.archived ? "Archived" : d.other ? d.other.statusLabel : d.resolved ? "Resolved" : "Open"}
                </span>
                {editable && (
                  <IconButton
                    label={`Remove link${d.other ? ` to ${d.other.key}` : ""}`}
                    onClick={() => remove(d)}
                    disabled={pending}
                    size="sm"
                    className="-mr-1.5"
                  >
                    <X className="size-3.5" aria-hidden />
                  </IconButton>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );

  return (
    <section aria-labelledby="dependencies" className="flex flex-col gap-2">
      <h3 id="dependencies" className="text-label font-semibold text-fg">
        Dependencies
      </h3>
      {task.openBlockers > 0 && (
        <p className="flex items-center gap-1.5 text-label text-st-blocked">
          <TriangleAlert className="size-3.5" aria-hidden />
          Waiting on {task.openBlockers} open {task.openBlockers === 1 ? "task" : "tasks"}. You can still move this task.
        </p>
      )}
      {group("Blocked by", blockedBy, "deps-blocked-by")}
      {group("Blocking", blocking, "deps-blocking")}
      {editable && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const otherKey = key.trim();
            if (!otherKey) return;
            startTransition(async () => {
              const res = await addDependency({ taskId: task.id, otherKey, direction });
              if (res.ok) {
                setKey("");
                toast(direction === "blocked_by" ? `Now blocked by ${otherKey.toUpperCase()}.` : `Now blocking ${otherKey.toUpperCase()}.`);
              } else toast(res.error.message, "error");
            });
          }}
        >
          <Select
            aria-label="Link type"
            value={direction}
            onChange={(e) => setDirection(e.target.value as TaskDependency["direction"])}
            className="h-8 w-auto pointer-coarse:h-10"
          >
            <option value="blocked_by">Blocked by</option>
            <option value="blocks">Blocking</option>
          </Select>
          <label htmlFor="dependency-key" className="sr-only">
            Task key
          </label>
          <Input
            id="dependency-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Task key, e.g. DEV-12"
            maxLength={16}
            autoComplete="off"
            className="h-8 w-44 flex-1 font-mono"
          />
          <Button type="submit" size="sm" icon={<Link2 className="size-3.5" aria-hidden />} disabled={!key.trim() || pending}>
            Link
          </Button>
        </form>
      )}
    </section>
  );
}

function Comments({
  task,
  teamSlug,
  canComment,
  viewerId,
  timezone,
}: {
  task: TaskDetail;
  teamSlug: string;
  canComment: boolean;
  viewerId: string;
  timezone: string;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {task.comments.length === 0 && <p className="text-body text-fg-3">No comments yet.</p>}
      <ul className="flex flex-col gap-4">
        {task.comments.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <Avatar name={c.authorName} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-label">
                <span className="font-medium text-fg">{c.authorName}</span>
                <time dateTime={c.createdAt} title={formatTimestamp(c.createdAt, timezone)} className="text-fg-3">
                  <RelativeTime iso={c.createdAt} timeZone={timezone} />
                </time>
                {c.editedAt && !c.deleted && <span className="text-fg-3">(edited)</span>}
              </p>
              {c.deleted ? (
                <p className="mt-0.5 text-body text-fg-3 italic">Comment deleted.</p>
              ) : editing === c.id ? (
                <form
                  className="mt-1 flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    startTransition(async () => {
                      const res = await editComment(c.id, editDraft);
                      if (res.ok) setEditing(null);
                      else toast(res.error.message, "error");
                    });
                  }}
                >
                  <label htmlFor={`edit-${c.id}`} className="sr-only">
                    Edit comment
                  </label>
                  <Textarea id={`edit-${c.id}`} value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={3} autoFocus />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" variant="primary" pending={pending}>
                      Save
                    </Button>
                    <Button size="sm" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <RichText text={c.body} className="mt-0.5" />
                  {c.authorId === viewerId && canComment && (
                    <div className="mt-1 flex gap-3">
                      <button
                        type="button"
                        className="text-meta font-medium text-fg-3 hover:text-fg"
                        onClick={() => {
                          setEditing(c.id);
                          setEditDraft(c.body);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-meta font-medium text-fg-3 hover:text-danger"
                        onClick={() =>
                          startTransition(async () => {
                            const res = await deleteComment(c.id);
                            toast(res.ok ? "Comment deleted." : res.error.message, res.ok ? "success" : "error");
                          })
                        }
                      >
                        <Trash2 className="size-3" aria-hidden /> Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canComment ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const body = draft.trim();
            if (!body) return;
            startTransition(async () => {
              const res = await addComment({ taskId: task.id, body }, teamSlug);
              if (res.ok) setDraft("");
              else toast(res.error.message, "error");
            });
          }}
        >
          <label htmlFor="new-comment" className="sr-only">
            Write a comment
          </label>
          <Textarea
            id="new-comment"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={10000}
            placeholder="Write a comment…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-meta text-fg-3">⌘/Ctrl + Enter to send</span>
            <Button type="submit" size="sm" variant="primary" disabled={!draft.trim()} pending={pending} pendingLabel="Sending…">
              Comment
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-meta text-fg-3">You have read-only access to this team, so you can’t comment.</p>
      )}
    </div>
  );
}

export function describeActivity(
  event: string,
  data: Record<string, unknown>,
  memberName: (id: string | null) => string | null,
  relatedKey?: string | null,
): string {
  const s = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : null);
  switch (event) {
    case "created":
      return "created this task";
    case "status_changed":
      return `moved it from ${s("from")} to ${s("to")}`;
    case "completed":
      return `completed it (${s("to")})`;
    case "reopened":
      return `reopened it (${s("from")} → ${s("to")})`;
    case "assigned":
      return `assigned it to ${memberName(s("to")) ?? "someone"}`;
    case "unassigned":
      return "removed the assignee";
    case "priority_changed":
      return `changed priority from ${priorityLabel((s("from") ?? "none") as never)} to ${priorityLabel((s("to") ?? "none") as never)}`;
    case "due_changed":
      return s("to") ? `set the due date to ${formatDateLong(s("to")!)}` : "removed the due date";
    case "blocked":
      return "marked it as blocked";
    case "unblocked":
      return "cleared the blocker";
    case "archived":
      return "archived it";
    case "restored":
      return "restored it";
    case "commented":
      return "commented";
    case "title_changed":
      return "renamed it";
    case "project_changed":
      return "changed the project";
    case "dependency_added":
    case "dependency_removed": {
      const other = typeof data.task === "string" ? (relatedKey ?? "a task you can’t view") : "a task";
      const verb = event === "dependency_added" ? "marked it as" : "removed the link:";
      return data.direction === "blocks" ? `${verb} blocking ${other}` : `${verb} blocked by ${other}`;
    }
    case "linked_to_request":
      return `created it from request REQ-${String(data.request_number ?? "")}`;
    default:
      return "updated it";
  }
}
