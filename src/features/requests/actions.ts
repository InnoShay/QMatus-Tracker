"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapDbError, NOT_AVAILABLE, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/server/auth/viewer";
import { clientKey, rateLimit } from "@/server/rate-limit";

const status = z.enum(["draft", "submitted", "in_triage", "needs_info", "accepted", "in_progress", "delivered", "closed", "declined"]);
const priority = z.enum(["none", "low", "medium", "high", "urgent"]);
const optionalDate = z.union([z.iso.date({ message: "Use a valid date." }), z.literal(""), z.null()]).transform((v) => v || null);

const requestSchema = z.object({
  clientKey: z.uuid(),
  targetTeamId: z.uuid({ message: "Choose the team that should receive this." }),
  sourceTeamId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  title: z.string().trim().min(3, "Give the request a short title.").max(160),
  problem: z.string().trim().min(1, "Describe the problem or background.").max(5000),
  outcome: z.string().trim().min(1, "Say what outcome you need and why it matters.").max(3000),
  acceptanceCriteria: z.string().trim().max(3000).optional().default(""),
  links: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .default("")
    .refine(
      (v) =>
        v
          .split(/\s+/)
          .filter(Boolean)
          .every((u) => /^https?:\/\/\S+$/i.test(u)),
      "Links must start with http:// or https://, one per line.",
    ),
  requestedPriority: priority.default("none"),
  requestedDate: optionalDate,
  audience: z.array(z.uuid()).max(20).default([]),
  asDraft: z.boolean(),
});
export type RequestFormInput = z.input<typeof requestSchema>;

function refresh() {
  revalidatePath("/", "layout");
}

function fieldError(error: z.ZodError) {
  return fail({
    code: "validation",
    message: "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message])),
  });
}

export async function submitRequest(input: RequestFormInput): Promise<ActionResult<{ id: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return fieldError(parsed.error);
  const v = parsed.data;
  if (v.requestedDate && v.requestedDate < new Date().toISOString().slice(0, 10)) {
    return fail({
      code: "validation",
      message: "Check the highlighted fields.",
      fieldErrors: { requestedDate: "Pick today or a later date." },
    });
  }
  const viewer = await requireViewer();
  if (!rateLimit(await clientKey("request", viewer.id), 20, 60 * 60_000)) {
    return fail({ code: "rate_limited", message: "You've submitted a lot of requests recently. Try again later." });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_work_request", {
    p_client_key: v.clientKey,
    p_target_team: v.targetTeamId,
    p_source_team: v.sourceTeamId ?? undefined,
    p_title: v.title,
    p_problem: v.problem,
    p_outcome: v.outcome,
    p_acceptance_criteria: v.acceptanceCriteria,
    p_links: v.links,
    p_requested_priority: v.requestedPriority,
    p_requested_date: v.requestedDate ?? undefined,
    p_audience: v.audience,
    p_as_draft: v.asDraft,
  });
  if (error || !data) return fail(mapDbError(error));
  refresh();
  return ok({ id: data as unknown as string });
}

export async function submitDraft(requestId: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(requestId).success) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_draft_request", { p_request: requestId });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

export async function postMessage(requestId: string, body: string): Promise<ActionResult<null>> {
  const b = z.string().trim().min(1, "Write a message first.").max(5000).safeParse(body);
  if (!b.success) return fail({ code: "validation", message: b.error.issues[0].message });
  const viewer = await requireViewer();
  if (!rateLimit(await clientKey("request-message", viewer.id), 30, 60_000)) {
    return fail({ code: "rate_limited", message: "You're posting very quickly. Pause for a moment." });
  }
  const supabase = await createClient();
  const { error } = await supabase.from("work_request_messages").insert({ request_id: requestId, body: b.data });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

export async function addInternalNote(requestId: string, body: string): Promise<ActionResult<null>> {
  const b = z.string().trim().min(1, "Write a note first.").max(5000).safeParse(body);
  if (!b.success) return fail({ code: "validation", message: b.error.issues[0].message });
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("work_request_internal_notes").insert({ request_id: requestId, body: b.data });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

const transitionSchema = z.object({
  requestId: z.uuid(),
  expected: status,
  to: status,
  publicSummary: z.string().trim().max(2000).optional().default(""),
  reason: z.string().trim().max(1000).optional().default(""),
  committedPriority: priority.optional(),
  committedDate: optionalDate.optional(),
});

export async function transitionRequest(input: z.input<typeof transitionSchema>): Promise<ActionResult<null>> {
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return fail({ code: "validation", message: parsed.error.issues[0].message });
  const v = parsed.data;
  if (v.to === "needs_info" && !v.publicSummary) {
    return fail({ code: "validation", message: "Write the question the requester needs to answer." });
  }
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_work_request", {
    p_request: v.requestId,
    p_expected: v.expected,
    p_to: v.to,
    p_public_summary: v.publicSummary || undefined,
    p_reason: v.reason || undefined,
    p_committed_priority: v.committedPriority,
    p_committed_date: v.committedDate ?? undefined,
  });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

const acceptSchema = z.object({
  requestId: z.uuid(),
  expected: status,
  committedPriority: priority,
  committedDate: optionalDate,
  publicSummary: z.string().trim().min(1, "Tell the requester what you've committed to.").max(2000),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Each task needs a title.").max(200),
        assigneeId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
      }),
    )
    .max(20),
});

export async function acceptRequest(input: z.input<typeof acceptSchema>): Promise<ActionResult<{ created: number }>> {
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) return fail({ code: "validation", message: parsed.error.issues[0].message });
  const v = parsed.data;
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_work_request", {
    p_request: v.requestId,
    p_expected: v.expected,
    p_committed_priority: v.committedPriority,
    p_committed_date: v.committedDate ?? undefined,
    p_public_summary: v.publicSummary,
    p_tasks: v.tasks.map((t) => ({ title: t.title, assignee_id: t.assigneeId ?? "" })),
  });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok({ created: (data as unknown as string[] | null)?.length ?? 0 });
}

export async function publishUpdate(requestId: string, summary: string): Promise<ActionResult<null>> {
  const s = z.string().trim().min(1, "Write the update first.").max(2000).safeParse(summary);
  if (!s.success) return fail({ code: "validation", message: s.error.issues[0].message });
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_request_update", { p_request: requestId, p_summary: s.data });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

export async function setTriageOwner(requestId: string, ownerId: string | null): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(requestId).success || (ownerId && !z.uuid().safeParse(ownerId).success)) {
    return fail({ code: "validation", message: "Choose a team member." });
  }
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_request_triage")
    .update({ triage_owner_id: ownerId })
    .eq("request_id", requestId)
    .select("request_id");
  if (error) return fail(mapDbError(error));
  if (!data?.length) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  refresh();
  return ok(null);
}

export async function linkTaskByKey(requestId: string, targetTeamId: string, key: string): Promise<ActionResult<null>> {
  const k = z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,6}-\d{1,7}$/, "Use a task key like DEV-12.")
    .safeParse(key);
  if (!k.success) return fail({ code: "validation", message: k.error.issues[0].message });
  await requireViewer();
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id")
    .eq("team_id", targetTeamId)
    .eq("issue_key", k.data.toUpperCase())
    .maybeSingle();
  if (!task) return fail({ code: "validation", message: `No task ${k.data.toUpperCase()} in the receiving team.` });
  const { error } = await supabase.rpc("link_request_task", { p_request: requestId, p_task: task.id });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

export async function addAudience(requestId: string, profileId: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(profileId).success) return fail({ code: "validation", message: "Choose a person." });
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_request_audience", { p_request: requestId, p_profile: profileId });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}
