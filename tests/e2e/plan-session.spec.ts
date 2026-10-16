import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("plan@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}

const sessionLinks = (page: Page) =>
  page.locator('a[href*="seance="]').filter({ visible: true });

test("a session opens in a side panel and navigates within the week", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/plan");
  await sessionLinks(page).filter({ hasText: /Seuil/ }).first().click();
  await expect(page).toHaveURL(/\/plan\?.*seance=s-/, { timeout: 20_000 });
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { level: 2 })).toContainText("Seuil");
  await expect(
    panel.getByText(/^Séance \d+ \/ \d+ de la semaine/),
  ).toBeVisible();
  await expect(panel.getByText("Structure")).toBeVisible();
  await expect(panel.getByText("Étapes")).toBeVisible();
  await expect(
    panel.getByText(/^≈ \d+:\d{2}–\d+:\d{2}\/km$/).first(),
  ).toBeVisible();
  await expect(page.locator("main h1")).toContainText("Marathon de Paris");
  await page.screenshot({ path: "test-results/plan-session-desktop.png" });

  const first = page.url();
  const position = panel.getByText(/^Séance \d+ \/ \d+ de la semaine/);
  const before = await position.textContent();
  await page.keyboard.press("ArrowRight");
  await expect(page).not.toHaveURL(first);
  await expect(position).not.toHaveText(before ?? "");
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(first);
  await expect(position).toHaveText(before ?? "");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/plan$/);
});

test("closing a session restores focus and history", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/plan");
  const link = sessionLinks(page).filter({ hasText: /Seuil/ }).first();
  await link.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/plan$/);
  await expect(link).toBeFocused();

  await link.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/plan$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("a completed session shows planned versus completed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  for (const week of [1, 2]) {
    await page.goto("/plan");
    await page
      .getByRole("group", { name: /^Volume hebdomadaire/ })
      .getByRole("button", { name: new RegExp(`^Semaine ${week}, `) })
      .click();
    const done = sessionLinks(page)
      .filter({ hasText: /Footing/ })
      .filter({
        hasText: /Fait/,
      });
    for (let index = 0; index < (await done.count()); index++) {
      await done.nth(index).click();
      const panel = page.getByRole("dialog");
      await expect(panel).toBeVisible({ timeout: 20_000 });
      if (await panel.getByText(/conforme$/).isVisible()) {
        await expect(panel.getByText("Prévu", { exact: true })).toBeVisible();
        await expect(
          panel.getByRole("rowheader", { name: "Allure" }),
        ).toBeVisible();
        await expect(panel.getByText("142 bpm")).toBeVisible();
        await expect(
          panel.getByText(/importé de Garmin 3 min après l’arrêt$/),
        ).toBeVisible();
        await expect(
          panel.getByRole("img", { name: /^Allure minute par minute/ }),
        ).toBeVisible();
        await expect(
          panel.getByRole("link", { name: "Voir l’activité Garmin" }),
        ).toHaveAttribute("href", /\/activities\/aaaaaaaa-/);
        await page.screenshot({
          path: "test-results/plan-session-done-desktop.png",
        });
        return;
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  }
  throw new Error("No completed session with an activity was found");
});

test("a session link loaded directly opens the panel", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/plan");
  await sessionLinks(page).filter({ hasText: /Seuil/ }).first().click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible({ timeout: 20_000 });
  const title = await panel.getByRole("heading", { level: 2 }).textContent();
  const url = page.url();
  await page.goto("about:blank");
  await page.goto(url);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 2 }),
  ).toHaveText(title ?? "");
  await expect(page.locator("main h1")).toContainText("Marathon de Paris");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/seance=/);
});

test("a session opens as a bottom sheet on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/plan");
  await sessionLinks(page).filter({ hasText: /Seuil/ }).first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(/^Séance \d+ \/ \d+ · glisse/)).toBeVisible();
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox();
      return box && [box.x, Math.round(box.y), Math.round(box.y + box.height)];
    })
    .toEqual([0, 58, 844]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/plan-session-mobile.png" });
  await sheet.getByRole("button", { name: "Séance suivante" }).click();
  await expect(
    sheet.getByRole("button", { name: "Séance précédente" }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText(/^Séance \d+ \/ \d+ · glisse/),
  ).toBeVisible();
});
