"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapDbError, NOT_AVAILABLE, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { findTeam, requireViewer } from "@/server/auth/viewer";
import { canWriteTeam } from "@/server/policies";

const optionalDate = z.union([z.iso.date({ message: "Use a valid date." }), z.literal(""), z.null()]).transform((v) => v || null);
const optionalUuid = z.union([z.uuid(), z.literal(""), z.null()]).transform((v) => v || null);

const projectSchema = z
  .object({
    name: z.string().trim().min(1, "Name the project.").max(100),
    purpose: z
      .string()
      .trim()
      .max(2000)
      .transform((v) => v || null),
    leadId: optionalUuid,
    status: z.enum(["planned", "active", "paused", "completed"]),
    health: z.union([z.enum(["on_track", "at_risk", "off_track"]), z.literal(""), z.null()]).transform((v) => v || null),
    startDate: optionalDate,
    targetDate: optionalDate,
  })
  .refine((v) => !v.startDate || !v.targetDate || v.targetDate >= v.startDate, {
    path: ["targetDate"],
    message: "Target date must be after the start date.",
  });

function fields(error: z.ZodError) {
  return fail({
    code: "validation",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message])),
  });
}

export async function saveProject(
  teamSlug: string,
  projectId: string | null,
  input: z.input<typeof projectSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return fields(parsed.error);
  const viewer = await requireViewer();
  const team = findTeam(viewer, teamSlug);
  if (!canWriteTeam(team)) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  const v = parsed.data;
  const row = {
    name: v.name,
    purpose: v.purpose,
    lead_id: v.leadId,
    status: v.status,
    health: v.health,
    start_date: v.startDate,
    target_date: v.targetDate,
  };
  const supabase = await createClient();
  const res = projectId
    ? await supabase.from("projects").update(row).eq("id", projectId).eq("team_id", team!.id).select("id").maybeSingle()
    : await supabase
        .from("projects")
        .insert({ ...row, team_id: team!.id })
        .select("id")
        .single();
  if (res.error || !res.data) return fail(res.error ? mapDbError(res.error) : { code: "forbidden", message: NOT_AVAILABLE });
  revalidatePath("/", "layout");
  return ok({ id: res.data.id });
}

export async function postProjectUpdate(projectId: string, text: string): Promise<ActionResult<null>> {
  const t = z.string().trim().min(1, "Write the update first.").max(2000).safeParse(text);
  if (!t.success) return fail({ code: "validation", message: t.error.issues[0].message });
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").update({ latest_update: t.data }).eq("id", projectId).select("id");
  if (error) return fail(mapDbError(error));
  if (!data?.length) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  revalidatePath("/", "layout");
  return ok(null);
}

export async function setProjectArchived(projectId: string, archived: boolean): Promise<ActionResult<null>> {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", projectId)
    .select("id");
  if (error) return fail(mapDbError(error));
  if (!data?.length) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  revalidatePath("/", "layout");
  return ok(null);
}

const milestoneSchema = z.object({
  name: z.string().trim().min(1, "Name the milestone.").max(100),
  criterion: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null),
  dueDate: optionalDate,
  ownerId: optionalUuid,
});

export async function addMilestone(
  teamSlug: string,
  projectId: string,
  position: number,
  input: z.input<typeof milestoneSchema>,
): Promise<ActionResult<null>> {
  const parsed = milestoneSchema.safeParse(input);
  if (!parsed.success) return fields(parsed.error);
  const viewer = await requireViewer();
  const team = findTeam(viewer, teamSlug);
  if (!canWriteTeam(team)) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").insert({
    team_id: team!.id,
    project_id: projectId,
    name: parsed.data.name,
    completion_criterion: parsed.data.criterion,
    due_date: parsed.data.dueDate,
    owner_id: parsed.data.ownerId,
    position,
  });
  if (error) return fail(mapDbError(error));
  revalidatePath("/", "layout");
  return ok(null);
}

export async function setMilestoneDone(milestoneId: string, done: boolean): Promise<ActionResult<null>> {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.from("milestones").update({ done }).eq("id", milestoneId).select("id");
  if (error) return fail(mapDbError(error));
  if (!data?.length) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  revalidatePath("/", "layout");
  return ok(null);
}
