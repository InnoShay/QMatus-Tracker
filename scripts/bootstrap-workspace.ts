/**
 * One-time workspace bootstrap (spec §7.1: no unauthenticated "become admin" route).
 *
 *   npm run bootstrap -- --owner-email you@company.com --owner-name "Your Name" [--org "QMatus"]
 *
 * Creates the organization, the two launch teams (Main Team, Developer Team)
 * and the owner's auth identity, then prints a password-setup link. Refuses to
 * run if a workspace already exists. Needs SUPABASE_SECRET_KEY in the
 * environment of the machine running it; it is never part of the web app.
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
  const { data: existing } = await svc.from("organizations").select("id").limit(1);
  if (existing?.length) throw new Error("A workspace already exists. Bootstrap only runs once.");

  // Owner identity without a password; they set one through the recovery link.
  const { data: created, error: userError } = await svc.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (userError) throw new Error(`Could not create the owner: ${userError.message}`);
  const ownerId = created.user.id;

  const { data: org, error: orgError } = await svc
    .from("organizations")
    .insert({ name: values.org!, slug: "qmatus" })
    .select("id")
    .single();
  if (orgError || !org) throw new Error(`Could not create the organization: ${orgError?.message}`);
  const must = (r: { error: { message: string } | null }, what: string) => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
  };
  must(await svc.from("organization_memberships").insert({ org_id: org.id, profile_id: ownerId, role: "owner" }), "owner membership");
  const { data: teams, error: teamError } = await svc
    .from("teams")
    .insert([
      {
        org_id: org.id,
        name: "Main Team",
        slug: "main",
        issue_prefix: "MAIN",
        description: "Founders' planning, decisions and company work.",
      },
      {
        org_id: org.id,
        name: "Developer Team",
        slug: "dev",
        issue_prefix: "DEV",
        description: "Product engineering.",
        accepts_requests: true,
      },
    ])
    .select("id, slug");
  if (teamError || !teams) throw new Error(`Could not create teams: ${teamError?.message}`);
  // The owner joins the founders' team only. Developer access is a separate decision.
  must(
    await svc
      .from("team_memberships")
      .insert({ org_id: org.id, team_id: teams.find((t) => t.slug === "main")!.id, profile_id: ownerId, role: "lead" }),
    "owner team membership",
  );
  must(
    await svc
      .from("audit_events")
      .insert({ org_id: org.id, actor_id: null, action: "workspace.bootstrapped", target_type: "profile", target_id: ownerId }),
    "audit",
  );

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
