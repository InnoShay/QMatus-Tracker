/**
 * One-time workspace bootstrap (spec §7.1: no unauthenticated "become admin" route).
 *
 *   npm run bootstrap -- --owner-email you@company.com --owner-name "Your Name" [--org "QMatus"]
 *
 * Creates the organization, the two launch teams (Main Team, Developer Team)
 * and the owner's auth identity, then prints a password-setup link. Needs
 * SUPABASE_SECRET_KEY in the environment of the machine running it; it is
 * never part of the web app.
 *
 * Safe to re-run after a failure: when a workspace exists but its launch setup
 * is incomplete AND the given email is that workspace's owner, the missing
 * pieces are created. Any other existing workspace is refused, so this can
 * never be used to take over or extend a workspace someone else owns.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { parseArgs } from "node:util";
import type { Database } from "../src/types/db";

config({ path: process.env.ENV_FILE ?? ".env.local", quiet: true });

async function main() {
  const { values } = parseArgs({
    options: {
      "owner-email": { type: "string" },
      "owner-name": { type: "string" },
      org: { type: "string", default: "QMatus" },
    },
  });
  const email = values["owner-email"]?.trim().toLowerCase();
  const name = values["owner-name"]?.trim();
  if (!email || !name) throw new Error('Usage: npm run bootstrap -- --owner-email you@company.com --owner-name "Your Name"');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const appUrl = process.env.APP_URL;
  if (!url || !secret || !appUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and APP_URL must be set.");

  const svc = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const must = (r: { error: { message: string } | null }, what: string) => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
  };

  const { data: orgs, error: orgsError } = await svc.from("organizations").select("id").limit(2);
  if (orgsError) throw new Error(`Could not read the workspace: ${orgsError.message}`);
  const { data: existingProfile } = await svc.from("profiles").select("id").eq("email", email).maybeSingle();

  let orgId: string;
  let ownerId: string;
  if (!orgs?.length) {
    // Owner identity without a password; they set one through the recovery link.
    if (existingProfile) {
      ownerId = existingProfile.id;
    } else {
      const { data: created, error: userError } = await svc.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: name },
      });
      if (userError) throw new Error(`Could not create the owner: ${userError.message}`);
      ownerId = created.user.id;
    }
    const { data: org, error: orgError } = await svc
      .from("organizations")
      .insert({ name: values.org!, slug: "qmatus" })
      .select("id")
      .single();
    if (orgError || !org) throw new Error(`Could not create the organization: ${orgError?.message}`);
    orgId = org.id;
    must(await svc.from("organization_memberships").insert({ org_id: orgId, profile_id: ownerId, role: "owner" }), "owner membership");
  } else {
    // Resume only an incomplete bootstrap, and only for the same owner.
    const refuse = "A workspace already exists. Bootstrap only runs once.";
    if (orgs.length > 1 || !existingProfile) throw new Error(refuse);
    orgId = orgs[0].id;
    ownerId = existingProfile.id;
    const { data: ownership } = await svc
      .from("organization_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("profile_id", ownerId)
      .maybeSingle();
    if (ownership?.role !== "owner") throw new Error(refuse);
    const { data: done } = await svc
      .from("team_memberships")
      .select("team_id, teams!inner(slug)")
      .eq("profile_id", ownerId)
      .eq("teams.slug", "main");
    const { data: launchTeams } = await svc.from("teams").select("slug").eq("org_id", orgId).in("slug", ["main", "dev"]);
    if (done?.length && launchTeams?.length === 2) throw new Error(refuse);
    console.log("Resuming an incomplete workspace setup for this owner.");
  }

  // Launch teams, one insert each so every column is explicit (a multi-row
  // insert with differing keys sends null for the missing ones).
  const LAUNCH_TEAMS = [
    {
      name: "Main Team",
      slug: "main",
      issue_prefix: "MAIN",
      description: "Founders' planning, decisions and company work.",
      accepts_requests: false,
    },
    {
      name: "Developer Team",
      slug: "dev",
      issue_prefix: "DEV",
      description: "Product engineering.",
      accepts_requests: true,
    },
  ] as const;
  const teamIds: Record<string, string> = {};
  for (const team of LAUNCH_TEAMS) {
    const { data: found } = await svc.from("teams").select("id").eq("org_id", orgId).eq("slug", team.slug).maybeSingle();
    if (found) {
      teamIds[team.slug] = found.id;
      continue;
    }
    const { data: created, error } = await svc
      .from("teams")
      .insert({ org_id: orgId, ...team })
      .select("id")
      .single();
    if (error || !created) throw new Error(`Could not create ${team.name}: ${error?.message}`);
    teamIds[team.slug] = created.id;
  }

  // The owner joins the founders' team only. Developer access is a separate decision.
  const { data: lead } = await svc
    .from("team_memberships")
    .select("profile_id")
    .eq("team_id", teamIds.main)
    .eq("profile_id", ownerId)
    .maybeSingle();
  if (!lead) {
    must(
      await svc.from("team_memberships").insert({ org_id: orgId, team_id: teamIds.main, profile_id: ownerId, role: "lead" }),
      "owner team membership",
    );
  }
  const { data: logged } = await svc.from("audit_events").select("id").eq("org_id", orgId).eq("action", "workspace.bootstrapped").limit(1);
  if (!logged?.length) {
    must(
      await svc
        .from("audit_events")
        .insert({ org_id: orgId, actor_id: null, action: "workspace.bootstrapped", target_type: "profile", target_id: ownerId }),
      "audit",
    );
  }

  const { data: link, error: linkError } = await svc.auth.admin.generateLink({ type: "recovery", email });
  if (linkError) throw new Error(`Workspace created, but the password link failed: ${linkError.message}`);
  console.log("Workspace created.");
  console.log(`Send this one-time password-setup link to ${email} privately:`);
  // Lands on the app's own token verification route, which signs them in to set a password.
  const params = new URLSearchParams({ token_hash: link.properties.hashed_token, type: "recovery", next: "/reset-password" });
  console.log(`${appUrl}/auth/confirm?${params.toString()}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
