import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const authPort = Number(process.env.PLAYWRIGHT_AUTH_PORT ?? 3200);

test.afterEach(async () => {
  await fetch(`http://127.0.0.1:${authPort}/__test__/athlete-settings`, {
    method: "DELETE",
  });
});

async function expectTrainingNotice(page: Page, message: string) {
  await expect(page.getByText(message)).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL("/settings/training");
}

async function signIn(page: Page, email = "athlete@example.com") {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
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
  await page.getByRole("button", { name: "Jules Athlète" }).click();
  await page.getByRole("menuitem", { name: "Raccourcis clavier" }).click();

  const dialog = page.getByRole("dialog", { name: "Raccourcis clavier" });
  await expect(dialog).toBeVisible();
  const search = dialog.getByRole("textbox", {
    name: "Rechercher un raccourci",
  });
  const searchLabel = search.locator("xpath=..");
  const inputBounds = await search.boundingBox();
  const iconBounds = await searchLabel.locator("svg").boundingBox();
  expect(inputBounds).not.toBeNull();
  expect(iconBounds).not.toBeNull();
  expect(
    Math.abs(
      inputBounds!.y +
        inputBounds!.height / 2 -
        iconBounds!.y -
        iconBounds!.height / 2,
    ),
  ).toBeLessThan(1);
  await expect(searchLabel.locator("kbd")).toHaveCount(0);
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
  await page.getByRole("button", { name: "Jules Athlète" }).click();
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
  await expect(page.getByLabel("Poids (kg)")).toHaveValue("68,2");
  await page.getByLabel("Poids (kg)").fill("69");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Profil enregistré.");
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
  await expectTrainingNotice(page, "Modifications enregistrées.");
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
  await expect(page.getByText("Objectif enregistré.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Quel est ton objectif ?" }),
  ).toHaveValue("trail");
  await page.getByRole("link", { name: "Ajouter une course" }).click();
  const wizard = page.getByRole("dialog", { name: "Ajouter une course" });
  await expect(wizard).toBeVisible();
  await wizard.getByLabel("Nom").fill("Training 10K");
  await wizard.getByLabel("Date").fill("10/08/2027");
  await wizard.getByLabel("Distance").fill("10");
  await wizard.getByRole("button", { name: "Continuer" }).click();
  await wizard
    .getByRole("button", { name: "Voir l’effet sur le plan" })
    .click();
  await expect(
    wizard.getByText("Course ajoutée à tes objectifs."),
  ).toBeVisible();
  await wizard.getByRole("button", { name: "Terminer" }).click();
  await expect(page).toHaveURL(/\/settings\/goals$/);
  await page.goto("/settings");
  await expect(
    page.getByRole("link", {
      name: /Objectifs et courses.*EcoTrail Paris 120K.*Training 10K/,
    }),
  ).toBeVisible();
  await page.goto("/settings/goals");
  await page.reload();
  await page
    .locator("div")
    .filter({ hasText: "Training 10K" })
    .filter({ has: page.getByRole("link", { name: "Modifier" }) })
    .last()
    .getByRole("link", { name: "Modifier" })
    .click();
  await page.getByRole("button", { name: "Supprimer la course" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Supprimer la course" })
    .click();
  await expect(page.getByText("Course supprimée.")).toBeVisible();
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
  expect(bounds?.width).toBe(1440);
  const gaps = await content.evaluate((element) => {
    const parent = element.parentElement;
    const parentBox = parent!.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return {
      left: box.left - parentBox.left,
      right: parentBox.left + parent!.clientWidth - box.right,
    };
  });
  expect(Math.abs(gaps.left - gaps.right)).toBeLessThanOrEqual(1);
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
    .getByRole("button", { name: "Jules Athlète" })
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

    const scroller = page
      .locator('[data-slot="settings-content"]')
      .locator("..");
    const scrollTop = await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const after = await footer.boundingBox();
    expect(after?.y).toBe(before?.y);
  }
});

