"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapDbError, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/server/auth/viewer";

const bulkSchema = z.object({
  items: z
    .array(z.object({ id: z.uuid(), key: z.string().max(20), version: z.number().int().positive() }))
    .min(1)
    .max(100),
  op: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("status"), statusId: z.uuid() }),
    z.object({ kind: z.literal("assignee"), assigneeId: z.union([z.uuid(), z.null()]) }),
    z.object({ kind: z.literal("priority"), priority: z.enum(["none", "low", "medium", "high", "urgent"]) }),
  ]),
});

export type BulkResult = { succeeded: string[]; failed: { key: string; reason: string }[] };

/**
 * Applies one change to many tasks. Each row is authorized and validated on
 * its own by RLS/triggers; partial failures are reported, never hidden.
 */
export async function bulkUpdateTasks(input: z.input<typeof bulkSchema>): Promise<ActionResult<BulkResult>> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return fail({ code: "validation", message: "That bulk change isn't valid." });
  await requireViewer();
  const supabase = await createClient();
  const { items, op } = parsed.data;
  const result: BulkResult = { succeeded: [], failed: [] };

  for (const item of items) {
    let error: { code?: string; message?: string } | null = null;
    let touched = true;
    if (op.kind === "status") {
      const res = await supabase.rpc("move_task", { p_task: item.id, p_status: op.statusId, p_expected_version: item.version });
      error = res.error;
    } else {
      const patch = op.kind === "assignee" ? { assignee_id: op.assigneeId } : { priority: op.priority };
      const res = await supabase.from("tasks").update(patch).eq("id", item.id).eq("version", item.version).select("id");
      error = res.error;
      touched = !!res.data?.length;
    }
    if (error) result.failed.push({ key: item.key, reason: mapDbError(error).message });
    else if (!touched) result.failed.push({ key: item.key, reason: "It changed since you loaded the list." });
    else result.succeeded.push(item.key);
  }
  revalidatePath("/", "layout");
  return ok(result);
}
