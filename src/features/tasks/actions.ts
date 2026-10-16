"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapDbError, NOT_AVAILABLE, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";
import { findTeam, requireViewer } from "@/server/auth/viewer";
import { canCommentTeam, canWriteTeam } from "@/server/policies";
import { clientKey, rateLimit } from "@/server/rate-limit";
import {
  checklistSchema,
  commentSchema,
  createTaskSchema,
  moveTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "./schemas";

/*
 * Every action: validate input → resolve the viewer from current DB state →
 * check policy for UX-friendly errors → write through the user-scoped client
 * (RLS + triggers are the real enforcement) → return a user-safe result.
 */

function validationError(error: z.ZodError) {
  return fail({
    code: "validation",
    message: error.issues[0]?.message ?? "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message])),
  });
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult<{ id: string; key: string }>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;
  const viewer = await requireViewer();
  const team = findTeam(viewer, v.teamSlug);
  if (!canWriteTeam(team)) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  if (!rateLimit(await clientKey("task-create", viewer.id), 60, 60_000)) {
    return fail({ code: "rate_limited", message: "You're creating tasks very quickly. Pause for a moment." });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      team_id: team!.id,
      title: v.title,
      description: v.description ?? null,
      status_id: v.statusId ?? undefined,
      priority: v.priority,
      type: v.type,
      assignee_id: v.assigneeId ?? null,
      due_date: v.dueDate ?? null,
      project_id: v.projectId ?? null,
      milestone_id: v.milestoneId ?? null,
      parent_id: v.parentId ?? null,
    })
    .select("id, issue_key")
    .single();
  if (error || !data) return fail(mapDbError(error));
  refresh();
  return ok({ id: data.id, key: data.issue_key });
}

export async function updateTask(taskId: string, version: number, patch: UpdateTaskInput): Promise<ActionResult<{ version: number }>> {
  if (!z.uuid().safeParse(taskId).success || !Number.isInteger(version)) {
    return fail({ code: "forbidden", message: NOT_AVAILABLE });
  }
  const parsed = updateTaskSchema.safeParse(patch);
  if (!parsed.success) return validationError(parsed.error);
  await requireViewer();
  const p = parsed.data;

  const row: Database["public"]["Tables"]["tasks"]["Update"] = {};
  if (p.title !== undefined) row.title = p.title;
  if (p.description !== undefined) row.description = p.description;
  if (p.priority !== undefined) row.priority = p.priority;
  if (p.type !== undefined) row.type = p.type;
  if (p.assigneeId !== undefined) row.assignee_id = p.assigneeId;
  if (p.reviewerId !== undefined) row.reviewer_id = p.reviewerId;
  if (p.dueDate !== undefined) row.due_date = p.dueDate;
  if (p.startDate !== undefined) row.start_date = p.startDate;
  if (p.projectId !== undefined) {
    row.project_id = p.projectId;
    if (p.milestoneId === undefined) row.milestone_id = null;
  }
  if (p.milestoneId !== undefined) row.milestone_id = p.milestoneId;
  if (p.estimate !== undefined) row.estimate_points = p.estimate;
  if (p.blocked !== undefined) row.blocked = p.blocked;
  if (p.blockedReason !== undefined) row.blocked_reason = p.blockedReason;
  if (Object.keys(row).length === 0) return ok({ version });

  const supabase = await createClient();
  // Optimistic concurrency: only update the version the user was looking at.
  const { data, error } = await supabase.from("tasks").update(row).eq("id", taskId).eq("version", version).select("version");
  if (error) return fail(mapDbError(error));
  if (!data || data.length === 0) {
    const { data: still } = await supabase.from("tasks").select("id").eq("id", taskId).maybeSingle();
    return still
      ? fail({ code: "conflict", message: "Someone else changed this task. We've loaded the latest version; review it and try again." })
      : fail({ code: "forbidden", message: NOT_AVAILABLE });
  }
  refresh();
  return ok({ version: data[0].version });
}

export async function moveTask(input: z.input<typeof moveTaskSchema>): Promise<ActionResult<{ version: number; statusId: string }>> {
  const parsed = moveTaskSchema.safeParse(input);
  if (!parsed.success) return fail({ code: "validation", message: "That move isn't valid." });
  await requireViewer();
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_task", {
    p_task: v.taskId,
    p_status: v.statusId,
    p_expected_version: v.version,
    p_after: v.afterId ?? undefined,
    p_before: v.beforeId ?? undefined,
  });
  if (error || !data?.[0]) return fail(mapDbError(error, "We couldn't move that task. Nothing was changed."));
  refresh();
  return ok({ version: data[0].version, statusId: data[0].status_id });
}

export async function setArchived(taskId: string, version: number, archived: boolean): Promise<ActionResult<null>> {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", taskId)
    .eq("version", version)
    .select("id");
  if (error) return fail(mapDbError(error));
  if (!data?.length) return fail({ code: "conflict", message: "This task changed since you opened it. Refresh and try again." });
  refresh();
  return ok(null);
}