test("profile desktop stages threshold and maximum edits, saves and cancels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await signIn(page);
  await page.goto("/settings/profile");
  await expect(
    page.getByRole("button", { name: "Enregistrer", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Modifier FC au seuil", exact: true })
    .click();
  await page.getByLabel("FC au seuil en bpm").fill("172");
  await page
    .getByRole("radio", { name: "Test terrain 30 min", exact: true })
    .click();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/profile-desktop-1100.png",
  });
  await page.setViewportSize({ width: 1440, height: 1500 });
  await page.screenshot({
    animations: "disabled",
    path: "test-results/profile-desktop-1500.png",
  });
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await page
    .getByRole("button", { name: "Modifier FC max", exact: true })
    .click();
  await expect(
    page.getByRole("radiogroup", { name: "Source du seuil" }),
  ).toHaveCount(0);
  await page.getByLabel("FC max en bpm").fill("185");
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Profil enregistré.");
  await page.reload();
  await page
    .getByRole("button", { name: "Modifier FC au seuil", exact: true })
    .click();
  await expect(page.getByLabel("FC au seuil en bpm")).toHaveValue("172");
  await expect(
    page.getByRole("radio", { name: "Test terrain 30 min", exact: true }),
  ).toHaveAttribute("data-state", "on");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  const name = await page.getByLabel("Prénom", { exact: true }).inputValue();
  await page.getByLabel("Prénom", { exact: true }).fill("Autre prénom");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByLabel("Prénom", { exact: true })).toHaveValue(name);
  await page
    .getByRole("button", { name: "Modifier FC max", exact: true })
    .click();
  await page.getByLabel("FC max en bpm").fill("99");
  await expect(
    page.getByRole("button", { name: "Appliquer", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("FC max en bpm")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Modifier FC max", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Revenir aux données de course" })
    .click();
  await page
    .getByRole("button", { name: "Modifier FC au seuil", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Revenir aux données Garmin" })
    .click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Profil enregistré.");
  await page.reload();
  await page
    .getByRole("button", { name: "Modifier FC max", exact: true })
    .click();
  await expect(page.getByLabel("FC max en bpm")).toHaveValue("176");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await page
    .getByRole("button", { name: "Modifier FC au seuil", exact: true })
    .click();
  await expect(page.getByLabel("FC au seuil en bpm")).toHaveValue("");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
});

test("profile mobile sheet traps focus, Escape discards and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/settings/profile");
  const trigger = page.getByRole("button", {
    name: "Modifier FC au seuil",
    exact: true,
  });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "FC au seuil", exact: true });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("FC au seuil en bpm").fill("173");
  await page.screenshot({
    animations: "disabled",
    path: "test-results/profile-mobile-844.png",
  });
  await sheet
    .getByRole("button", { name: "Revenir aux données Garmin" })
    .focus();
  await page.keyboard.press("Tab");
  expect(
    await sheet.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("profile stale save preserves the draft and photo uploads persist", async ({
  page,
  context,
}) => {
  await signIn(page);
  await page.goto("/settings/profile");
  const other = await context.newPage();
  await other.goto("/settings/profile");
  await other.getByLabel("Prénom", { exact: true }).fill("Jules concurrent");
  await other.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(other.getByRole("status")).toHaveText("Profil enregistré.");
  await page.getByLabel("Prénom", { exact: true }).fill("Brouillon conservé");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("autre onglet");
  await expect(page.getByLabel("Prénom", { exact: true })).toHaveValue(
    "Brouillon conservé",
  );
  await other.close();
  await page.reload();
  await page.getByLabel("Importer une photo de profil").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 2, height: 2, channels: 4, background: "#ffffff" },
    })
      .png()
      .toBuffer(),
  });
  await expect(
    page.getByRole("img", { name: "Ta photo de profil" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Profil enregistré.");
  await page.reload();
  await expect(
    page.getByRole("img", { name: "Ta photo de profil" }),
  ).toBeVisible();
});

test("profile keeps all metric containers when athlete data is absent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "records-empty@example.com");
  await page.goto("/settings/profile");
  await expect(page.getByLabel("Prénom", { exact: true })).toHaveValue("");
  await expect(
    page.getByText("Donnée indisponible", { exact: true }),
  ).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "Modifier FC max", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enregistrer", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("profile preserves partial French dates and decimal input and rejects invalid photos", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/profile");
  const date = page.getByLabel("Date de naissance", { exact: true });
  await date.fill("");
  await date.pressSequentially("20 / 01 / 1990");
  await expect(date).toHaveValue("20 / 01 / 1990");
  const weight = page.getByLabel("Poids (kg)");
  await weight.fill("");
  await weight.pressSequentially("68,7");
  await expect(weight).toHaveValue("68,7");
  await page.getByLabel("Importer une photo de profil").setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid image"),
  });
  await expect(page.getByRole("status")).toContainText("image valide");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await page.getByLabel("Importer une photo de profil").setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("status")).toContainText("moins de 2 Mo");
});

