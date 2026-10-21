import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail", { exact: true }).fill("plan@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL("/today", { timeout: 20_000 });
}

const sessionLinks = (page: Page) =>
  page.locator('a[href*="seance="]').filter({ visible: true });

test("a planned session shows its pair and keeps the athlete's choice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1020 });
  await signIn(page);
  await page.goto("/plan");
  await sessionLinks(page).filter({ hasText: /Seuil/ }).first().click();
  const panel = page.getByRole("dialog");
  const shoes = panel.getByRole("region", { name: "Chaussures" });
  await expect(shoes).toBeVisible({ timeout: 20_000 });
  await expect(
    shoes.getByRole("link", { name: /Saucony Endorphin Speed 4/ }),
  ).toBeVisible();
  await expect(shoes.getByText("Conseillée", { exact: true })).toBeVisible();
  await expect(shoes.getByText(/^Seuil sur route : /)).toBeVisible();
  await shoes.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/gear-session-desktop.png" });

  const url = page.url();
  await shoes
    .getByRole("button", { name: "Choisir la Adizero Evo SL 3" })
    .click();
  await expect(shoes.getByText("Ton choix", { exact: true })).toBeVisible();
  await expect(
    shoes.getByRole("link", { name: /Adidas Adizero Evo SL 3/ }),
  ).toBeVisible();
  await page.goto(url);
  const reloaded = page
    .getByRole("dialog")
    .getByRole("region", { name: "Chaussures" });
  await expect(reloaded.getByText("Ton choix", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    reloaded.getByText(/Stride conseillait la Endorphin Speed 4/),
  ).toBeVisible();

  await reloaded
    .getByRole("button", { name: "Choisir la Endorphin Speed 4" })
    .click();
  await expect(reloaded.getByText("Conseillée", { exact: true })).toBeVisible();
});

test("the mobile session sheet opens the pair picker", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/plan");
  await sessionLinks(page).filter({ hasText: /Seuil/ }).first().click();
  const sheet = page.getByRole("dialog");
  const shoes = sheet.getByRole("region", { name: "Chaussures" });
  await expect(shoes).toBeVisible({ timeout: 20_000 });
  await shoes.getByRole("button", { name: "Changer de paire" }).click();
  const picker = page.getByRole("dialog", {
    name: "Quelle paire pour cette séance ?",
  });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("radio")).toHaveCount(3);
  await expect(
    picker.getByRole("radio", { name: /Endorphin Speed 4/ }),
  ).toBeChecked();
  await expect(
    picker.getByText("Crampons inutiles sur ce terrain."),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/gear-picker-mobile.png" });
  await picker.getByRole("button", { name: "Annuler" }).click();
  await expect(picker).toHaveCount(0);
});

test("Matériel lists this week's pairs and the recent rotation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1310 });
  await signIn(page);
  await page.goto("/gear");
  await expect(
    page.getByRole("heading", { name: "Paires prévues cette semaine" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Rotation · 14 derniers jours" }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "Adizero Evo SL 3" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/gear-week-desktop.png",
    fullPage: true,
  });
});

test("today shows the pair of a running session", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  const session = page.getByRole("region", { name: "Séance du jour" });
  await expect(session.getByRole("heading", { level: 2 })).toBeVisible();
  const chip = session.getByRole("link", {
    name: /^Paire (conseillée|choisie) : /,
  });
  test.skip((await chip.count()) === 0, "No running session today");
  await expect(chip).toHaveAttribute("href", /^\/plan\?seance=s-/);
  await page.screenshot({ path: "test-results/gear-today-desktop.png" });
});
