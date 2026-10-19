import { expect, test, type Locator, type Page } from "@playwright/test";

async function signIn(page: Page, email = "athlete@example.com") {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL("/");
}

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 80; index++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement))
      return;
  }
  throw new Error("Target never received focus");
}

const outline = (target: Locator, pseudo: string | null = null) =>
  target.evaluate(
    (element, pseudoElement) =>
      getComputedStyle(element, pseudoElement).outlineStyle,
    pseudo,
  );

test("signed-out athletes are sent to sign-in", async ({ page }) => {
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("the plan shows the stored program with the current week selected", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "plan@example.com");
  await page.goto("/activities");
  await page.getByRole("link", { name: "Plan", exact: true }).first().click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /^J-\d+ · Marathon de Paris$/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/^Semaine 2 sur \d+ · Reconstruction$/),
  ).toBeVisible();
  await expect(page.getByText("Brouillon", { exact: true })).toHaveCount(0);
  for (const label of ["Total prévu", "Plus longue sortie", "Semaine de pic"])
    await expect(page.getByText(label, { exact: true })).toBeVisible();

  const programs = page.getByRole("navigation", { name: "Programmes" });
  await expect(
    programs.getByRole("link", { name: /Marathon de Paris/ }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    programs.getByRole("link", { name: /10K Vincennes/ }),
  ).toContainText(/débute le/);

  const chart = page.getByRole("group", {
    name: /^Volume hebdomadaire prévu sur \d+/,
  });
  await expect(chart).toBeVisible();
  const current = chart.getByRole("button", { name: /^Semaine 2, / });
  await expect(current).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { level: 2, name: /^S2 / }),
  ).toBeVisible();
  await expect(
    page.getByText("En cours").filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText(/ faites$/)).toBeVisible();
  await expect(
    page.getByText("Proposé").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Repères du programme")).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /^\d+ % du temps de course en facile, cible 80 %$/,
    }),
  ).toBeVisible();

  const sidebar = page.getByRole("link", { name: /^Programme complet/ });
  await expect(sidebar).toHaveAttribute("aria-current", "page");

  await page.screenshot({ path: "test-results/plan-program-desktop.png" });

  await chart.getByRole("button", { name: /^Semaine 1, / }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: /^S1 / }),
  ).toBeVisible();
  await expect(
    page.getByText(/^Fait/).filter({ visible: true }).first(),
  ).toBeVisible();

  await chart.getByRole("button", { name: /^Semaine 3, / }).click();
  await expect(page).toHaveURL(/\/plan\?week=\d{4}-\d{2}-\d{2}$/);
  await expect(
    page.getByRole("heading", { level: 2, name: /^S3 / }),
  ).toBeVisible();
  await expect(page.getByText(/^Semaine 3 sur \d+ · /)).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByText(/^Semaine 2 sur \d+ · Reconstruction$/),
  ).toBeVisible();
  await expect(current).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", { level: 2, name: /^S4 / }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aujourd’hui" }).click();
  await expect(current).toHaveAttribute("aria-pressed", "true");

  await page
    .locator('a[href*="seance="]')
    .filter({ hasText: /Seuil/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/plan\?.*seance=s-\d{4}-\d{2}-\d{2}-/);
  await expect(page.getByRole("dialog")).toContainText("Étapes");
  await expect(page.getByText("Brouillon", { exact: true })).toHaveCount(0);
});

test("a nested race opens its own program", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "plan@example.com");
  await page.goto("/plan");
  await page.getByRole("link", { name: /Programme 10K Vincennes/ }).click();
  await expect(page).toHaveURL(/\/plan\?race=/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "10K Vincennes · cible 44:30",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Programmes" })
      .getByRole("link", { name: /10K Vincennes/ }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page
      .getByRole("group", { name: /^Volume hebdomadaire/ })
      .getByRole("button", {
        name: /^Semaine 1, /,
      }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/^dans \d+ j$/)).toBeVisible();
});

test("the whole program is copied as text for another AI", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "plan@example.com");
  await page.goto("/plan");
  await page.getByRole("button", { name: "Copier le programme" }).click();
  await expect(
    page.getByText("Programme copié", { exact: true }),
  ).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/^# Programme d’entraînement · /);
  expect(text).toMatch(/- \*\*Marathon de Paris\*\* · objectif principal · /);
  expect(text).toMatch(/- Du \d{2}\/\d{2}\/\d{4} au \d{2}\/\d{2}\/\d{4} · /);
  expect(text).toContain("## Structure en blocs");
  expect(text).toMatch(/### Semaine 1 · \d{2}\/\d{2}\/\d{4} → /);
  expect(text).toMatch(/#### [a-zé]+\. \d{2}\/\d{2}\/\d{4} · /);
  expect(text).toContain("- Déroulé :");
});

test("the program fits a phone and shows the selected week", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "plan@example.com");
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { level: 1, name: /Marathon de Paris$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: /^S2 / }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/plan-program-mobile.png",
    fullPage: true,
  });
  await page.goto("/plan?race=ffffffff-ffff-4fff-8fff-ffffffffffff");
  await expect(
    page.getByRole("heading", { level: 1, name: /^10K Vincennes/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/plan-program-race-mobile.png",
    fullPage: true,
  });
  await page
    .locator('a[href*="seance="]')
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/plan\?.*seance=/);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("the program is reachable with the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "plan@example.com");
  await page.goto("/plan");
  const chart = page.getByRole("group", { name: /^Volume hebdomadaire/ });
  await chart.waitFor();
  await page.getByRole("heading", { level: 1 }).evaluate((element) => {
    element.setAttribute("tabindex", "-1");
    (element as HTMLElement).focus();
  });
  const first = chart.getByRole("button", { name: /^Semaine 1, / });
  await tabTo(page, first);
  expect(await outline(first)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { level: 2, name: /^S1 / }),
  ).toBeVisible();

  const milestone = page
    .getByRole("region", { name: "Repères du programme" })
    .getByRole("button")
    .first();
  await tabTo(page, milestone);
  expect(await outline(milestone)).not.toBe("none");
});

test("a race day opens its race page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "plan@example.com");
  await page.goto("/plan");
  await page
    .getByRole("group", { name: /^Volume hebdomadaire/ })
    .getByRole("button", { name: /^Semaine \d+, / })
    .last()
    .click();
  const raceDay = page
    .locator(
      'a[data-session-key][href="/races/cccccccc-cccc-4ccc-8ccc-cccccccccccc"]',
    )
    .filter({ visible: true })
    .first();
  await expect(raceDay).toContainText("Marathon de Paris");
  await raceDay.click();
  await expect(page).toHaveURL(
    /\/races\/cccccccc-cccc-4ccc-8ccc-cccccccccccc$/,
    { timeout: 20_000 },
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("an unknown session leaves Plan without a panel", async ({ page }) => {
  await signIn(page, "plan@example.com");
  const response = await page.goto("/plan?seance=s-2000-01-01-1");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: /Marathon de Paris$/ }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the removed week and session pages are not found", async ({ page }) => {
  await signIn(page, "plan@example.com");
  expect((await page.goto("/plan/week"))?.status()).toBe(404);
  expect((await page.goto("/plan/sessions/s-2000-01-01-1"))?.status()).toBe(
    404,
  );
});

test("an athlete without a stored plan is invited to ask the coach", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { level: 1, name: "Pas encore de programme" }),
  ).toBeVisible();
  await expect(page.getByText(/Demande au Coach/)).toBeVisible();
  await expect(page.getByText("Brouillon", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Programme complet" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Mes disponibilités" }),
  ).toHaveAttribute("href", "/settings/training");
});
