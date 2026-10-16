import { expect, test } from "@playwright/test";
import { signIn, signOut, uniqueTitle } from "./support";

test.describe("authentication", () => {
  test("signed-out visitors are sent to sign-in with a safe return path", async ({ page }) => {
    await page.goto("/t/dev/board");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Ft%2Fdev%2Fboard/);
  });

  test("wrong credentials get one generic message", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("nobody@qmatus.test");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "combination" })).toHaveText("That email and password combination didn't work.");
  });

  test("an invalid invitation link reveals nothing", async ({ page }) => {
    await page.goto("/invite/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    await expect(page.getByRole("heading", { name: "This invitation link isn't valid" })).toBeVisible();
    await expect(page.getByText("QMatus", { exact: false }).first()).toBeVisible();
  });
});

test.describe("tasks: board and list share one record", () => {
  test("create, edit, move without dragging, and see it persist in list view", async ({ page }) => {
    await signIn(page, "devLead");
    const title = uniqueTitle("E2E retry webhook delivery");
    await page.goto("/t/dev/board");
    await page.getByRole("button", { name: "New task" }).click();
    const dialog = page.getByRole("dialog", { name: "New task" });
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Priority").selectOption("high");
    await dialog.getByRole("button", { name: "Create task" }).click();

    // The panel opens on the new task (server-confirmed).
    const panel = page.getByRole("dialog", { name: new RegExp(title) });
    await expect(panel).toBeVisible();
    const key = (await panel.locator("span.font-mono").first().textContent())!.trim();
    await panel.getByLabel("Status").selectOption({ label: "Ready" });
    await expect(page.getByText(`${key} moved to Ready.`)).toBeVisible();
    await panel.getByRole("button", { name: "Close task" }).click();

    // Non-drag move from the card menu.
    await page.getByRole("button", { name: `Actions for ${key}: ${title}` }).click();
    await page.getByRole("menuitem", { name: "Move to…" }).click();
    await page.getByRole("menuitem", { name: "In Progress" }).click();
    await expect(page.getByText(`${key} moved to In Progress.`)).toBeVisible();

    // Same record in list view after a full reload.
    await page.goto(`/t/dev/list?q=${encodeURIComponent(key)}`);
    const row = page.getByRole("row", { name: new RegExp(key) });
    await expect(row).toContainText("In Progress");
    await expect(row).toContainText("High");
  });

  test("an illegal transition is refused and nothing changes", async ({ page }) => {
    await signIn(page, "devLead");
    await page.goto("/t/dev/board");
    // Backlog cannot jump straight to Done: the menu doesn't offer it.
    const backlogCard = page.getByRole("region", { name: /Board columns/ }).getByRole("button", { name: /^Actions for DEV-9:/ });
    await backlogCard.click();
    await page.getByRole("menuitem", { name: "Move to…" }).click();
    await expect(page.getByRole("menuitem", { name: "Done" })).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  test("keyboard drag moves a card between columns", async ({ page }) => {
    await signIn(page, "devLead");
    await page.goto("/t/dev/board");
    const handle = page.getByRole("button", { name: /^Move DEV-12:/ });
    await handle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    // Wait for the same live announcement a screen-reader user hears before dropping.
    await expect(page.getByRole("status").filter({ hasText: "DEV-12 is over In Progress." })).toBeAttached();
    await page.keyboard.press("Space");
    await expect(page.getByText("DEV-12 moved to In Progress.")).toBeVisible();
    await page.reload();
    const progress = page.getByRole("list", { name: "In Progress tasks" });
    await expect(progress.getByText("Accessibility pass on the onboarding wizard")).toBeVisible();
  });
});

test.describe("work request boundary", () => {
  test("founder submits; developers accept privately; founder sees only published progress", async ({ page }) => {
    const title = uniqueTitle("E2E Weekly usage email for pilots");
    const privateTask = uniqueTitle("E2E PRIVATE mailer job");

    await signIn(page, "founder");
    await page.goto("/requests/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Problem or background").fill("Pilots ask how their team used the product each week.");
    await page.getByLabel("Desired outcome and why it matters").fill("Admins get a weekly summary email.");
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("Submitted").first()).toBeVisible();
    const requestUrl = page.url();

    await signOut(page);
    await signIn(page, "devLead");
    await page.goto(requestUrl);
    await page.getByRole("button", { name: "Start triage" }).click();
    await expect(page.getByText("Request is now in triage.")).toBeVisible();
    await page.getByLabel("Internal note, visible to your team only").fill("Needs the email provider decision first.");
    await page.getByRole("button", { name: "Add note" }).click();
    await page.getByRole("button", { name: "Accept and plan" }).click();
    const accept = page.getByRole("dialog", { name: /^Accept REQ-/ });
    await accept.getByLabel("Task 1 title").fill(privateTask);
    await accept.getByRole("button", { name: "Accept request" }).click();
    await expect(page.getByText(/and created 1 private task/)).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(privateTask) })).toBeVisible();

    await signOut(page);
    await signIn(page, "founder");
    await page.goto(requestUrl);
    await expect(page.getByText("Planned").first()).toBeVisible();
    await expect(page.getByText("Accepted. We've planned this and will share progress here.")).toBeVisible();
    const body = await page.locator("main").innerText();
    expect(body).not.toContain(privateTask);
    expect(body).not.toContain("Needs the email provider decision first.");
    expect(body).not.toContain("Internal notes");
    expect(body).not.toMatch(/DEV-\d+/);
  });
});

