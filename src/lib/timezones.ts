/**
 * Time zone options for pickers. The runtime's ICU list still uses some legacy
 * IANA ids (Node lists "Asia/Calcutta", not "Asia/Kolkata"), so ids are
 * modernised here and every option carries searchable words: city, region,
 * the long zone name ("India Standard Time"), the GMT offset and common
 * abbreviations.
 */

/** Legacy id → current IANA id. Both are valid for Intl; we store the current one. */
const MODERN: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Godthab": "America/Nuuk",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Enderbury": "Pacific/Kanton",
};

/** Extra words people search for that the zone data doesn't contain. */
const KEYWORDS: Record<string, string> = {
  "Asia/Kolkata": "India IST Mumbai Delhi New Delhi Bengaluru Bangalore Chennai Hyderabad Pune",
  "Asia/Dubai": "UAE Gulf GST Abu Dhabi",
  "Asia/Singapore": "SGT",
  "Asia/Tokyo": "Japan JST",
  "Asia/Shanghai": "China Beijing CST",
  "Asia/Hong_Kong": "HKT",
  "Asia/Karachi": "Pakistan PKT",
  "Asia/Dhaka": "Bangladesh",
  "Asia/Kathmandu": "Nepal",
  "Asia/Colombo": "Sri Lanka",
  "Europe/London": "UK Britain England GMT BST",
  "Europe/Berlin": "Germany CET CEST",
  "Europe/Paris": "France CET CEST",
  "America/New_York": "US USA Eastern EST EDT",
  "America/Chicago": "US USA Central CST CDT",
  "America/Denver": "US USA Mountain MST MDT",
  "America/Los_Angeles": "US USA Pacific PST PDT San Francisco",
  "America/Toronto": "Canada Eastern",
  "Australia/Sydney": "AEST AEDT",
  UTC: "Coordinated Universal Time GMT Zulu",
};

export type ZoneOption = {
  id: string;
  /** City (or the id itself for UTC). */
  city: string;
  /** Region part of the id, e.g. "Asia". */
  region: string;
  /** e.g. "India Standard Time". */
  longName: string;
  /** e.g. "GMT+05:30". */
  offset: string;
  offsetMinutes: number;
  /** Lower-cased haystack for search. */
  search: string;
  /** Lower-cased curated words (country, abbreviations); a hit here ranks higher. */
  tags: string;
};

export function modernZone(id: string): string {
  return MODERN[id] ?? id;
}

function offsetOf(id: string, now: Date): { offset: string; minutes: number } {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: id, timeZoneName: "longOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value;
  const offset = !part || part === "GMT" ? "GMT+00:00" : part;
  const m = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return { offset, minutes };
}

function longNameOf(id: string, now: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: id, timeZoneName: "long" }).formatToParts(now).find((p) => p.type === "timeZoneName")
      ?.value ?? id
  );
}

/** All supported zones (plus `include`), modern ids, sorted by offset then city. */
export function listTimeZones(include: string[] = [], now: Date = new Date()): ZoneOption[] {
  const ids = new Set<string>(["UTC"]);
  for (const z of [...Intl.supportedValuesOf("timeZone"), ...include]) ids.add(modernZone(z));
  const out: ZoneOption[] = [];
  for (const id of ids) {
    try {
      const { offset, minutes } = offsetOf(id, now);
      const longName = longNameOf(id, now);
      const [region, ...rest] = id.split("/");
      const city = (rest.length ? rest[rest.length - 1] : region).replaceAll("_", " ");
      const short = offset.replace(/^GMT([+-])0?(\d+):00$/, "GMT$1$2").replace(/^GMT([+-])0?(\d+):(\d{2})$/, "GMT$1$2:$3");
      const search = [id, id.replaceAll("_", " "), city, region, longName, offset, short, short.replace("GMT", ""), KEYWORDS[id] ?? ""]
        .join(" ")
        .toLowerCase();
      const tags = `${city} ${KEYWORDS[id] ?? ""}`.toLowerCase();
      out.push({
        id,
        city,
        region: rest.length ? region.replaceAll("_", " ") : "",
        longName,
        offset,
        offsetMinutes: minutes,
        search,
        tags,
      });
    } catch {
      /* an id this runtime can't format is skipped */
    }
  }
  return out.sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city));
}

/** Matches every whitespace-separated term, in any order ("india", "+5:30", "ist"). */
export function matchZone(z: ZoneOption, query: string): boolean {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return terms.every((t) => z.search.includes(t));
}

/**
 * Filters and ranks: a term that is a whole word ("india") beats a word prefix
 * ("indiana"), which beats a substring. Ties keep offset order.
 */
export function searchZones(zones: ZoneOption[], query: string): ZoneOption[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return zones;
  const scored: { z: ZoneOption; score: number; i: number }[] = [];
  zones.forEach((z, i) => {
    const words = z.search.split(/[\s/]+/);
    let score = 0;
    for (const t of terms) {
      if (!z.search.includes(t)) return;
      score += words.includes(t) ? 3 : words.some((w) => w.startsWith(t)) ? 2 : 1;
      if (z.tags.split(" ").includes(t)) score += 2;
    }
    scored.push({ z, score, i });
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.z);
}
