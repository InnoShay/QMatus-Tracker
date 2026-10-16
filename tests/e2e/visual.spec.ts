/**
 * Visual review capture (spec UI §15). Opt-in: VISUAL=1 npm run test:e2e:only -- visual
 * Writes screenshots to artifacts/screenshots/<theme>/<width>/<screen>.png and
 * asserts no page-level horizontal overflow at every size.
 */
import { test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, signIn } from "./support";
import type { UserKey } from "../../scripts/fixtures";

test.skip(!process.env.VISUAL, "Set VISUAL=1 to capture the screenshot matrix.");

const VIEWPORTS = [
  { w: 1440, h: 900 },
  { w: 1280, h: 800 },
  { w: 1024, h: 768 },
  { w: 768, h: 1024 },
  { w: 390, h: 844 },
  { w: 320, h: 720 },
];
const THEMES = ["light", "dark"] as const;

type Screen = { name: string; who: UserKey; path: string | ((page: Page) => Promise<string>); allSizes?: boolean };

const SCREENS: Screen[] = [
  { name: "my-work", who: "devLead", path: "/my-work", allSizes: true },
  { name: "board", who: "devLead", path: "/t/dev/board", allSizes: true },
  { name: "board-task-panel", who: "devLead", path: "/t/dev/board?task=DEV-1", allSizes: true },
  { name: "list", who: "devLead", path: "/t/dev/list", allSizes: true },
  { name: "dashboard", who: "devLead", path: "/t/dev" },
  { name: "intake", who: "devLead", path: "/t/dev/intake" },
  { name: "request-team", who: "devLead", path: requestPath("Pilot customers need a CSV export"), allSizes: true },
  { name: "request-founder", who: "founder", path: requestPath("Pilot customers need a CSV export"), allSizes: true },
  { name: "request-needs-info-founder", who: "owner", path: requestPath("Single sign-on for the enterprise pilot") },
  { name: "new-request", who: "founder", path: "/requests/new" },
  { name: "project", who: "devLead", path: projectPath("Onboarding v2") },
  { name: "ideas", who: "dev", path: "/t/dev/ideas" },
  { name: "library", who: "dev", path: "/t/dev/library" },
  { name: "inbox", who: "dev2", path: "/inbox" },
  { name: "admin-members", who: "admin", path: "/admin" },
  { name: "admin-access", who: "admin", path: "/admin/access" },
  { name: "audit", who: "admin", path: "/admin/audit" },
  { name: "summary-only", who: "summaryViewer", path: "/t/dev" },
  { name: "read-only-grant-board", who: "reader", path: "/t/dev/board" },
  { name: "not-available", who: "founder", path: "/t/dev/board" },
  { name: "settings", who: "dev", path: "/settings" },
  { name: "my-time", who: "dev", path: "/my-time", allSizes: true },
  { name: "empty-my-work", who: "admin", path: "/my-work" },
];

function requestPath(title: string) {
  return async (page: Page) => {
    await page.goto("/requests");
    // The route streams a loading skeleton first; wait for the real content.
    await page.locator('[aria-busy="true"]').waitFor({ state: "detached" });
    const mine = page.getByRole("link", { name: title });
    if ((await mine.count()) > 0) return (await mine.first().getAttribute("href"))!;
    await page.goto("/t/dev/intake");
    return (await page.getByRole("link", { name: title }).first().getAttribute("href"))!;
  };
}

function projectPath(name: string) {
  return async (page: Page) => {
    await page.goto("/t/dev/projects");
    return (await page.getByRole("link", { name }).first().getAttribute("href"))!;
  };
}

for (const theme of THEMES) {
  test(`sign-in · ${theme}`, async ({ page, context }) => {
    await context.addCookies([{ name: "qm-theme", value: theme, url: "http://localhost:3000" }]);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto("/sign-in");
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `artifacts/screenshots/${theme}/${vp.w}/sign-in.png` });
    }
  });

  for (const screen of SCREENS) {
    test(`${screen.name} · ${theme}`, async ({ page, context }) => {
      await context.addCookies([{ name: "qm-theme", value: theme, url: "http://localhost:3000" }]);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await signIn(page, screen.who);
      const path = typeof screen.path === "string" ? screen.path : await screen.path(page);
      for (const vp of screen.allSizes ? VIEWPORTS : VIEWPORTS.filter((v) => v.w === 1440 || v.w === 390)) {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expectNoHorizontalOverflow(page);
        await page.screenshot({ path: `artifacts/screenshots/${theme}/${vp.w}/${screen.name}.png`, fullPage: vp.w < 768 });
      }
    });
  }
}
