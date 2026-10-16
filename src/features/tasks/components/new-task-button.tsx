"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { createTask } from "../actions";
import { PRIORITIES, TYPES } from "../meta";
import type { Member, ProjectRef, Status } from "../types";

export function NewTaskButton({
  teamSlug,
  statuses,
  members,
  projects,
  viewerId,
  label = "New task",
  defaultProjectId,
  parentId,
  variant = "primary",
}: {
  teamSlug: string;
  statuses: Status[];
  members: Member[];
  projects: ProjectRef[];
  viewerId: string;
  label?: string;
  defaultProjectId?: string;
  parentId?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const project = projects.find((p) => p.id === projectId);
  const isViewerMember = members.some((m) => m.id === viewerId && m.active);

  const onSubmit = (form: FormData) => {
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await createTask({
        teamSlug,
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        statusId: String(form.get("statusId") ?? ""),
        priority: String(form.get("priority") ?? "none") as never,
        type: String(form.get("type") ?? "task") as never,
        assigneeId: String(form.get("assigneeId") ?? ""),
        dueDate: String(form.get("dueDate") ?? ""),
        projectId: String(form.get("projectId") ?? ""),
        milestoneId: String(form.get("milestoneId") ?? ""),
        parentId: parentId ?? null,
      });
      if (!res.ok) {
        setErrors(res.error.fieldErrors ?? {});
        setFormError(res.error.fieldErrors ? null : res.error.message);
        return;
      }
      setOpen(false);
      toast(`${res.data.key} created.`);
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("task", res.data.key);
      if (!parentId && (pathname.endsWith("/board") || pathname.endsWith("/list"))) {
        router.push(`${pathname}?${sp.toString()}`, { scroll: false });
      }
    });
  };

  return (
    <>
      <Button variant={variant} icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={parentId ? "New subtask" : "New task"} className="max-w-xl">
        <form action={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Title" error={errors.title}>
            {(p) => <Input {...p} name="title" required autoFocus maxLength={200} placeholder="What needs to happen?" />}
          </Field>
          <Field label="Description" optional hint="What does done look like? Links become clickable.">
            {(p) => <Textarea {...p} name="description" rows={4} maxLength={20000} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              {(p) => (
                <Select {...p} name="statusId" defaultValue={statuses.find((s) => s.key === "backlog")?.id}>
                  {statuses
                    .filter((s) => s.category !== "canceled" && s.category !== "completed")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
            <Field label="Assignee" error={errors.assigneeId}>
              {(p) => (
                <Select {...p} name="assigneeId" defaultValue={isViewerMember ? viewerId : ""}>
                  <option value="">Unassigned</option>
                  {members
                    .filter((m) => m.active)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.id === viewerId ? " (you)" : ""}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
            <Field label="Priority">
              {(p) => (
                <Select {...p} name="priority" defaultValue="none">
                  {PRIORITIES.map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Type">
              {(p) => (
                <Select {...p} name="type" defaultValue="task">
                  {TYPES.map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Due date" optional error={errors.dueDate}>
              {(p) => <Input {...p} type="date" name="dueDate" />}
            </Field>
            {projects.length > 0 && (
              <Field label="Project" optional>
                {(p) => (
                  <Select {...p} name="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="">No project</option>
                    {projects.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {project && project.milestones.length > 0 && (
              <Field label="Milestone" optional>
                {(p) => (
                  <Select {...p} name="milestoneId" defaultValue="">
                    <option value="">No milestone</option>
                    {project.milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          </div>
          {formError && (
            <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-body text-danger">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" pending={pending} pendingLabel="Creating…">
              Create task
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
