import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email = "athlete@example.com") {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}

test("signed-out athletes are sent to sign-in", async ({ page }) => {
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("the plan shows a complete draft week and opens a session", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "plan@example.com");
  await page.goto("/activities");
  await page.getByRole("link", { name: "Plan", exact: true }).first().click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByText("Brouillon", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: /^Semaine \d+ · / }),
  ).toBeVisible();
  const blocks = page.getByRole("navigation", { name: "Blocs du plan" });
  await expect(blocks.getByRole("link").first()).toBeVisible();
  await expect(
    page.getByRole("img", { name: /^Charge de la semaine/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/plan-desktop.png",
    fullPage: true,
  });

  const nextWeek = blocks.getByRole("link").nth(1);
  await nextWeek.click();
  await expect(page).toHaveURL(/\/plan\?week=\d{4}-\d{2}-\d{2}$/);
  await expect(blocks.getByRole("link").nth(1)).toHaveAttribute(
    "aria-current",
    "page",
  );

  const sessions = page.locator('a[href^="/plan/sessions/"]');
  expect(await sessions.count()).toBeGreaterThan(1);
  const quality = page
    .locator('a[href^="/plan/sessions/"]')
    .filter({ hasText: /Seuil|Côtes|Fractionné|Allure/ })
    .first();
  const target = (await quality.count()) > 0 ? quality : sessions.first();
  await target.click();
  await expect(page).toHaveURL(/\/plan\/sessions\/s-\d{4}-\d{2}-\d{2}-/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Étapes" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /^Déroulé de la séance/ }),
  ).toBeVisible();
  await expect(page.getByText("Pourquoi cette séance")).toBeVisible();
  await expect(page.getByText("Envoyer sur Garmin")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/plan-session-desktop.png",
    fullPage: true,
  });
});

test("the plan fits a phone and navigates weeks with the keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "plan@example.com");
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { level: 1, name: "Plan" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/plan-mobile.png",
    fullPage: true,
  });
  const next = page.getByRole("link", { name: "Semaine suivante" });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/plan\?week=/);
  await page.locator('a[href^="/plan/sessions/"]').first().click();
  await expect(page).toHaveURL(/\/plan\/sessions\//);
  await expect(page.getByRole("heading", { name: "Étapes" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/plan-session-mobile.png",
    fullPage: true,
  });
});

test("an unknown session is not found", async ({ page }) => {
  await signIn(page, "plan@example.com");
  const response = await page.goto("/plan/sessions/s-2000-01-01-1");
  expect(response?.status()).toBe(404);
});

test("an athlete without recent runs learns why the plan is missing", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Pas encore assez de données pour construire ton plan",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Mes disponibilités" }),
  ).toHaveAttribute("href", "/settings/training");
});
