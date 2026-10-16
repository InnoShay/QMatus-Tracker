"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { formatDueDate } from "@/lib/dates";
import { cn } from "@/components/ui/cn";
import type { ProjectRow } from "@/server/dal/projects";
import { addMilestone, postProjectUpdate, saveProject, setMilestoneDone } from "./actions";
import { HEALTH, PROJECT_STATUS } from "./progress";

type Member = { id: string; name: string };

export function ProjectFormButton({ teamSlug, members, project }: { teamSlug: string; members: Member[]; project?: ProjectRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  return (
    <>
      {project ? (
        <Button size="sm" icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => setOpen(true)}>
          Edit project
        </Button>
      ) : (
        <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
          New project
        </Button>
      )}
      <Modal open={open} onOpenChange={setOpen} title={project ? "Edit project" : "New project"} className="max-w-xl">
        <form
          className="flex flex-col gap-4"
          noValidate
          action={(f) =>
            startTransition(async () => {
              setErrors({});
              const res = await saveProject(teamSlug, project?.id ?? null, {
                name: String(f.get("name") ?? ""),
                purpose: String(f.get("purpose") ?? ""),
                leadId: String(f.get("leadId") ?? ""),
                status: String(f.get("status") ?? "planned") as never,
                health: String(f.get("health") ?? "") as never,
                startDate: String(f.get("startDate") ?? ""),
                targetDate: String(f.get("targetDate") ?? ""),
              });
              if (!res.ok) {
                setErrors(res.error.fieldErrors ?? {});
                if (!res.error.fieldErrors) toast(res.error.message, "error");
                return;
              }
              setOpen(false);
              toast(project ? "Project saved." : "Project created.");
              if (!project) router.push(`/t/${teamSlug}/projects/${res.data.id}`);
            })
          }
        >
          <Field label="Name" error={errors.name}>
            {(p) => <Input {...p} name="name" defaultValue={project?.name} maxLength={100} autoFocus />}
          </Field>
          <Field label="Purpose" optional hint="The outcome this project exists to deliver." error={errors.purpose}>
            {(p) => <Textarea {...p} name="purpose" defaultValue={project?.purpose ?? ""} rows={3} maxLength={2000} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lead" optional>
              {(p) => (
                <Select {...p} name="leadId" defaultValue={project?.leadId ?? ""}>
                  <option value="">No lead</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Status">
              {(p) => (
                <Select {...p} name="status" defaultValue={project?.status ?? "planned"}>
                  {Object.entries(PROJECT_STATUS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Start date" optional error={errors.startDate}>
              {(p) => <Input {...p} type="date" name="startDate" defaultValue={project?.startDate ?? ""} />}
            </Field>
            <Field label="Target date" optional error={errors.targetDate}>
              {(p) => <Input {...p} type="date" name="targetDate" defaultValue={project?.targetDate ?? ""} />}
            </Field>
          </div>
          <Field label="Health" optional hint="Set by the lead. On track, at risk or off track against the target date.">
            {(p) => (
              <Select {...p} name="health" defaultValue={project?.health ?? ""}>
                <option value="">Not set</option>
                {Object.entries(HEALTH).map(([v, h]) => (
                  <option key={v} value={v}>
                    {h.label} — {h.definition}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" pending={pending} pendingLabel="Saving…">
              {project ? "Save project" : "Create project"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function ProjectUpdateForm({ projectId, current }: { projectId: string; current: string | null }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(current ?? "");
  const [pending, startTransition] = useTransition();
  if (!editing) {
    return (
      <Button size="sm" variant="quiet" className="self-start" onClick={() => setEditing(true)}>
        {current ? "Post a new update" : "Write the first update"}
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await postProjectUpdate(projectId, text);
          if (res.ok) {
            toast("Project update posted.");
            setEditing(false);
          } else toast(res.error.message, "error");
        });
      }}
    >
      <label htmlFor="project-update" className="text-label font-medium text-fg-2">
        Current state, what changed, risks and the next milestone
      </label>
      <Textarea id="project-update" value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} autoFocus />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" pending={pending} disabled={!text.trim()}>
          Post update
        </Button>
        <Button size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function Milestones({
  teamSlug,
  project,
  members,
  canWrite,
  today,
  taskCounts,
}: {
  teamSlug: string;
  project: ProjectRow;
  members: Member[];
  canWrite: boolean;
  today: string;
  taskCounts: Record<string, { done: number; total: number }>;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const name = (id: string | null) => members.find((m) => m.id === id)?.name;
  return (
    <div className="flex flex-col gap-3">
      {project.milestones.length === 0 && (
        <p className="text-body text-fg-3">No milestones yet. Add the outcomes this project should hit along the way.</p>
      )}
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface shadow-panel">
        {project.milestones.map((m) => {
          const c = taskCounts[m.id] ?? { done: 0, total: 0 };
          const late = !m.done && m.dueDate && m.dueDate < today;
          return (
            <li key={m.id} className="flex items-start gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={m.done}
                disabled={!canWrite || pending}
                aria-label={`Milestone done: ${m.name}`}
                onChange={(e) =>
                  startTransition(async () => {
                    const res = await setMilestoneDone(m.id, e.target.checked);
                    if (!res.ok) toast(res.error.message, "error");
                  })
                }
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />
              <div className="min-w-0 flex-1">
                <p className={cn("text-body font-medium", m.done ? "text-fg-3 line-through" : "text-fg")}>{m.name}</p>
                {m.criterion && <p className="mt-0.5 text-label text-fg-2">Done when: {m.criterion}</p>}
                <p className="mt-1 flex flex-wrap gap-x-3 text-meta text-fg-3">
                  {m.dueDate && (
                    <span className={late ? "font-medium text-danger" : undefined}>
                      {late ? "Overdue · " : "Due "}
                      {formatDueDate(m.dueDate, today)}
                    </span>
                  )}
                  {name(m.ownerId) && <span>Owner {name(m.ownerId)}</span>}
                  <span className="tabular">{c.total ? `${c.done}/${c.total} tasks done` : "No tasks linked"}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {canWrite &&
        (adding ? (
          <form
            className="flex flex-col gap-3 rounded-md border border-line p-4"
            action={(f) =>
              startTransition(async () => {
                const res = await addMilestone(teamSlug, project.id, project.milestones.length + 1, {
                  name: String(f.get("name") ?? ""),
                  criterion: String(f.get("criterion") ?? ""),
                  dueDate: String(f.get("dueDate") ?? ""),
                  ownerId: String(f.get("ownerId") ?? ""),
                });
                if (res.ok) {
                  toast("Milestone added.");
                  setAdding(false);
                } else toast(res.error.message, "error");
              })
            }
          >
            <Field label="Milestone">{(p) => <Input {...p} name="name" maxLength={100} autoFocus />}</Field>
            <Field label="Done when" optional>
              {(p) => <Input {...p} name="criterion" maxLength={500} />}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Due date" optional>
                {(p) => <Input {...p} type="date" name="dueDate" />}
              </Field>
              <Field label="Owner" optional>
                {(p) => (
                  <Select {...p} name="ownerId" defaultValue="">
                    <option value="">No owner</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="primary" pending={pending}>
                Add milestone
              </Button>
              <Button size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            size="sm"
            variant="quiet"
            className="self-start"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => setAdding(true)}
          >
            Add milestone
          </Button>
        ))}
    </div>
  );
}
