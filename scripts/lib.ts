import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "../src/types/db";

config({ path: ".env.local", quiet: true });

export type Db = SupabaseClient<Database>;

export function requireLocal(): { url: string; publishable: string; secret: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishable || !secret) {
    throw new Error("Missing Supabase env. Run `npm run db:env` after `npm run db:start`.");
  }
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(`Refusing to run against non-local Supabase host "${host}".`);
  }
  return { url, publishable, secret };
}

export function serviceClient(): Db {
  const { url, secret } = requireLocal();
  return createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function userClient(email: string, password: string): Promise<Db> {
  const { url, publishable } = requireLocal();
  const client = createClient<Database>(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

export function must<T>(result: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as NonNullable<T>;
}

export function isoDate(daysFromToday: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}
