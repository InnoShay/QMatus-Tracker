import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Reads the tokens straight from globals.css so the test tracks the real values.
 * Tokens are written once as light-dark(light, dark), optionally built from the
 * brand variables with color-mix(in oklab, …); this resolves both sides to hex.
 */
const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const rootStart = css.indexOf(":root {");
const rootBody = css.slice(css.indexOf("{", rootStart) + 1, css.indexOf("\n}", rootStart));
const raw: Record<string, string> = Object.fromEntries(
  rootBody
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map((d) => d.trim().match(/^--([\w-]+):\s*([\s\S]+)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [m[1], m[2].replace(/\s+/g, " ").trim()]),
);

function splitArgs(inner: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function hexToOklab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToHex([L, A, B]: [number, number, number]): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    rgb
      .map((c) =>
        Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function resolve(value: string, side: 0 | 1): string {
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const fn = v.match(/^([\w-]+)\(([\s\S]*)\)$/);
  if (!fn) throw new Error(`Unsupported token value: ${v}`);
  const [, name, inner] = fn;
  if (name === "var") return resolve(raw[inner.trim().replace(/^--/, "")], side);
  if (name === "light-dark") return resolve(splitArgs(inner)[side], side);
  if (name === "color-mix") {
    const [, first, second] = splitArgs(inner);
    const pct = first.match(/\s(\d+(?:\.\d+)?)%$/);
    const p = pct ? Number(pct[1]) / 100 : 0.5;
    const a = hexToOklab(resolve(first.replace(/\s\d+(?:\.\d+)?%$/, ""), side));
    const b = hexToOklab(resolve(second, side));
    return oklabToHex([0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)) as [number, number, number]);
  }
  throw new Error(`Unsupported function ${name}`);
}

function theme(side: 0 | 1): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    try {
      out[k] = resolve(v, side);
    } catch {
      /* non-colour tokens (shadows, easing, durations) are not part of this check */
    }
  }
  return out;
}
const light = theme(0);
const dark = theme(1);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ["text-primary", "app-bg"],
  ["text-primary", "surface"],
  ["text-secondary", "surface"],
  ["text-secondary", "surface-subtle"],
  ["text-tertiary", "surface"],
  ["text-tertiary", "surface-subtle"],
  ["text-tertiary", "surface-selected"],
  ["text-tertiary", "app-bg"],
  ["text-secondary", "rail"],
  ["accent", "surface"],
  ["accent", "surface-selected"],
  ["action-fg", "action-bg"],
  ["danger-fg", "danger-bg"],
  ["warning-fg", "warning-bg"],
  ["success-fg", "success-bg"],
  ["st-backlog-fg", "st-backlog-bg"],
  ["st-ready-fg", "st-ready-bg"],
  ["st-progress-fg", "st-progress-bg"],
  ["st-review-fg", "st-review-bg"],
  ["st-done-fg", "st-done-bg"],
  ["st-blocked-fg", "st-blocked-bg"],
  ["violet-fg", "violet-bg"],
  ["sky-fg", "sky-bg"],
  ["on-ember", "ember-strong"],
  ["ember-ink", "surface"],
  ["ember-ink", "ember-soft"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme tokens (WCAG 2.2 AA)", (_name, t) => {
  it.each(TEXT_PAIRS)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it("focus ring and control borders meet 3:1 against surfaces", () => {
    expect(contrast(t["focus-ring"], t["surface"])).toBeGreaterThanOrEqual(3);
    expect(contrast(t["focus-ring"], t["app-bg"])).toBeGreaterThanOrEqual(3);
    expect(contrast(t["border-control"], t["surface"])).toBeGreaterThanOrEqual(3);
  });
  it("chart series stay visible against the card surface (3:1)", () => {
    for (const k of ["chart-1", "chart-2", "chart-3", "chart-4"]) expect(contrast(t[k], t["surface"]), k).toBeGreaterThanOrEqual(3);
  });
});
