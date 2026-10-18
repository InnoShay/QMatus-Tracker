import { describe, expect, it } from "vitest";
import { listTimeZones, matchZone, modernZone, searchZones } from "@/lib/timezones";

const zones = listTimeZones();
const find = (q: string) => zones.filter((z) => matchZone(z, q)).map((z) => z.id);

describe("time zone options", () => {
  it("uses modern ids, never the runtime's legacy ones", () => {
    const ids = zones.map((z) => z.id);
    expect(ids).toContain("Asia/Kolkata");
    expect(ids).not.toContain("Asia/Calcutta");
    expect(ids).toContain("Europe/Kyiv");
    expect(modernZone("Asia/Calcutta")).toBe("Asia/Kolkata");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("finds India by country, abbreviation, city and offset", () => {
    for (const q of ["india", "IST", "kolkata", "mumbai", "+5:30", "india standard"]) {
      expect(find(q), q).toContain("Asia/Kolkata");
    }
  });

  it("labels zones with a readable name and offset", () => {
    const india = zones.find((z) => z.id === "Asia/Kolkata")!;
    expect(india.city).toBe("Kolkata");
    expect(india.longName).toBe("India Standard Time");
    expect(india.offset).toBe("GMT+05:30");
    expect(zones.find((z) => z.id === "UTC")!.offset).toBe("GMT+00:00");
  });

  it("keeps an unknown stored zone selectable and sorts by offset", () => {
    expect(listTimeZones(["Asia/Calcutta"]).filter((z) => z.id === "Asia/Kolkata")).toHaveLength(1);
    const offsets = zones.map((z) => z.offsetMinutes);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  it("ranks whole-word matches first, so India beats Indiana", () => {
    for (const q of ["india", "ist", "kolkata"]) expect(searchZones(zones, q)[0].id, q).toBe("Asia/Kolkata");
    expect(searchZones(zones, "")).toHaveLength(zones.length);
  });
});
