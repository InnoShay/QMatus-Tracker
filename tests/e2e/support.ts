import { expect, type Page } from "@playwright/test";
import { DEV_PASSWORD, USERS, type UserKey } from "../../scripts/fixtures";

export async function signIn(page: Page, who: UserKey) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(USERS[who].email);
  await page.getByLabel("Password").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/my-work/);
}

export async function signOut(page: Page) {
  await page.context().clearCookies();
}

/** No page-level horizontal scroll (spec §7.3). Intentional inner scroll regions are fine. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(1);
}

export function uniqueTitle(label: string) {
  return `${label} ${Math.random().toString(36).slice(2, 8)}`;
}
