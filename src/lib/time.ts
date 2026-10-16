/**
 * Time-tracking helpers. Entries are stored as UTC instants; the viewer's
 * profile time zone decides how they are entered and which day they belong to.
 * An entry belongs to the day it started on (it is never split at midnight).
 */

/** "1h 05m", "25m", "0m". Seconds are dropped; durations are never negative. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Running clock: "0:04:09", "12:00:31". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsIn(instant: number, timeZone: string): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const get = (type: string) => Number(f.formatToParts(new Date(instant)).find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function safeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
function offsetAt(instant: number, timeZone: string): number {
  const p = partsIn(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Wall-clock date ("YYYY-MM-DD") and time ("HH:MM") in `timeZone` → UTC ISO.
 * Returns null for malformed input. A wall time skipped by a DST change
 * resolves to the instant just after the gap.
 */
export function zonedToUtc(date: string, time: string, timeZone: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm) return null;
  const [y, mo, d, h, mi] = [+dm[1], +dm[2], +dm[3], +tm[1], +tm[2]];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const zone = safeZone(timeZone);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  if (new Date(wall).getUTCDate() !== d) return null;
  // Two passes settle the offset across DST boundaries.
  let guess = wall - offsetAt(wall, zone);
  guess = wall - offsetAt(guess, zone);
  return new Date(guess).toISOString();
}

/** UTC ISO → wall-clock { date: "YYYY-MM-DD", time: "HH:MM" } in `timeZone`. */
export function utcToZoned(iso: string, timeZone: string): { date: string; time: string } {
  const p = partsIn(new Date(iso).getTime(), safeZone(timeZone));
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

/**
 * Manual entry from a day plus start/end wall times. An end time at or before
 * the start means the entry ran past midnight into the next day.
 */
export function rangeFromWallClock(
  date: string,
  start: string,
  end: string,
  timeZone: string,
): { startedAt: string; endedAt: string } | null {
  const startedAt = zonedToUtc(date, start, timeZone);
  if (!startedAt) return null;
  let endedAt = zonedToUtc(date, end, timeZone);
  if (!endedAt) return null;
  if (end <= start) {
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    endedAt = zonedToUtc(next.toISOString().slice(0, 10), end, timeZone);
    if (!endedAt) return null;
  }
  return { startedAt, endedAt };
}

/** Entries running longer than this are flagged for the owner to check. */
export const LONG_ENTRY_SECONDS = 12 * 3600;
