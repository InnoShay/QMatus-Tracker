"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { THEME_COOKIE } from "@/lib/theme";
import { createInvitedIdentity } from "@/server/privileged/admin";
import { serverEnv } from "@/server/env";
import { clientKey, isLimited, rateLimit, recordHit } from "@/server/rate-limit";
import { hashInviteToken, isWellFormedToken, safeNextPath } from "./tokens";

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const signInSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }).max(254),
  password: z.string().min(1, "Enter your password.").max(200),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const { email, password } = parsed.data;

  // Only failed attempts count, so people who sign in often are never locked out.
  const limitKey = await clientKey("sign-in", email);
  if (isLimited(limitKey, 8)) {
    return { error: "Too many failed attempts. Wait a few minutes, then try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password });
  if (error) {
    recordHit(limitKey, 15 * 60_000);
    // Same message for unknown email, wrong password and disabled accounts.
    return { error: "That email and password combination didn't work." };
  }

  const { data: profile } = await supabase.from("profiles").select("theme").maybeSingle();
  if (profile?.theme) {
    (await cookies()).set(THEME_COOKIE, profile.theme, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

const acceptSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(80),
    password: z.string().min(12, "Use at least 12 characters.").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

/** New invitee: create the identity, sign in, then consume the invitation atomically. */
export async function acceptInviteAsNewUser(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!isWellFormedToken(token)) return { error: "This invitation link isn't valid." };
  if (!rateLimit(await clientKey("invite"), 10, 15 * 60_000)) {
    return { error: "Too many attempts. Wait a few minutes, then try again." };
  }
  const parsed = acceptSchema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }

  const hash = hashInviteToken(token);
  const supabase = await createClient();
  const { data: peek } = await supabase.rpc("peek_invitation", { p_token_hash: hash });
  const invite = peek?.[0];
  if (!invite || invite.state !== "valid" || !invite.email) {
    return { error: "This invitation is no longer valid. Ask the person who invited you for a new link." };
  }

  const created = await createInvitedIdentity({
    email: invite.email,
    password: parsed.data.password,
    displayName: parsed.data.name,
  });
  if (!created.ok) {
    return created.reason === "exists"
      ? { error: "An account already exists for this email. Sign in first, then open this invitation link again." }
      : { error: "We couldn't create your account. Try again in a moment." };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password: parsed.data.password });
  if (signInError) return { error: "Your account was created, but signing in failed. Try signing in." };

  const { error } = await supabase.rpc("accept_invitation", { p_token_hash: hash });
  if (error) return { error: "This invitation is no longer valid. Ask the person who invited you for a new link." };
  redirect("/my-work");
}

/** Existing account (already signed in with the invited email). */
export async function acceptInviteAsSignedIn(token: string): Promise<FormState> {
  if (!isWellFormedToken(token)) return { error: "This invitation link isn't valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token_hash: hashInviteToken(token) });
  if (error) {
    return { error: "This invitation can't be accepted with the account you're signed in to." };
  }
  redirect("/my-work");
}

const resetRequestSchema = z.object({ email: z.email({ message: "Enter a valid email address." }).max(254) });

/** Always the same answer, so the form can't be used to discover accounts. */
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState & { sent?: boolean }> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0].message } };
  if (!rateLimit(await clientKey("reset", parsed.data.email), 3, 60 * 60_000)) return { sent: true };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email.toLowerCase(), {
    redirectTo: `${serverEnv().APP_URL}/auth/callback?next=/reset-password`,
  });
  return { sent: true };
}

const newPasswordSchema = z
  .object({ password: z.string().min(12, "Use at least 12 characters.").max(200), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

export async function setNewPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "That password couldn't be saved. Open the reset link again, or choose a different password." };
  redirect("/my-work");
}
