import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}

test("signed-out visitors cannot open progress", async ({ page }) => {
  await page.goto("/progress");
  await expect(page).toHaveURL(/\/sign-in$/);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`fitness tab renders computed measures at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto("/progress");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Condition, fatigue et fraîcheur" }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /^Condition \d+, fatigue \d+/ }).first(),
    ).toBeAttached();
    const measures = page.getByRole("region", { name: "Ce qui évolue" });
    await expect(measures.getByText("Estimation VO₂ max")).toBeVisible();
    await expect(measures.getByText("55", { exact: true })).toBeVisible();
    await expect(
      measures.getByText("Disponible avec un plan d’entraînement"),
    ).toBeVisible();
    const predictions = page.getByRole("region", {
      name: "Prévisions de course",
    });
    await expect(predictions.getByText("38:06")).toBeVisible();
    await expect(
      predictions.getByRole("link", { name: "EcoTrail Paris 120K →" }),
    ).toHaveAttribute("href", "/races/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    await expect(
      page
        .getByRole("region", { name: "Records" })
        .getByText("Sortie la plus longue"),
    ).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}

test("period choice is kept in the URL", async ({ page }) => {
  await signIn(page);
  await page.goto("/progress");
  const periods = page.getByRole("navigation", { name: "Période" });
  await expect(periods.getByRole("link", { name: "6 mois" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await periods.getByRole("link", { name: "12 sem." }).click();
  await expect(page).toHaveURL("/progress?period=12w");
  await page.reload();
  await expect(periods.getByRole("link", { name: "12 sem." })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page
      .getByRole("navigation", { name: "Sections de la progression" })
      .first(),
  ).toBeAttached();
});

test("sidebar links to progress", async ({ page }) => {
  await signIn(page);
  await page.goto("/activities");
  await page.getByRole("link", { name: "Progression", exact: true }).click();
  await expect(page).toHaveURL("/progress");
  await expect(
    page.getByRole("link", { name: "Progression", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});
