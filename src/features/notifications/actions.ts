"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapDbError, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/server/auth/viewer";

export async function setRead(ids: number[], read: boolean): Promise<ActionResult<null>> {
  const parsed = z.array(z.number().int().positive()).max(500).safeParse(ids);
  if (!parsed.success) return fail({ code: "validation", message: "Invalid selection." });
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("recipient_id", viewer.id)
    .in("id", parsed.data);
  if (error) return fail(mapDbError(error));
  revalidatePath("/", "layout");
  return ok(null);
}

export async function markAllRead(): Promise<ActionResult<null>> {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", viewer.id)
    .is("read_at", null);
  if (error) return fail(mapDbError(error));
  revalidatePath("/", "layout");
  return ok(null);
}
