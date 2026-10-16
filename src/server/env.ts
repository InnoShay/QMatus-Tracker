import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20, "SUPABASE_SECRET_KEY is missing (server-only)"),
  APP_URL: z.url({ message: "APP_URL must be the public origin, e.g. http://localhost:3000" }),
});

let cached: z.infer<typeof schema> | null = null;

/** Server-only secrets. Importing this from client code fails the build. */
export function serverEnv() {
  if (cached) return cached;
  const parsed = schema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    APP_URL: process.env.APP_URL,
  });
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  }
  cached = parsed.data;
  return cached;
}
