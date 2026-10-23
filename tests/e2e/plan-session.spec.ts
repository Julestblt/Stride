import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./support/session";

const authUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_AUTH_PORT ?? 3200}`;

function signIn(page: Page) {
  return signInAs(page, "plan@example.com");
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
  await expect(page).toHaveURL(/\/today$/);
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

function lastMonday() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
  }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) - 7);
  return date.toISOString().slice(0, 10);
}

test("a mobility session is checked in by hand and undone", async ({
  page,
}) => {
  const reset = await fetch(`${authUrl}/__test__/plan-import`, {
    method: "DELETE",
  });
  expect(reset.ok).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  const monday = lastMonday();
  const strengthDay = new Date(`${monday}T00:00:00Z`);
  strengthDay.setUTCDate(strengthDay.getUTCDate() + 4);
  await page.goto(
    `/plan?week=${monday}&seance=s-${strengthDay.toISOString().slice(0, 10)}-1`,
  );
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 2 }),
  ).toHaveText("Renfo haut du corps", { timeout: 20_000 });
  await expect(
    page.getByRole("button", { name: "C’est fait", exact: true }),
  ).toHaveCount(0);

  await page.goto(`/plan?week=${monday}&seance=s-${monday}-1`);
  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText(
    "Mobilité et marche",
    { timeout: 20_000 },
  );
  const tile = sessionLinks(page).filter({ hasText: /Mobilité et marche/ });
  await expect(tile).not.toContainText("Fait");
  await panel.getByRole("button", { name: "C’est fait", exact: true }).click();
  await expect(page.getByText("Séance notée comme faite")).toBeVisible();
  await expect(panel.getByText("Fait · noté par toi")).toBeVisible();
  await expect(tile).toContainText("Fait");

  await panel.getByRole("button", { name: "Annuler « C’est fait »" }).click();
  await expect(page.getByText("C’est fait annulé")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "C’est fait", exact: true }),
  ).toBeVisible();
  await expect(panel.getByText("Fait · noté par toi")).toHaveCount(0);
  await expect(tile).not.toContainText("Fait");
});

test("a matched structured run shows its debrief and takes a feeling", async ({
  page,
}) => {
  const activityId = "aaaaaaaa-aaaa-4aaa-8aaa-000000005002";
  const reset = await fetch(
    `${authUrl}/__test__/activity-feelings?activity=${activityId}`,
    { method: "DELETE" },
  );
  expect(reset.ok).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/activities/${activityId}`);
  const section = page.getByRole("region", { name: "Débrief de la séance" });
  await expect(section).toBeVisible({ timeout: 20_000 });
  await expect(section.getByText("Séance écourtée")).toBeVisible();
  await section.getByRole("link", { name: "Voir dans le plan" }).click();

  const panel = page.getByRole("dialog");
  await expect(panel.getByRole("heading", { level: 2 })).toContainText(
    "Seuil",
    { timeout: 20_000 },
  );
  await expect(
    panel.getByText(/10 tours alignés sur les 10 étapes$/),
  ).toBeVisible();
  const steps = panel.getByRole("region", { name: "Étape par étape" });
  await expect(steps.getByText("Seuil 1", { exact: true })).toBeVisible();
  await expect(
    steps.getByRole("listitem").filter({ hasText: "Seuil 4" }),
  ).toContainText("Écourtée");

  const feeling = panel.getByRole("region", { name: "Ton ressenti" });
  await feeling
    .getByRole("radiogroup", { name: "Effort perçu, de 1 à 10" })
    .getByRole("radio", { name: "7" })
    .click();
  await feeling
    .getByRole("radiogroup", { name: "Sensations" })
    .getByRole("radio", { name: "Bien", exact: true })
    .click();
  await expect(page.getByText("Ressenti enregistré.")).toBeVisible();
  await expect(panel.getByText("Noté par toi")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Modifier" })).toBeVisible();

  await panel.getByRole("link", { name: "En parler au coach" }).click();
  await expect(page).toHaveURL(/\/coach\/nouvelle\?seance=s-/, {
    timeout: 20_000,
  });
  await expect(
    page.getByRole("button", { name: /^Retirer Seuil .* du contexte$/ }),
  ).toBeVisible();
});