test.describe("privacy in the browser", () => {
  test("a founder can't open the developer board by URL", async ({ page }) => {
    await signIn(page, "founder");
    await page.goto("/t/dev/board");
    await expect(page.getByRole("heading", { name: "This isn't available" })).toBeVisible();
    await page.goto("/t/dev/board?task=DEV-1");
    await expect(page.getByText("Invite email: handle expired links")).toHaveCount(0);
  });

  test("an admin without membership sees no developer content, even via search", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/t/dev/list");
    await expect(page.getByRole("heading", { name: "This isn't available" })).toBeVisible();
    await page.goto("/search?q=verification");
    await expect(page.getByText("No results for “verification”")).toBeVisible();
  });

  test("a summary-only grant sees counts and nothing else", async ({ page }) => {
    await signIn(page, "summaryViewer");
    await page.goto("/t/dev");
    await expect(page.getByRole("heading", { name: "Developer Team summary" })).toBeVisible();
    await expect(page.getByText("Task details, names and activity are private to the team.")).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(/DEV-\d+/);
    await page.goto("/t/dev/board");
    await expect(page.getByRole("heading", { name: "This isn't available" })).toBeVisible();
  });
});

test.describe("themes", () => {
  test("theme switches instantly, keeps form input, and persists to the profile", async ({ page }) => {
    await signIn(page, "dev");
    await page.goto("/settings");
    const name = page.getByLabel("Name");
    await name.fill("Leo Martins (draft edit)");
    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(name).toHaveValue("Leo Martins (draft edit)");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("radio", { name: "System" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  });
});

test.describe("invitations", () => {
  test("admin invites; invitee joins the right team; the link is single-use", async ({ page }) => {
    const email = `new-dev-${Math.random().toString(36).slice(2, 8)}@qmatus.test`;
    await signIn(page, "admin");
    await page.goto("/admin");
    await page.getByRole("button", { name: "Invite person" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite someone" });
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Add to team").selectOption({ label: "Developer Team" });
    await dialog.getByRole("button", { name: "Create invitation" }).click();
    const link = await page.getByLabel("Invitation link").inputValue();
    expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);

    await signOut(page);
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Join the QMatus workspace" })).toBeVisible();
    await page.getByLabel("Your name").fill("Robin Vale");
    await page.getByLabel("Password", { exact: true }).fill("a-very-local-test-password");
    await page.getByLabel("Confirm password").fill("a-very-local-test-password");
    await page.getByRole("button", { name: "Create account and join" }).click();
    await expect(page).toHaveURL(/\/my-work/);
    await page.goto("/t/dev/board");
    await expect(page.getByRole("heading", { name: "Board" })).toBeVisible();

    await signOut(page);
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "This invitation has already been used" })).toBeVisible();
  });
});
