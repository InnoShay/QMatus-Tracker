import { expect, test } from "@playwright/test";
import { addDays, todayIn } from "../../src/lib/dates";
import { signIn, signOut, uniqueTitle } from "./support";

/**
 * Timer lifecycle (spec §8.5): start on a task, survive a reload, stop from My
 * Time, log and correct a manual entry — and nobody else sees any of it.
 */
test.describe("time tracking", () => {
  test("start, persist across reload, stop, log, correct; private to the owner", async ({ page }) => {
    await signIn(page, "dev");
    const title = uniqueTitle("E2E timer task");
    await page.goto("/t/dev/board");
    await page.getByRole("button", { name: "New task" }).click();
    const dialog = page.getByRole("dialog", { name: "New task" });
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Create task" }).click();
    const panel = page.getByRole("dialog", { name: new RegExp(title) });
    await expect(panel).toBeVisible();
    const key = (await panel.locator("span.font-mono").first().textContent())!.trim();

    // Start: the server confirms, then the clock runs from the server's timestamp.
    const time = panel.getByRole("region", { name: "Your time" });
    await expect(time.getByText("Only you")).toBeVisible();
    await time.getByRole("button", { name: "Start timer" }).click();
    await expect(page.getByText(`Timer started on ${key}.`)).toBeVisible();
    await expect(time.getByRole("button", { name: "Stop timer" })).toBeVisible();
    await expect(time.getByRole("timer")).not.toHaveText("0:00:00", { timeout: 5_000 });

    // Survives a full reload (persisted server-side, not browser state).
    await page.goto(`/t/dev/tasks/${key}`);
    const pageTime = page.getByRole("region", { name: "Your time" });
    await expect(pageTime.getByRole("button", { name: "Stop timer" })).toBeVisible();
    await expect(page.getByRole("link", { name: /My Time.*Running/ }).first()).toBeVisible();

    // Stop from My Time.
    await page.goto("/my-time");
    const running = page.getByRole("region", { name: "Running timer" });
    await expect(running).toContainText(key);
    await running.getByRole("button", { name: "Stop timer" }).click();
    await expect(page.getByText("Timer stopped.")).toBeVisible();
    await expect(running).toBeHidden();
    await expect(page.getByTestId("time-entry").filter({ hasText: key })).toHaveCount(1);

    // Manual entry yesterday 09:00–10:30 in the profile time zone.
    const yesterday = addDays(todayIn("Asia/Kolkata"), -1);
    await page.goto(`/t/dev/tasks/${key}`);
    await pageTime.getByRole("button", { name: "Log time" }).click();
    const form = pageTime.getByRole("form", { name: "Save time" });
    await form.getByLabel("Date").fill(yesterday);
    await form.getByLabel("From").fill("09:00");
    await form.getByLabel("To").fill("10:30");
    await form.getByLabel("Note").fill("Design review notes");
    await form.getByRole("button", { name: "Save time" }).click();
    await expect(page.getByText("Time logged.")).toBeVisible();
    await expect(pageTime.getByTestId("my-task-total")).toHaveText("1h 30m");

    // A range that overlaps is refused by the server with a clear reason.
    await pageTime.getByRole("button", { name: "Log time" }).click();
    await form.getByLabel("Date").fill(yesterday);
    await form.getByLabel("From").fill("10:00");
    await form.getByLabel("To").fill("11:00");
    await form.getByRole("button", { name: "Save time" }).click();
    await expect(form.getByRole("alert")).toHaveText("That overlaps another of your time entries.");
    await form.getByRole("button", { name: "Cancel" }).click();

    // Correct it on My Time; the change is marked.
    await page.goto("/my-time");
    await page.getByRole("button", { name: `Actions for ${key} entry at 09:00` }).click();
    await page.getByRole("menuitem", { name: "Correct" }).click();
    const correction = page.getByRole("form", { name: "Save correction" });
    await correction.getByLabel("To").fill("11:00");
    await correction.getByRole("button", { name: "Save correction" }).click();
    await expect(page.getByText("Entry corrected.", { exact: false })).toBeVisible();
    const row = page.getByTestId("time-entry").filter({ hasText: "09:00–11:00" });
    await expect(row).toContainText("Corrected");
    await expect(row).toContainText("2h 00m");
    await expect(row).toContainText("Design review notes");

    // Another member of the same team sees none of it.
    await signOut(page);
    await signIn(page, "dev2");
    await page.goto(`/t/dev/tasks/${key}`);
    await expect(page.getByRole("region", { name: "Your time" }).getByTestId("my-task-total")).toHaveText("0m");
    await expect(page.getByText("Design review notes")).toHaveCount(0);
    await page.goto("/my-time");
    await expect(page.getByText("No time logged yet")).toBeVisible();
    await expect(page.getByText(key)).toHaveCount(0);

    // A read-only grant holder can't track time on the team's tasks.
    await signOut(page);
    await signIn(page, "reader");
    await page.goto(`/t/dev/tasks/${key}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start timer" })).toHaveCount(0);
    await expect(page.getByText("Design review notes")).toHaveCount(0);
  });
});
