// Writes .env.local from the running LOCAL Supabase stack (`npm run db:start` first).
// Values are the local development defaults printed by `supabase status`; never production keys.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

const out = execFileSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8" });
const get = (k) => out.match(new RegExp(`^${k}="?([^"\\n]+)"?$`, "m"))?.[1];
const url = get("API_URL");
const publishable = get("PUBLISHABLE_KEY");
const secret = get("SECRET_KEY");
if (!url || !publishable || !secret) {
  console.error("Could not read local Supabase status. Is `npm run db:start` running?");
  process.exit(1);
}
if (existsSync(".env.local") && !process.argv.includes("--force")) {
  console.error(".env.local already exists. Re-run with --force to overwrite it.");
  process.exit(1);
}
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}\nSUPABASE_SECRET_KEY=${secret}\nAPP_URL=http://localhost:3000\n`,
);
console.log("Wrote .env.local for the local Supabase stack.");