export async function setTaskLabels(taskId: string, teamSlug: string, labelIds: string[]): Promise<ActionResult<null>> {
  const ids = z.array(z.uuid()).max(12).safeParse(labelIds);
  if (!ids.success) return fail({ code: "validation", message: "Choose up to 12 labels." });
  const viewer = await requireViewer();
  const team = findTeam(viewer, teamSlug);
  if (!canWriteTeam(team)) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase.from("task_label_links").select("label_id").eq("task_id", taskId);
  if (readError) return fail(mapDbError(readError));
  const have = new Set((current ?? []).map((l) => l.label_id));
  const want = new Set(ids.data);
  const toAdd = [...want].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));
  if (toAdd.length) {
    const { error } = await supabase
      .from("task_label_links")
      .insert(toAdd.map((label_id) => ({ team_id: team!.id, task_id: taskId, label_id })));
    if (error) return fail(mapDbError(error));
  }
  if (toRemove.length) {
    const { error } = await supabase.from("task_label_links").delete().eq("task_id", taskId).in("label_id", toRemove);
    if (error) return fail(mapDbError(error));
  }
  refresh();
  return ok(null);
}

export async function createLabel(teamSlug: string, name: string): Promise<ActionResult<{ id: string; name: string }>> {
  const n = z.string().trim().min(1).max(32).safeParse(name);
  if (!n.success) return fail({ code: "validation", message: "Labels need 1–32 characters." });
  const viewer = await requireViewer();
  const team = findTeam(viewer, teamSlug);
  if (!canWriteTeam(team)) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_labels")
    .insert({ team_id: team!.id, name: n.data.toLowerCase() })
    .select("id, name")
    .single();
  if (error || !data)
    return fail(error?.code === "23505" ? { code: "duplicate", message: "That label already exists." } : mapDbError(error));
  refresh();
  return ok(data);
}

export async function addComment(input: z.input<typeof commentSchema>, teamSlug: string): Promise<ActionResult<null>> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const viewer = await requireViewer();
  if (!canCommentTeam(findTeam(viewer, teamSlug)))
    return fail({ code: "forbidden", message: "You can read this team's work but not comment on it." });
  if (!rateLimit(await clientKey("comment", viewer.id), 30, 60_000)) {
    return fail({ code: "rate_limited", message: "You're commenting very quickly. Pause for a moment." });
  }
  const supabase = await createClient();
  const { error } = await supabase.from("task_comments").insert({ task_id: parsed.data.taskId, body: parsed.data.body });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

export async function editComment(commentId: string, body: string): Promise<ActionResult<null>> {
  const b = z.string().trim().min(1, "A comment can't be empty.").max(10000).safeParse(body);
  if (!b.success || !z.uuid().safeParse(commentId).success) return fail({ code: "validation", message: "A comment can't be empty." });
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_comments").update({ body: b.data }).eq("id", commentId).select("id");
  if (error) return fail(mapDbError(error));
  if (!data?.length) return fail({ code: "forbidden", message: "You can only edit your own comments." });
  refresh();
  return ok(null);
}

export async function deleteComment(commentId: string): Promise<ActionResult<null>> {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .select("id");
  if (error) return fail(mapDbError(error));
  if (!data?.length) return fail({ code: "forbidden", message: "You can only delete your own comments." });
  refresh();
  return ok(null);
}

export async function addChecklistItem(input: z.input<typeof checklistSchema>, position: number): Promise<ActionResult<null>> {
  const parsed = checklistSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_checklist_items")
    .insert({ task_id: parsed.data.taskId, body: parsed.data.body, position: Math.max(0, Math.floor(position)) });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

export async function toggleChecklistItem(itemId: string, done: boolean): Promise<ActionResult<null>> {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_checklist_items").update({ done }).eq("id", itemId).select("id");
  if (error) return fail(mapDbError(error));
  if (!data?.length) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  refresh();
  return ok(null);
}

export async function deleteChecklistItem(itemId: string): Promise<ActionResult<null>> {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_checklist_items").delete().eq("id", itemId).select("id");
  if (error) return fail(mapDbError(error));
  if (!data?.length) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  refresh();
  return ok(null);
}

const addDependencySchema = z.object({
  taskId: z.uuid(),
  otherKey: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}-\d{1,7}$/, "Enter a task key like DEV-12."),
  direction: z.enum(["blocked_by", "blocks"]),
});

/** Links two tasks. The database rejects self-links, duplicates, loops and tasks the viewer can't read. */
export async function addDependency(input: z.input<typeof addDependencySchema>): Promise<ActionResult<null>> {
  const parsed = addDependencySchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  await requireViewer();
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_task_dependency", {
    p_task: v.taskId,
    p_other_key: v.otherKey,
    p_direction: v.direction,
  });
  if (error) {
    // The other task is unknown or unreadable: say so without confirming either.
    if (error.code === "P0002" && error.message.includes("that key")) {
      return fail({ code: "validation", message: `No task you can view has the key ${v.otherKey}.` });
    }
    return fail(mapDbError(error, "We couldn't add that link. Nothing was changed."));
  }
  refresh();
  return ok(null);
}

export async function removeDependency(linkId: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(linkId).success) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_task_dependency", { p_link: linkId });
  if (error) return fail(mapDbError(error, "We couldn't remove that link. Nothing was changed."));
  refresh();
  return ok(null);
}
