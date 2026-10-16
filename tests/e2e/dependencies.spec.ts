import { expect, test, type Page } from "@playwright/test";
import { signIn, signOut, uniqueTitle } from "./support";

/**
 * Dependencies and blockers (spec §7.14): link "blocked by" / "blocking" from
 * the task detail, see the cue on the board, get clear refusals for self-links
 * and loops, keep another team's private blocker anonymous, and leave
 * read-only viewers without edit controls.
 */
async function createTask(page: Page, team: string, title: string): Promise<string> {
  await page.goto(`/t/${team}/board`);
  await page.getByRole("button", { name: "New task" }).click();
  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Create task" }).click();
  const panel = page.getByRole("dialog", { name: new RegExp(title) });
  await expect(panel).toBeVisible();
  return (await panel.locator("span.font-mono").first().textContent())!.trim();
}

async function link(page: Page, direction: "Blocked by" | "Blocking", key: string) {
  const deps = page.getByRole("region", { name: "Dependencies" });
  await deps.getByLabel("Link type").selectOption({ label: direction });
  await deps.getByLabel("Task key").fill(key);
  await deps.getByRole("button", { name: "Link", exact: true }).click();
}

test.describe("task dependencies", () => {
  test("link, cue, refusals, private blocker, read-only view, removal", async ({ page }) => {
    // Leo creates two Dev tasks and marks the first as blocked by the second.
    await signIn(page, "dev");
    const titleA = uniqueTitle("E2E blocked task");
    const titleB = uniqueTitle("E2E blocker task");
    const keyA = await createTask(page, "dev", titleA);
    const keyB = await createTask(page, "dev", titleB);

    await page.goto(`/t/dev/tasks/${keyA}`);
    const deps = page.getByRole("region", { name: "Dependencies" });
    await link(page, "Blocked by", keyB.toLowerCase());
    await expect(page.getByText(`Now blocked by ${keyB}.`)).toBeVisible();
    const blockedBy = deps.getByRole("list", { name: "Blocked by" });
    await expect(blockedBy.getByRole("link", { name: new RegExp(titleB) })).toBeVisible();
    await expect(deps.getByText("Waiting on 1 open task. You can still move this task.")).toBeVisible();

    // Refusals come from the database with a clear reason.
    await link(page, "Blocked by", keyA);
    await expect(page.getByText("A task can't block itself.")).toBeVisible();

    await page.goto(`/t/dev/tasks/${keyB}`);
    await expect(page.getByRole("list", { name: "Blocking" }).getByRole("link", { name: new RegExp(titleA) })).toBeVisible();
    await link(page, "Blocked by", keyA);
    await expect(page.getByText("That link would create a dependency loop.")).toBeVisible();

    // The board card carries the cue; it is still a normal, movable card.
    await page.goto("/t/dev/board");
    const card = page.getByRole("article", { name: `${keyA}: ${titleA}` });
    await expect(card.getByTestId("waiting-cue")).toHaveAttribute("title", "Blocked by 1 open task");

    // Noor (Founders + Dev) links the Dev task to a private Founders task.
    await signOut(page);
    await signIn(page, "dual");
    const secretTitle = uniqueTitle("E2E founders-only blocker");
    const secretKey = await createTask(page, "main", secretTitle);
    await page.goto(`/t/dev/tasks/${keyA}`);
    await link(page, "Blocked by", secretKey);
    await expect(page.getByText(`Now blocked by ${secretKey}.`)).toBeVisible();
    await expect(page.getByRole("list", { name: "Blocked by" }).getByText(secretTitle)).toBeVisible();

    // Leo sees that something blocks the task, but not what or which team.
    await signOut(page);
    await signIn(page, "dev");
    await page.goto(`/t/dev/tasks/${keyA}`);
    const leoDeps = page.getByRole("region", { name: "Dependencies" });
    await expect(leoDeps.getByText("A task you can’t view")).toBeVisible();
    await expect(leoDeps.getByText("Waiting on 2 open tasks. You can still move this task.")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(secretTitle);
    await expect(page.locator("body")).not.toContainText(secretKey);
    await expect(page.getByText(/blocked by a task you can’t view/).first()).toBeVisible();

    // Leo can't link to it by key either: same answer as a key that doesn't exist.
    await link(page, "Blocking", secretKey);
    await expect(page.getByText(`No task you can view has the key ${secretKey}.`)).toBeVisible();

    // Tara (read grant on Dev) sees the links but gets no edit controls.
    await signOut(page);
    await signIn(page, "reader");
    await page.goto(`/t/dev/tasks/${keyA}`);
    const taraDeps = page.getByRole("region", { name: "Dependencies" });
    await expect(taraDeps.getByRole("list", { name: "Blocked by" }).getByRole("link", { name: new RegExp(titleB) })).toBeVisible();
    await expect(taraDeps.getByLabel("Task key")).toHaveCount(0);
    await expect(taraDeps.getByRole("button", { name: /Remove link/ })).toHaveCount(0);

    // Leo removes the Dev link; the history stays in the activity timeline.
    await signOut(page);
    await signIn(page, "dev");
    await page.goto(`/t/dev/tasks/${keyA}`);
    await page.getByRole("button", { name: `Remove link to ${keyB}` }).click();
    await expect(page.getByText("Link removed. It stays in the activity history.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Dependencies" }).getByRole("link", { name: new RegExp(titleB) })).toHaveCount(0);
    await expect(page.getByText(`removed the link: blocked by ${keyB}`)).toBeVisible();
  });
});
