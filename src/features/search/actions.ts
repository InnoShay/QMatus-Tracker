"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/server/auth/viewer";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { toHit, type SearchHit } from "./hits";

/**
 * Scoped search. `search_workspace` is SECURITY INVOKER, so every branch is
 * filtered by the caller's RLS before anything is returned.
 */
export async function searchWorkspace(query: string): Promise<ActionResult<SearchHit[]>> {
  const q = z.string().trim().min(2).max(100).safeParse(query);
  if (!q.success) return ok([]);
  const viewer = await requireViewer();
  if (!rateLimit(await clientKey("search", viewer.id), 60, 60_000)) {
    return fail({ code: "rate_limited", message: "Searching too quickly. Pause for a moment." });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_workspace", { p_query: q.data, p_limit: 8 });
  if (error) return fail({ code: "unknown", message: "Search is unavailable right now." });
  return ok((data ?? []).map(toHit));
}
