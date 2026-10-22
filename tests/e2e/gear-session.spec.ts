import { expect, test, type Page } from "@playwright/test";

const authUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_AUTH_PORT ?? 3200}`;

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
    .getByRole("button", { name: "Choisir l’Adizero Evo SL 3" })
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
    reloaded.getByText(/Stride conseillait l’Endorphin Speed 4/),
  ).toBeVisible();

  await reloaded
    .getByRole("button", { name: "Choisir l’Endorphin Speed 4" })
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

test("a run with another pair in Garmin asks which one was worn", async ({
  page,
}) => {
  const reset = await fetch(
    `${authUrl}/__test__/activity-feelings?activity=aaaaaaaa-aaaa-4aaa-8aaa-000000005000`,
    { method: "DELETE" },
  );
  expect(reset.ok).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  const latest = page.getByRole("region", {
    name: /^(Hier|Aujourd’hui|Dernière activité)/,
  });
  await expect(
    page.getByRole("group", { name: /^Garmin indique les Zegama/ }),
  ).toHaveCount(0);
  await latest
    .getByRole("radiogroup", {
      name: "Comment c’était ? Effort perçu, de 1 à 10",
    })
    .getByRole("radio", { name: "4" })
    .click();
  await latest
    .getByRole("radiogroup", { name: "Sensations" })
    .getByRole("radio", { name: "Bien", exact: true })
    .click();
  await expect(page.getByText("Ressenti enregistré.")).toBeVisible();
  const card = page.getByRole("group", {
    name: "Garmin indique les Zegama, la séance prévoyait les Adizero Evo SL 3.",
  });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(
    card.getByText("Ta réponse corrige aussi la paire dans Garmin."),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/gear-check-today.png" });

  await page.goto("/gear");
  const watch = page.getByRole("region", { name: "À surveiller" });
  await expect(watch.getByText(/^Paire à confirmer · /)).toBeVisible();
  await watch.getByRole("link", { name: "Répondre" }).click();
  await expect(page).toHaveURL(
    /\/activities\/aaaaaaaa-aaaa-4aaa-8aaa-000000005000/,
  );
  const shoes = page.getByRole("region", { name: "Chaussures" });
  await expect(shoes.getByText("Nike Zegama")).toBeVisible();
  await expect(
    shoes.getByText("Garmin · la séance prévoyait les Adizero Evo SL 3"),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/gear-check-activity.png" });

  await page
    .getByRole("group", { name: /^Garmin indique les Zegama/ })
    .getByRole("button", { name: "Oui, les Zegama" })
    .click();
  await expect(shoes.getByText(/^Garmin · confirmée par toi/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("group", { name: /^Garmin indique les Zegama/ }),
  ).toHaveCount(0);
  await page.goto("/today");
  await expect(
    page.getByRole("region", { name: "Séance du jour" }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: /^Garmin indique les Zegama/ }),
  ).toHaveCount(0);
});

test("the race gear list links the shoe line to a real pair", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1805 });
  await page.goto("/sign-in");
  await page.getByLabel("E-mail", { exact: true }).fill("athlete@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL("/today", { timeout: 20_000 });
  await page.goto("/races/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/gear");
  const select = page.getByRole("combobox", {
    name: "Paire pour Chaussures de course",
  });
  await expect(select).toBeVisible({ timeout: 20_000 });
  await select.selectOption({ label: "Nike ACG Zegama" });
  const pair = page.getByRole("link", { name: "Nike ACG Zegama" });
  await expect(pair).toHaveAttribute(
    "href",
    "/gear/d1000000-0000-4000-8000-000000000004",
  );
  await expect(
    page.getByText(
      /^241 km · aucune sortie enregistrée\. Plan B : Hoka Speedgoat 7\.$/,
    ),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/gear-race-desktop.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Nike ACG Zegama" }),
  ).toBeVisible();
});
