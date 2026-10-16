import { createClient } from "@supabase/supabase-js";
import { DEV_PASSWORD, USERS, type UserKey } from "../../scripts/fixtures";
import { requireLocal, serviceClient, userClient, type Db } from "../../scripts/lib";
import type { Database } from "../../src/types/db";

const cache = new Map<UserKey, Db>();

/** Signed-in client for a fixture identity. RLS applies exactly as in the app. */
export async function as(user: UserKey): Promise<Db> {
  const hit = cache.get(user);
  if (hit) return hit;
  const client = await userClient(USERS[user].email, DEV_PASSWORD);
  cache.set(user, client);
  return client;
}

export function anon(): Db {
  const { url, publishable } = requireLocal();
  return createClient<Database>(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
}

export { serviceClient };

export type World = {
  teams: { main: string; dev: string };
  ids: Record<UserKey, string>;
  statuses: { dev: Record<string, string>; main: Record<string, string> };
};

let world: World | null = null;

/** Resolves fixture IDs once via the service role (test setup only). */
export async function getWorld(): Promise<World> {
  if (world) return world;
  const svc = serviceClient();
  const { data: teams, error } = await svc.from("teams").select("id, slug");
  if (error || !teams?.length) {
    throw new Error("Seed data missing. Run `npm run db:reset && npm run db:seed` before `npm run test:db`.");
  }
  const { data: profiles } = await svc.from("profiles").select("id, email");
  const ids = Object.fromEntries(
    (Object.keys(USERS) as UserKey[]).map((k) => [k, profiles!.find((p) => p.email === USERS[k].email)!.id]),
  ) as Record<UserKey, string>;
  const main = teams.find((t) => t.slug === "main")!.id;
  const dev = teams.find((t) => t.slug === "dev")!.id;
  const { data: st } = await svc.from("task_statuses").select("id, key, team_id");
  const pick = (team: string) => Object.fromEntries(st!.filter((s) => s.team_id === team).map((s) => [s.key, s.id]));
  world = { teams: { main, dev }, ids, statuses: { dev: pick(dev), main: pick(main) } };
  return world;
}

export function marker(label: string): string {
  return `MARKER-${label}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

/** Asserts a value's JSON form never contains the marker string. */
export function serialized(value: unknown): string {
  return JSON.stringify(value ?? null);
}
