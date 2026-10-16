"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapDbError, NOT_AVAILABLE, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { rangeFromWallClock } from "@/lib/time";
import { requireViewer } from "@/server/auth/viewer";
import { correctionSchema, manualEntrySchema, type CorrectionInput, type ManualEntryInput } from "./schemas";

/*
 * Time actions call the SQL functions, which authorize the caller, enforce one
 * running timer, validate ranges and record history in one transaction.
 * Timestamps for start/stop are taken by the database, never the browser.
 */

function refresh() {
  revalidatePath("/", "layout");
}

function validationError(error: z.ZodError) {
  return fail({
    code: "validation",
    message: error.issues[0]?.message ?? "Check the highlighted fields.",
    fieldErrors: Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message])),
  });
}

export async function startTimer(taskId: string): Promise<ActionResult<{ id: string; startedAt: string }>> {
  if (!z.uuid().safeParse(taskId).success) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_timer", { p_task: taskId }).single();
  if (error || !data) return fail(mapDbError(error));
  refresh();
  return ok({ id: data.id, startedAt: data.started_at });
}

export async function stopTimer(entryId?: string): Promise<ActionResult<{ seconds: number | null }>> {
  if (entryId !== undefined && !z.uuid().safeParse(entryId).success) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stop_timer", entryId ? { p_entry: entryId } : {});
  if (error) return fail(mapDbError(error));
  refresh();
  return ok({ seconds: data?.[0]?.duration_seconds ?? null });
}

export async function addTimeEntry(input: ManualEntryInput): Promise<ActionResult<{ id: string }>> {
  const parsed = manualEntrySchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;
  const viewer = await requireViewer();
  const range = rangeFromWallClock(v.date, v.start, v.end, viewer.timezone);
  if (!range) return fail({ code: "validation", message: "Check the date and times." });
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("add_time_entry", {
      p_task: v.taskId,
      p_started_at: range.startedAt,
      p_ended_at: range.endedAt,
      p_note: v.note ?? undefined,
      p_request_id: v.requestId,
    })
    .single();
  if (error || !data) return fail(mapDbError(error));
  refresh();
  return ok({ id: data.id });
}

export async function correctTimeEntry(input: CorrectionInput): Promise<ActionResult<{ version: number }>> {
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;
  const viewer = await requireViewer();
  const range = rangeFromWallClock(v.date, v.start, v.end, viewer.timezone);
  if (!range) return fail({ code: "validation", message: "Check the date and times." });
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("correct_time_entry", {
      p_entry: v.entryId,
      p_expected_version: v.version,
      p_started_at: range.startedAt,
      p_ended_at: range.endedAt,
      p_note: v.note ?? undefined,
    })
    .single();
  if (error || !data) return fail(mapDbError(error));
  refresh();
  return ok({ version: data.version });
}

export async function deleteTimeEntry(entryId: string, version: number): Promise<ActionResult> {
  if (!z.uuid().safeParse(entryId).success || !Number.isInteger(version)) {
    return fail({ code: "forbidden", message: NOT_AVAILABLE });
  }
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_time_entry", { p_entry: entryId, p_expected_version: version });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(undefined);
}
