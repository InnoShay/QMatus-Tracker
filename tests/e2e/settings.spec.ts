import { expect, test } from "@playwright/test";
import { signIn } from "./support";

/** Time zone picker: find India by name, save, and it persists (stored as Asia/Kolkata). */
test("time zone: search India, save, and it persists", async ({ page }) => {
  await signIn(page, "dev2");
  await page.goto("/settings");
  const trigger = page.getByRole("button", { name: "Time zone" });

  await trigger.click();
  await page.getByRole("combobox", { name: "Search time zones" }).fill("utc");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await expect(page.getByText("Profile saved.")).toBeHidden({ timeout: 10_000 });

  await trigger.click();
  const search = page.getByRole("combobox", { name: "Search time zones" });
  await search.fill("india");
  await expect(page.getByRole("option").first()).toContainText("Kolkata");
  await expect(page.getByRole("option").first()).toContainText("GMT+05:30");
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("Kolkata");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Time zone" })).toContainText("India Standard Time");
  await expect(page.locator('input[name="timezone"]')).toHaveValue("Asia/Kolkata");
});
