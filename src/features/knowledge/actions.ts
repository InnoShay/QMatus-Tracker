"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapDbError, NOT_AVAILABLE, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { findTeam, requireViewer } from "@/server/auth/viewer";
import { canWriteTeam } from "@/server/policies";

const tags = z
  .string()
  .max(200)
  .default("")
  .transform((v) =>
    v
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8),
  );

async function writableTeam(slug: string) {
  const viewer = await requireViewer();
  const team = findTeam(viewer, slug);
  return canWriteTeam(team) ? team! : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

const ideaSchema = z.object({
  title: z.string().trim().min(1, "Give the idea a short title.").max(160),
  body: z.string().trim().max(5000).optional().default(""),
  tags,
});

export async function captureIdea(teamSlug: string, input: z.input<typeof ideaSchema>): Promise<ActionResult<null>> {
  const parsed = ideaSchema.safeParse(input);
  if (!parsed.success) return fail({ code: "validation", message: parsed.error.issues[0].message });
  const team = await writableTeam(teamSlug);
  if (!team) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  const supabase = await createClient();
  const { error } = await supabase
    .from("parking_ideas")
    .insert({ team_id: team.id, title: parsed.data.title, body: parsed.data.body || null, tags: parsed.data.tags });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

export async function updateIdea(
  ideaId: string,
  patch: { state?: "captured" | "reviewing" | "archived"; pinned?: boolean },
): Promise<ActionResult<null>> {
  const p = z.object({ state: z.enum(["captured", "reviewing", "archived"]).optional(), pinned: z.boolean().optional() }).safeParse(patch);
  if (!p.success || !z.uuid().safeParse(ideaId).success) return fail({ code: "validation", message: "That change isn't valid." });
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.from("parking_ideas").update(p.data).eq("id", ideaId).neq("state", "promoted").select("id");
  if (error) return fail(mapDbError(error));
  if (!data?.length) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  refresh();
  return ok(null);
}

export async function promoteIdeaToTask(ideaId: string): Promise<ActionResult<{ key: string }>> {
  if (!z.uuid().safeParse(ideaId).success) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("promote_idea_to_task", { p_idea: ideaId });
  if (error || !data) return fail(mapDbError(error));
  const { data: task } = await supabase
    .from("tasks")
    .select("issue_key")
    .eq("id", data as unknown as string)
    .single();
  refresh();
  return ok({ key: task?.issue_key ?? "" });
}

/** Records that an idea became a Work Request the viewer submitted. */
export async function markIdeaPromotedToRequest(ideaId: string, requestId: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(ideaId).success || !z.uuid().safeParse(requestId).success)
    return fail({ code: "validation", message: "Invalid reference." });
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_idea_to_request", { p_idea: ideaId, p_request: requestId });
  if (error) return fail(mapDbError(error));
  refresh();
  return ok(null);
}

const libSchema = z.object({
  title: z.string().trim().min(1, "Give the reference a title.").max(160),
  kind: z.enum(["doc", "link", "image", "tool"]),
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    }, "Enter a full link starting with https://"),
  description: z.string().trim().max(1000).optional().default(""),
  tags,
});

export async function saveLibraryItem(
  teamSlug: string,
  itemId: string | null,
  input: z.input<typeof libSchema>,
): Promise<ActionResult<null>> {
  const parsed = libSchema.safeParse(input);
  if (!parsed.success) {
    return fail({
      code: "validation",
      message: "Check the highlighted fields.",
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
    });
  }
  const team = await writableTeam(teamSlug);
  if (!team) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  const v = parsed.data;
  const row = { title: v.title, kind: v.kind, url: v.url, description: v.description || null, tags: v.tags };
  const supabase = await createClient();
  const res = itemId
    ? await supabase.from("library_items").update(row).eq("id", itemId).select("id")
    : await supabase
        .from("library_items")
        .insert({ ...row, team_id: team.id })
        .select("id");
  if (res.error) return fail(mapDbError(res.error));
  if (!res.data?.length) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  refresh();
  return ok(null);
}

export async function archiveLibraryItem(itemId: string): Promise<ActionResult<null>> {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("library_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", itemId)
    .select("id");
  if (error) return fail(mapDbError(error));
  if (!data?.length) return fail({ code: "forbidden", message: NOT_AVAILABLE });
  refresh();
  return ok(null);
}
