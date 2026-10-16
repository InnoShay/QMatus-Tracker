import "server-only";
import { headers } from "next/headers";

/**
 * Fixed-window, in-memory rate limiter. Protects a single instance against
 * brute force and spam. A multi-instance deployment must swap this for a
 * shared store (documented in docs/SECURITY_MODEL.md); the call sites stay the same.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function clientKey(scope: string, extra = ""): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${scope}:${ip}:${extra.toLowerCase()}`;
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** True when the key has already used up its allowance (does not count this call). */
export function isLimited(key: string, limit: number): boolean {
  const bucket = buckets.get(key);
  return !!bucket && bucket.resetAt > Date.now() && bucket.count >= limit;
}

/** Records one failure-type event, e.g. a wrong password. */
export function recordHit(key: string, windowMs: number): void {
  rateLimit(key, Number.MAX_SAFE_INTEGER, windowMs);
}
