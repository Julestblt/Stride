import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("a populated race opens every workspace section on desktop and mobile", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await request.post(
    `http://127.0.0.1:${process.env.PLAYWRIGHT_AUTH_PORT ?? 3200}/__test__/race-course`,
  );
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/races");
    await expect(
      page.getByRole("heading", { level: 1, name: "EcoTrail Paris 120K" }),
    ).toBeVisible();
    await expect(
      page.getByText("parcours-test.gpx").nth(viewport.width < 500 ? 1 : 0),
    ).toBeVisible();
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
    await expect(
      page.getByRole("heading", { name: /Points de passage/ }).first(),
    ).toBeVisible();
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
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/races");

  await expect(
    page.getByRole("heading", { name: "10 km de Paris" }),
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
  ).toHaveCount(0);
  await expect(page.getByText("Départ prévu à 09:00")).toBeVisible();
});
