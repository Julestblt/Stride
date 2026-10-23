import { expect, test } from "@playwright/test";
import { signInAs } from "./support/session";

test.describe.configure({ mode: "serial" });

test("a populated race opens every workspace section on desktop and mobile", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await request.post(
    `http://127.0.0.1:${process.env.PLAYWRIGHT_AUTH_PORT ?? 3200}/__test__/race-course`,
  );
  await signInAs(page, "athlete@example.com");

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/races");
    await page.getByRole("link", { name: "Ouvrir la course" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "EcoTrail Paris 120K" }),
    ).toBeVisible();
    await expect(
      page.getByText("parcours-test.gpx").nth(viewport.width < 500 ? 1 : 0),
    ).toBeVisible();
    const pace = page.locator("dl > div", { hasText: "Allure moy" });
    await expect(pace).toContainText("12:00 /km");
    if (viewport.width > 500)
      await expect(pace).toContainText("11:46 hors ravitos");
    const reading = page.locator("details", { hasText: "Lecture de Stride" });
    const summary = reading.locator("summary");
    await expect(summary.getByText("Lire l’analyse")).toBeVisible();
    await expect(reading).not.toHaveAttribute("open");
    await summary.focus();
    await summary.press("Enter");
    await expect(reading).toHaveAttribute("open");
    await expect(summary.getByText("Réduire")).toBeVisible();
    await summary.click();
    await expect(reading).not.toHaveAttribute("open");
    await expect(
      page.getByRole("link", { name: "Stratégie ↓" }),
    ).toHaveAttribute("href", "#strategie");
    await expect(summary.getByRole("link")).toHaveCount(0);
    const chart = page
      .locator('svg[aria-label^="Profil altimétrique"]:visible')
      .first();
    const aid = chart.locator('g[aria-label^="Ravito du Bois"]');
    await aid.locator("circle").first().hover();
    await expect(
      page.getByText("Ravito du Bois", { exact: true }),
    ).toBeVisible();
    await expect(chart.getByText("Ravito du Bois")).toHaveCount(0);
    await chart.focus();
    await chart.press("End");
    await expect(chart).toHaveAttribute("aria-label", /Km 30,0/);
    await aid.focus();
    await expect(
      page.getByText("Ravito du Bois", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        aid.evaluate((element) => getComputedStyle(element).outlineStyle),
      )
      .toBe("none");
    await expect
      .poll(() =>
        chart.evaluate((element) => getComputedStyle(element).outlineStyle),
      )
      .toBe("none");
    const map = page
      .getByRole("img", { name: /^Carte du parcours/ })
      .filter({ visible: true })
      .first();
    await map.scrollIntoViewIfNeeded();
    const marker = map.getByRole("button", { name: "Arrivée, km 30,0" });
    await expect(marker).toBeVisible();
    const centre = () =>
      marker.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const bounds = element.closest('[role="img"]')!.getBoundingClientRect();
        return {
          x: box.x + box.width / 2 - bounds.x,
          y: box.y + box.height / 2 - bounds.y,
        };
      });
    await expect
      .poll(async () => {
        const first = await centre();
        await page.waitForTimeout(200);
        const second = await centre();
        return Math.hypot(second.x - first.x, second.y - first.y);
      })
      .toBeLessThan(0.5);
    const before = await centre();
    const box = await marker.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect
      .poll(() =>
        marker
          .locator("span")
          .evaluate((element) => getComputedStyle(element).scale),
      )
      .toBe("1.1");
    const after = await centre();
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: `test-results/race-course-${viewport.width}.png`,
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
    await page.goto("/races/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/waypoints");
    const list = page.getByRole("heading", { name: /Points de passage/ });
    await expect(list).toBeVisible();
    if (viewport.width < 500) await expect(list).toContainText("4 points");
    await expect(page.getByRole("button", { name: /Départ/ })).toHaveCount(0);
    const row = page.getByRole("button", { name: /Ravito du Bois/ });
    await expect(row).toContainText("km 10,0");
    await expect(row).toContainText("Alerte");
    await row.click();
    await expect(row).toHaveAttribute("aria-current", "true");
    const editor = page.getByRole("region", {
      name: "Modifier Ravito du Bois",
    });
    await expect(
      editor.getByRole("heading", { name: "Modifier · Ravito du Bois" }),
    ).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Ravitaillement" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(editor.getByRole("checkbox", { name: "Eau" })).toBeChecked();
    await expect(editor.getByText("Accroché au tracé")).toBeVisible();
    await expect(editor.getByText("Dans 500 m")).toBeVisible();
    await page.screenshot({
      path: `test-results/race-waypoints-${viewport.width}.png`,
      fullPage: true,
    });
  }
});

test("a road 10 km keeps the relevant preparation and accepts a new start time", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await request.post(
    `http://127.0.0.1:${process.env.PLAYWRIGHT_AUTH_PORT ?? 3200}/__test__/race-road`,
  );
  await signInAs(page, "athlete@example.com");
  await page.goto("/races");
  await page.getByRole("link", { name: "Ouvrir la course" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "10 km de Paris" }),
  ).toBeVisible();
  const sections = page.getByRole("navigation", {
    name: "Sections de la course",
  });
  await expect(sections.getByRole("link", { name: "Parcours" })).toBeVisible();
  await expect(
    sections.getByRole("link", { name: "Préparation" }),
  ).toBeVisible();
  await expect(sections.getByRole("link", { name: "Nutrition" })).toHaveCount(
    0,
  );
  await expect(page.getByText("Simulation par tronçon")).toHaveCount(0);
  await expect(page.getByText("Marche en pente")).toHaveCount(0);
  await expect(
    page.locator("dl > div", { hasText: "Allure moy" }),
  ).toContainText("3:54 /km");
  await expect(page.getByText("sur l’objectif")).toBeVisible();
  const reading = page.locator("details", { hasText: "Repères de course" });
  await expect(page.getByRole("link", { name: "Stratégie ↓" })).toHaveCount(0);
  await reading.locator("summary").click();
  await expect(reading).toHaveAttribute("open");
  await page.screenshot({
    path: "test-results/race-road-1440.png",
    fullPage: true,
  });

  const profile = page
    .locator('svg[aria-label^="Profil altimétrique du parcours"]')
    .first();
  await profile.hover({ position: { x: 170, y: 120 } });
  await expect(profile).toHaveAttribute("aria-label", /passage estimé/);
  await profile.focus();
  await profile.press("End");
  await expect(profile).toHaveAttribute("aria-label", /passage estimé/);

  await page
    .getByRole("button", { name: "Modifier les réglages de la course" })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Heure de départ" }).fill("09:00");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByRole("dialog", { name: "Modifier la course" }),
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText("Départ prévu à 09:00")).toBeVisible({
    timeout: 15_000,
  });
});
