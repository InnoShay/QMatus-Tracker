"use client";

import { formatRelative } from "@/lib/dates";

/**
 * "3 min ago" inside a client component. Server and browser render it at
 * slightly different instants, so the text can legitimately differ by a minute
 * at hydration; React is told to keep the client's value for this node only.
 */
export function RelativeTime({ iso, timeZone }: { iso: string; timeZone: string }) {
  return <span suppressHydrationWarning>{formatRelative(iso, timeZone)}</span>;
}
