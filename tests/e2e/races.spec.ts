import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}

test("signed-out visitors cannot open the race workspace", async ({ page }) => {
  await page.goto("/races/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  await expect(page).toHaveURL(/\/sign-in$/);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`race without GPX stays navigable at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto("/races");
    await expect(
      page.getByRole("heading", { level: 1, name: "Courses" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Ouvrir la course" }).click();
    await expect(page).toHaveURL(
      /\/races\/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb$/,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "EcoTrail Paris 120K" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ajoute le GPX de la course" }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/race-no-gpx-${viewport.width}.png`,
      fullPage: true,
    });
    const sections = page.getByRole("navigation", {
      name: "Sections de la course",
    });
    for (const label of [
      "Roadbook",
      "Nutrition",
      "Équipement",
      "Préparation",
    ]) {
      await sections.getByRole("link", { name: label }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "EcoTrail Paris 120K" }),
      ).toBeVisible();
    }
  });
}
