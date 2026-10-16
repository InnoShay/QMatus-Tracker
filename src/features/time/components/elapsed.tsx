"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/time";

/**
 * Elapsed time of a running timer, derived from the server's start timestamp.
 * The browser clock is only used to advance the display: the offset between
 * server and browser is measured once, so a wrong local clock doesn't skew it.
 * Nothing here is persisted; closing the tab loses nothing.
 */
export function Elapsed({ startedAt, serverNow, className }: { startedAt: string; serverNow: string; className?: string }) {
  const start = new Date(startedAt).getTime();
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  useEffect(() => {
    const offset = new Date(serverNow).getTime() - Date.now();
    const id = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(id);
  }, [serverNow]);
  return (
    <time role="timer" dateTime={startedAt} className={className}>
      {formatClock((now - start) / 1000)}
    </time>
  );
}
