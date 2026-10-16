import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, rangeFromWallClock, utcToZoned, zonedToUtc } from "@/lib/time";

describe("duration formatting", () => {
  it("formats totals and running clocks", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(25 * 60 + 59)).toBe("25m");
    expect(formatDuration(3600 + 5 * 60)).toBe("1h 05m");
    expect(formatDuration(-10)).toBe("0m");
    expect(formatClock(249)).toBe("0:04:09");
    expect(formatClock(12 * 3600 + 31)).toBe("12:00:31");
  });
});

describe("time zones", () => {
  it("converts wall-clock time in the profile zone to UTC and back", () => {
    expect(zonedToUtc("2026-10-16", "09:30", "Asia/Kolkata")).toBe("2026-10-16T04:00:00.000Z");
    expect(zonedToUtc("2026-10-16", "09:30", "UTC")).toBe("2026-10-16T09:30:00.000Z");
    expect(utcToZoned("2026-10-16T04:00:00.000Z", "Asia/Kolkata")).toEqual({ date: "2026-10-16", time: "09:30" });
  });

  it("handles daylight-saving transitions", () => {
    // New York: EDT (UTC-4) before Nov 1 2026, EST (UTC-5) after.
    expect(zonedToUtc("2026-10-31", "12:00", "America/New_York")).toBe("2026-10-31T16:00:00.000Z");
    expect(zonedToUtc("2026-11-02", "12:00", "America/New_York")).toBe("2026-11-02T17:00:00.000Z");
  });

  it("rejects malformed input and falls back to UTC for an unknown zone", () => {
    expect(zonedToUtc("2026-02-30", "10:00", "UTC")).toBeNull();
    expect(zonedToUtc("2026-10-16", "25:00", "UTC")).toBeNull();
    expect(zonedToUtc("2026-10-16", "10:00", "Not/AZone")).toBe("2026-10-16T10:00:00.000Z");
  });

  it("treats an end at or before the start as running past midnight", () => {
    expect(rangeFromWallClock("2026-10-16", "23:00", "01:30", "UTC")).toEqual({
      startedAt: "2026-10-16T23:00:00.000Z",
      endedAt: "2026-10-17T01:30:00.000Z",
    });
    expect(rangeFromWallClock("2026-10-16", "09:00", "10:15", "Asia/Kolkata")).toEqual({
      startedAt: "2026-10-16T03:30:00.000Z",
      endedAt: "2026-10-16T04:45:00.000Z",
    });
  });
});
