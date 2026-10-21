import { expect, test, type Page } from "@playwright/test";

const authPort = Number(process.env.PLAYWRIGHT_AUTH_PORT ?? 3200);

test.describe.configure({ mode: "serial" });

async function resetNotifications() {
  await fetch(`http://127.0.0.1:${authPort}/__test__/notifications`, {
    method: "DELETE",
  });
}

test.beforeEach(resetNotifications);
test.afterAll(resetNotifications);

async function signIn(page: Page, email = "notifications@example.com") {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL("/today", { timeout: 20_000 });
}

test("the desktop bell opens the panel and marks everything read", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1165 });
  await signIn(page);
  const bell = page.getByRole("button", {
    name: "Notifications, 3 non lues",
  });
  await expect(bell).toBeVisible();
  await bell.click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(panel.getByText("3 non lues")).toBeVisible();
  await expect(
    panel.getByRole("region", { name: "Aujourd’hui" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: /Claire propose : Raccourcir ton seuil/,
    }),
  ).toBeVisible();
  await expect(panel.getByText("Réponse attendue")).toBeVisible();
  await expect(panel.getByText("Hors de la fenêtre")).toHaveCount(0);
  await page.screenshot({ path: "test-results/notifications-panel.png" });

  await panel.getByRole("button", { name: "À traiter · 3" }).click();
  await expect(panel.getByText("Claire a répondu")).toHaveCount(0);
  await panel.getByRole("button", { name: "Staff" }).click();
  await expect(panel.getByText(/Claire a répondu/)).toBeVisible();
  await expect(panel.getByText(/Raccourcir ton seuil/)).toHaveCount(0);

  await panel.getByRole("button", { name: "Tout marquer comme lu" }).click();
  await expect(
    page.getByRole("button", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Notifications marquées comme lues."),
  ).toBeVisible();
});

test("the history page groups the last 30 days with filters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1500 });
  await signIn(page);
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await page
    .getByRole("dialog", { name: "Notifications" })
    .getByRole("link", { name: "Voir tout l’historique" })
    .click();
  await expect(page).toHaveURL("/notifications");
  await expect(
    page.getByRole("heading", { level: 1, name: "Notifications" }),
  ).toBeVisible();
  const filters = page.getByRole("group", {
    name: "Filtrer les notifications",
  });
  for (const name of ["Toutes", "À traiter · 3", "Staff", "Données"])
    await expect(filters.getByRole("link", { name })).toBeVisible();
  await expect(
    page.getByRole("region", { name: /^Aujourd’hui · / }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: /^Hier · / })).toBeVisible();
  await expect(page.getByText("Appliqué", { exact: true })).toBeVisible();
  await expect(page.getByText("Hors de la fenêtre")).toHaveCount(0);
  await page.screenshot({ path: "test-results/notifications-history.png" });

  await filters.getByRole("link", { name: "Données" }).click();
  await expect(page).toHaveURL("/notifications?filtre=donnees");
  await expect(
    page.getByRole("button", {
      name: /Nouvelle activité : Footing · 50’/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Associée à ta séance · 8,32 km · 50:10 · 6:02 /km"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choisir la paire" }),
  ).toBeVisible();
  await expect(page.getByText("Envoyée", { exact: true })).toBeVisible();
  await expect(page.getByText("Rétablie", { exact: true })).toBeVisible();
  await expect(page.getByText(/Raccourcir ton seuil/)).toHaveCount(0);
  await expect(page.getByText(/Claire a répondu/)).toHaveCount(0);
  await page.screenshot({ path: "test-results/notifications-garmin.png" });
});

test("opening a notification marks it read and follows its link", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1020 });
  await signIn(page);
  await page.goto("/notifications?filtre=a-traiter");
  await page.getByRole("button", { name: "Voir la proposition" }).click();
  await expect(page).toHaveURL(
    "/plan?proposition=eeeeeeee-eeee-4eee-8eee-cdcdcdcd0001",
    { timeout: 20_000 },
  );
  await page.goto("/today");
  await expect(
    page.getByRole("button", { name: "Notifications, 2 non lues" }),
  ).toBeVisible();
});

test("a fresh Garmin run reaches the bell on the next load", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1020 });
  await signIn(page);
  await expect(
    page.getByRole("button", { name: "Notifications, 3 non lues" }),
  ).toBeVisible();
  await fetch(`http://127.0.0.1:${authPort}/__test__/garmin-import`, {
    method: "POST",
  });
  await page.goto("/plan");
  await expect(async () => {
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Notifications, 4 non lues" }),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.goto("/notifications?filtre=donnees");
  await expect(
    page.getByRole("button", { name: /Nouvelle activité : Sortie longue/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Sans séance prévue · 21,0 km · 2:20:00 · 6:40 /km"),
  ).toBeVisible();
});

test("the mobile bell links to the list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1180 });
  await signIn(page);
  const bell = page.getByRole("link", { name: "Notifications, 3 non lues" });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page).toHaveURL("/notifications");
  await expect(page.getByRole("button", { name: "Tout lire" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Voir la proposition" }),
  ).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/notifications-mobile.png" });
});

test("an athlete without notifications is up to date", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "records-empty@example.com");
  await page.goto("/notifications");
  await expect(page.getByText("Tu es à jour")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tout lire" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/notifications-empty.png" });
});

test("settings screens carry the bell", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1020 });
  await signIn(page);
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Notifications, 3 non lues" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("link", { name: "Notifications, 3 non lues" }),
  ).toBeVisible();
});
