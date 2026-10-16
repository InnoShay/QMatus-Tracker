"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapDbError, ok, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { THEME_COOKIE } from "@/lib/theme";
import { requireViewer } from "@/server/auth/viewer";

const themeSchema = z.enum(["system", "light", "dark"]);

/** Persists the theme to the profile and the pre-paint cookie. */
export async function setTheme(theme: string): Promise<ActionResult<null>> {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) return fail({ code: "validation", message: "Unknown theme." });
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ theme: parsed.data }).eq("id", viewer.id);
  (await cookies()).set(THEME_COOKIE, parsed.data, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  if (error) return fail(mapDbError(error, "Your theme changed here, but we couldn't save it to your profile."));
  return ok(null);
}

const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Enter your name.").max(80),
  title: z.string().trim().max(80).optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid time zone."),
});

export async function updateProfile(input: unknown): Promise<ActionResult<null>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return fail({
      code: "validation",
      message: "Check the highlighted fields.",
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
    });
  }
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.display_name, title: parsed.data.title || null, timezone: parsed.data.timezone })
    .eq("id", viewer.id);
  if (error) return fail(mapDbError(error));
  revalidatePath("/", "layout");
  return ok(null);
}
