import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalOverflow, signIn, signOut, uniqueTitle } from "./support";
import type { UserKey } from "../../scripts/fixtures";

/**
 * Team dashboard under a simulated working day: a developer creates, finishes,
 * blocks and links work; the lead's dashboard reflects it (flow, tiles, needs
 * attention, queue); read-only and summary-only viewers get their own views.
 * Then a render tour across roles, themes and sizes with zero console errors.
 */

const num = async (page: Page, testId: string) => Number((await page.getByTestId(testId).innerText()).replace(/[^\d]/g, ""));

async function createTask(page: Page, title: string): Promise<string> {
  await page.goto("/t/dev/board");
  await page.getByRole("button", { name: "New task" }).click();
  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Create task" }).click();
  const panel = page.getByRole("dialog", { name: new RegExp(title) });
  await expect(panel).toBeVisible();
  return (await panel.locator("span.font-mono").first().textContent())!.trim();
}

test.describe("team dashboard", () => {
  test("a working day moves the lead's dashboard", async ({ page }) => {
    // Baseline as the lead.
    await signIn(page, "devLead");
    await page.goto("/t/dev");
    await expect(page.getByRole("heading", { name: "Developer Team", level: 1 })).toBeVisible();
    const base = {
      created: await num(page, "flow-created"),
      completed: await num(page, "flow-completed"),
      blocked: await num(page, "tile-blocked"),
    };

    // Leo's day: ship one task, hit a blocker, and queue work behind it.
    await signOut(page);
    await signIn(page, "dev");
    const shipped = uniqueTitle("E2E ship audit export");
    const shippedKey = await createTask(page, shipped);
    const panel = page.getByRole("dialog", { name: new RegExp(shipped) });
    await panel.getByLabel("Status").selectOption({ label: "In Progress" });
    await expect(page.getByText(`${shippedKey} moved to In Progress.`)).toBeVisible();
    await panel.getByLabel("Status").selectOption({ label: "Done" });
    await expect(page.getByText(`${shippedKey} moved to Done.`)).toBeVisible();

    const stuck = uniqueTitle("E2E vendor webhook stuck");
    const stuckKey = await createTask(page, stuck);
    const stuckPanel = page.getByRole("dialog", { name: new RegExp(stuck) });
    await stuckPanel.getByRole("button", { name: "Mark as blocked" }).click();
    await stuckPanel.getByLabel("What’s blocking this?").fill("Vendor has not enabled webhooks in sandbox");
    await stuckPanel.getByRole("button", { name: "Save blocker" }).click();
    await expect(page.getByText("Marked as blocked.")).toBeVisible();

    const waiting = uniqueTitle("E2E retry queue after webhook");
    await createTask(page, waiting);
    const waitingPanel = page.getByRole("dialog", { name: new RegExp(waiting) });
    const deps = waitingPanel.getByRole("region", { name: "Dependencies" });
    await deps.getByLabel("Task key").fill(stuckKey);
    await deps.getByRole("button", { name: "Link", exact: true }).click();
    await expect(page.getByText(`Now blocked by ${stuckKey}.`)).toBeVisible();

    // Leo's own dashboard: both open tasks count as his (most urgent work is listed
    // first, so new undated tasks may sit below the fold), plus the attention banner.
    await page.goto("/t/dev");
    const queue = page.getByRole("region", { name: "Your queue" });
    await expect(queue.getByRole("link", { name: /need(s)? attention/ })).toBeVisible();
    await page.goto("/t/dev/board?assignee=me");
    await expect(page.getByRole("article", { name: `${stuckKey}: ${stuck}` })).toBeVisible();
    await expect(page.getByRole("article", { name: new RegExp(waiting) })).toBeVisible();

    // The lead sees the day reflected.
    await signOut(page);
    await signIn(page, "devLead");
    await page.goto("/t/dev");
    expect(await num(page, "flow-created")).toBe(base.created + 3);
    expect(await num(page, "flow-completed")).toBe(base.completed + 1);
    expect(await num(page, "tile-blocked")).toBe(base.blocked + 2);
    const attention = page.getByRole("region", { name: "Needs attention" });
    await expect(attention.getByRole("link", { name: stuck })).toBeVisible();
    const waitingRow = attention.getByRole("listitem").filter({ hasText: waiting });
    await expect(waitingRow).toContainText("Waiting on 1 open task");

    // The chart is usable: crosshair tooltip, table view, range switch.
    const flow = page.getByRole("region", { name: "Flow" });
    const chart = flow.getByTestId("flow-chart");
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
    await expect(flow.locator(".recharts-tooltip-wrapper")).toContainText("Created");
    await flow.getByText("Show as table").click();
    const todayRow = flow.getByRole("row").nth(1);
    await expect(todayRow).toBeVisible();
    expect(Number(await todayRow.getByRole("cell").nth(1).innerText())).toBeGreaterThanOrEqual(3);
    await flow.getByRole("link", { name: "30 days" }).click();
    await expect(page).toHaveURL(/\/t\/dev\?range=30$/);
    await expect(flow).toContainText("last 30 days");
    expect(await num(page, "flow-created")).toBeGreaterThanOrEqual(base.created + 3);

    // Opening a task from the dashboard keeps the user in the same record.
    await attention.getByRole("link", { name: stuck }).click();
    await expect(page.getByRole("dialog", { name: new RegExp(stuck) })).toBeVisible();
  });

  test("read-only and summary-only viewers get the right dashboard", async ({ page }) => {
    await signIn(page, "reader");
    await page.goto("/t/dev");
    await expect(page.getByRole("region", { name: "Flow" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New task" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Team time, last 14 days" })).toHaveCount(0);

    await signOut(page);
    await signIn(page, "summaryViewer");
    await page.goto("/t/dev");
    await expect(page.getByRole("heading", { name: "Developer Team summary" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Flow" })).toHaveCount(0);
    expect(await page.locator("main").innerText()).not.toMatch(/DEV-\d+/);
  });
});

const TOUR: { who: UserKey; paths: string[] }[] = [
  {
    who: "devLead",
    paths: [
      "/my-work",
      "/my-time",
      "/inbox",
      "/requests",
      "/t/dev",
      "/t/dev?range=30",
      "/t/dev/board",
      "/t/dev/board?task=DEV-2",
      "/t/dev/list",
      "/t/dev/projects",
      "/t/dev/intake",
      "/t/dev/ideas",
      "/t/dev/library",
      "/search?q=export",
      "/settings",
      "/admin/access",
      "/admin/audit",
    ],
  },
  { who: "founder", paths: ["/t/main", "/t/main/board", "/requests", "/requests/new"] },
  { who: "admin", paths: ["/admin", "/admin/access", "/my-work"] },
  { who: "reader", paths: ["/t/dev", "/t/dev/board"] },
  { who: "summaryViewer", paths: ["/t/dev"] },
];

test.describe("render tour", () => {
  for (const { who, paths } of TOUR) {
    test(`${who}: every screen renders cleanly in both themes`, async ({ page, context }) => {
      test.setTimeout(240_000);
      const problems: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(`${page.url()} console: ${m.text().slice(0, 300)}`);
      });
      page.on("pageerror", (e) => problems.push(`${page.url()} pageerror: ${e.message}`));
      await signIn(page, who);
      for (const theme of ["dark", "light"] as const) {
        await context.addCookies([{ name: "qm-theme", value: theme, url: "http://localhost:3000" }]);
        for (const size of theme === "dark" ? [1440, 390] : [1440]) {
          await page.setViewportSize({ width: size, height: size > 800 ? 900 : 844 });
          for (const path of paths) {
            await page.goto(path);
            await page.waitForLoadState("networkidle");
            await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
            await expect(page.locator("main")).toBeVisible();
            await expectNoHorizontalOverflow(page);
          }
        }
      }
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
});