test("profile tablet layouts fit without clipping and edit in a sheet", async ({
  page,
}) => {
  await signIn(page);
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/settings/profile");
    const content = page.locator('[data-slot="settings-content"]');
    expect(
      await content.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const metricRows = content
      .locator("section")
      .last()
      .locator(":scope > div")
      .last()
      .locator(":scope > div > div");
    await expect(metricRows).toHaveCount(5);
    for (const row of await content.locator('[data-slot="field"]').all())
      expect(
        await row.evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBe(true);
    for (const row of await metricRows.all())
      expect(
        await row.evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBe(true);

    for (let index = 0; index < 5; index++)
      await expect(metricRows.nth(index)).toHaveCSS(
        "border-bottom-width",
        index === 4 ? "0px" : "1px",
      );
    await page
      .getByRole("button", { name: "Modifier FC au seuil", exact: true })
      .click();
    const sheet = page.getByRole("dialog", {
      name: "FC au seuil",
      exact: true,
    });
    await expect(sheet).toBeVisible();
    expect(
      await sheet.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  }
});

test("training settings save planning constraints and unavailable periods", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/settings/training");

  const zone = page.getByRole("combobox", { name: "Fuseau horaire" });
  await expect(zone).toHaveText("Paris (Europe)");
  await zone.click();
  await page.getByRole("option", { name: "New York (America)" }).click();
  const ceiling = page.getByRole("textbox", {
    name: "Temps d’entraînement max",
  });
  await ceiling.fill("6h30");
  await page
    .getByRole("button", { name: "Enregistrer la planification" })
    .click();
  await expectTrainingNotice(page, "Modifications enregistrées.");
  await page.reload();
  await expect(zone).toHaveText("New York (America)");
  await expect(ceiling).toHaveValue("6 h 30");

  await expect(page.getByText("Aucune période à venir.")).toBeVisible();
  await page.getByLabel("Début").pressSequentially("12112030");
  await page.getByLabel("Fin").pressSequentially("10112030");
  await expect(page.getByLabel("Début")).toHaveValue("12/11/2030");
  await page.getByRole("button", { name: "Ajouter la période" }).click();
  await expectTrainingNotice(
    page,
    "La fin de la période doit tomber le jour du début ou après.",
  );

  await page.getByLabel("Début").pressSequentially("10112030");
  await page.getByLabel("Fin").pressSequentially("12112030");
  await page.getByText("Repos", { exact: true }).click();
  await page.getByRole("textbox", { name: "Motif" }).fill("Vacances");
  await page.getByRole("button", { name: "Ajouter la période" }).click();
  await expectTrainingNotice(page, "Période d’indisponibilité ajoutée.");
  const periods = page.getByRole("list", { name: "Périodes à venir" });
  await expect(periods.getByText("Du 10/11/2030 au 12/11/2030")).toBeVisible();
  await expect(periods.getByText("Repos · Vacances")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page
    .getByRole("button", {
      name: "Supprimer la période : Du 10/11/2030 au 12/11/2030",
    })
    .click();
  await expectTrainingNotice(page, "Période d’indisponibilité supprimée.");
  await expect(page.getByText("Aucune période à venir.")).toBeVisible();

  await zone.click();
  await page.getByRole("option", { name: "Paris (Europe)" }).click();
  await ceiling.fill("");
  await page
    .getByRole("button", { name: "Enregistrer la planification" })
    .click();
  await expectTrainingNotice(page, "Modifications enregistrées.");
});
