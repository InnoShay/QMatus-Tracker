import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 256-bit invitation secret, URL-safe. Only its SHA-256 is stored. */
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** Only same-origin relative paths are accepted as post-login destinations. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/my-work";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/my-work";
  return value.slice(0, 512);
}
