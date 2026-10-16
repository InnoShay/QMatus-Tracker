/**
 * Typed results for server actions and services. Messages returned to the
 * client are user-safe: they never reveal whether a private resource exists.
 */
export type ActionError = {
  code: "unauthenticated" | "forbidden" | "validation" | "conflict" | "duplicate" | "rate_limited" | "unknown";
  message: string;
  fieldErrors?: Record<string, string>;
};

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: ActionError): ActionResult<never> => ({ ok: false, error });

export const NOT_AVAILABLE = "That item isn't available. It may have been moved, or you may not have access to it.";

type PgLikeError = { code?: string; message?: string } | null | undefined;

/** Messages raised by our own SQL functions are written to be user-safe. */
const SAFE_SQL_CODES = new Set(["22023", "23514", "23505", "40001"]);

export function mapDbError(error: PgLikeError, fallback = "Something went wrong. Please try again."): ActionError {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "42501" || code === "P0002" || code === "PGRST116") {
    return { code: "forbidden", message: NOT_AVAILABLE };
  }
  if (code === "40001") {
    return { code: "conflict", message: capitalise(message) || "This changed since you loaded it. Refresh and try again." };
  }
  if (code === "23505") {
    return { code: "duplicate", message: capitalise(message) || "That already exists." };
  }
  if (code === "23503") {
    return { code: "validation", message: "One of the selected items isn't available in this team." };
  }
  if (SAFE_SQL_CODES.has(code) && message && !message.includes("violates")) {
    return { code: "validation", message: capitalise(message) };
  }
  if (code === "23514") {
    return { code: "validation", message: "Those values aren't valid here." };
  }
  return { code: "unknown", message: fallback };
}

function capitalise(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : s;
}
