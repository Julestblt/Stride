import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}

test("keyboard help is searchable, platform-aware and available from the account menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/activities");
  await page.getByRole("button", { name: "Jules athlete@example.com" }).click();
  await page.getByRole("menuitem", { name: "Raccourcis clavier" }).click();

  const dialog = page.getByRole("dialog", { name: "Raccourcis clavier" });
  await expect(dialog).toBeVisible();
  const search = dialog.getByRole("textbox", {
    name: "Rechercher un raccourci",
  });
  await search.focus();
  await page.keyboard.type("?");
  await expect(search).toHaveValue("?");
  await expect(dialog).toBeVisible();
  await search.fill("réglages");
  await expect(dialog.getByText("Ouvrir les réglages")).toBeVisible();
  await expect(dialog.getByText("Ouvrir les activités")).toHaveCount(0);

  await dialog.getByRole("button", { name: /Windows/ }).click();
  await expect(dialog.getByText("Ctrl", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.keyboard.press("Shift+/");
  await expect(dialog).toBeVisible();
  await search.fill("terme introuvable");
  await expect(dialog.getByRole("status")).toHaveText(
    "Aucun raccourci trouvé.",
  );
});

test("mobile account menu opens gesture help and a connected keyboard opens shortcut help", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/activities");
  await page
    .getByRole("button", { name: "Afficher ou masquer la barre latérale" })
    .first()
    .click();
  await page.getByRole("button", { name: "Jules athlete@example.com" }).click();
  await page.getByRole("menuitem", { name: "Gestes et commandes" }).click();

  const gestures = page.getByRole("dialog", { name: "Gestes et commandes" });
  await expect(gestures).toBeVisible();
  await expect(gestures.getByText("Faire défiler une liste")).toBeVisible();

  await page.keyboard.press("Shift+/");
  await expect(
    page.getByRole("dialog", { name: "Raccourcis clavier" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("settings requires a signed-in athlete", async ({ page }) => {
  await page.goto("/settings/profile");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("desktop settings reflect stored athlete data and expose every supported section", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Se déconnecter" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Profil.*35 ans/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Réglages" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Réglages personnels" })
    .getByRole("link", { name: "Profil" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Profil" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Prénom" })).toHaveValue(
    "Jules",
  );
  await expect(page.getByLabel("Poids (kg)")).toHaveValue("68.2");
  await page.getByLabel("Poids (kg)").fill("69");
  await page.getByRole("button", { name: "Enregistrer le profil" }).click();
  await expect(page).toHaveURL(/\/settings\/profile\?status=saved$/);
  await page.reload();
  await expect(page.getByLabel("Poids (kg)")).toHaveValue("69");
  await page
    .getByRole("navigation", { name: "Réglages personnels" })
    .getByRole("link", { name: "Entraînement et coach" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Entraînement et coach" }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Trail" })).toBeChecked();
  await page.getByText("Route", { exact: true }).click();
  await page
    .getByRole("button", { name: "Enregistrer les préférences" })
    .click();
  await expect(page).toHaveURL(/\/settings\/training\?status=saved$/);
  await page.reload();
  await expect(page.getByRole("radio", { name: "Route" })).toBeChecked();
  await page
    .getByRole("navigation", { name: "Réglages personnels" })
    .getByRole("link", { name: "Objectifs et courses" })
    .click();
  await expect(page.getByText("EcoTrail Paris 120K").first()).toBeVisible();
  await page
    .getByRole("combobox", { name: "Quel est ton objectif ?" })
    .selectOption("trail");
  await page.getByRole("button", { name: "Enregistrer l’objectif" }).click();
  await expect(page).toHaveURL(/\/settings\/goals\?status=saved$/);
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Quel est ton objectif ?" }),
  ).toHaveValue("trail");
  const add = page.getByRole("form", { name: "Ajouter la course" });
  await add.getByLabel("Nom de la course").fill("Training 10K");
  await add.getByLabel("Date").fill("2027-08-10");
  await add.getByLabel("Distance (km)").fill("10");
  await add.getByRole("button", { name: "Ajouter la course" }).click();
  await expect(page).toHaveURL(/\/settings\/goals\?status=saved$/);
  await page.goto("/settings");
  await expect(
    page.getByRole("link", {
      name: /Objectifs et courses.*EcoTrail Paris 120K.*Training 10K/,
    }),
  ).toBeVisible();
  await page.goto("/settings/goals");
  await page.reload();
  await page.getByText("Training 10K", { exact: false }).first().click();
  await page.getByRole("button", { name: "Supprimer la course" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Supprimer la course" })
    .click();
  await expect(page.getByText("Training 10K")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Réglages des données" })
    .getByRole("link", { name: "Connexions" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Connexions" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Gérer" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Garmin" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Réglages des données" })
    .getByRole("link", { name: "Données et confidentialité" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Télécharger le JSON" }).click();
  expect((await download).suggestedFilename()).toBe("stride-settings.json");
});

test("mobile settings keep a narrow viewport navigable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Se déconnecter" }),
  ).toBeInViewport();
  await expect(
    page.getByRole("link", { name: /Objectifs et courses/ }).last(),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Objectifs et courses/ })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Objectifs et courses" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Retour aux réglages" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("settings pages use the available desktop width and center on wide screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);

  const routes = [
    "/settings",
    "/settings/profile",
    "/settings/training",
    "/settings/goals",
    "/settings/connections",
    "/settings/connections/garmin",
    "/settings/privacy",
  ];

  for (const route of routes) {
    await page.goto(route);
    const content = page.locator('[data-slot="settings-content"]');
    await expect(content).toBeVisible();
    const bounds = await content.boundingBox();
    expect(bounds?.width).toBeGreaterThan(1000);
    if (route === "/settings") {
      await page.screenshot({
        path: "test-results/settings-laptop-layout.png",
      });
    }
  }

  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/settings/connections/garmin");
  const content = page.locator('[data-slot="settings-content"]');
  const bounds = await content.boundingBox();
  const panel = await content.locator("..").boundingBox();
  expect(bounds?.width).toBe(1440);
  expect(bounds?.x).toBeCloseTo(
    (panel?.x ?? 0) + ((panel?.width ?? 0) - 1440) / 2,
    0,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(2560);
  await page.screenshot({ path: "test-results/settings-wide-layout.png" });
});

test("desktop settings keep the account footer fixed and aligned with the app", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 650 });
  await signIn(page);
  await page.goto("/activities");
  const appAvatar = await page
    .getByRole("button", { name: "Jules athlete@example.com" })
    .locator("span")
    .first()
    .boundingBox();
  expect(appAvatar).not.toBeNull();

  for (const section of ["training", "goals"]) {
    await page.goto(`/settings/${section}`);
    const footer = page.locator('[data-slot="settings-account"]');
    const before = await footer.boundingBox();
    const settingsAvatar = await footer.locator("span").first().boundingBox();
    expect(before).not.toBeNull();
    expect(settingsAvatar).not.toBeNull();
    expect(Math.abs(settingsAvatar!.x - appAvatar!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(settingsAvatar!.y - appAvatar!.y)).toBeLessThanOrEqual(1);

    const scrollTop = await page.locator("main").evaluate((main) => {
      main.scrollTop = main.scrollHeight;
      return main.scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const after = await footer.boundingBox();
    expect(after?.y).toBe(before?.y);
  }
});
