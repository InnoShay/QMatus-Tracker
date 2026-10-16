import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/server/env";

/**
 * THE ONLY elevated credential path in the app (spec §10.2, §12.3).
 *
 * Exposes exactly two narrow operations, each requiring the caller to have
 * already authorized the action under RLS. Do not add general CRUD here, and
 * do not export the client itself.
 */
function adminClient() {
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Creates the auth identity for a validated, pending invitation. The caller
 * must have checked the invitation token with `peek_invitation` first; the
 * membership itself is granted afterwards by `accept_invitation` running as
 * the new user, which re-validates the token atomically.
 */
export async function createInvitedIdentity(input: { email: string; password: string; displayName: string }) {
  const { data, error } = await adminClient().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  });
  if (error) {
    return { ok: false as const, reason: error.message.includes("already") ? "exists" : "failed" };
  }
  return { ok: true as const, userId: data.user.id };
}

/**
 * Signs a suspended account out of every session. App authorization already
 * denies the account on the next request via `member_state`; this closes the
 * provider sessions too. Caller must have completed `admin_set_member_state`.
 */
export async function revokeAllSessions(userId: string, suspend: boolean) {
  const admin = adminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: suspend ? "876000h" : "none",
  });
  return { ok: !error };
}
