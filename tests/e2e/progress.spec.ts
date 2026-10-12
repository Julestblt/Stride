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

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`recovery tab renders Garmin signals at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto("/progress/recovery");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Une courte nuit pèse sur ta forme du jour.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Forme du jour · Garmin")).toBeVisible();
    const sleep = page.getByRole("region", { name: /Sommeil/ });
    await expect(sleep.getByText("5h52", { exact: true })).toBeVisible();
    await expect(sleep.getByText("À surveiller · 1 nuit")).toBeVisible();
    const hrv = page.getByRole("region", { name: /VFC nocturne/ });
    await expect(hrv.getByText("46 ms")).toBeVisible();
    await expect(hrv.getByText("Sous la plage · 1 jour")).toBeVisible();
    await expect(
      page.getByText("Aucune course passée avec des mesures de VFC."),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}

test("athlete records how they feel today", async ({ page }) => {
  await signIn(page);
  await page.goto("/progress/recovery");
  const checkin = page.getByRole("region", { name: /Ton ressenti/ });
  await expect(checkin.getByText("À saisir")).toBeVisible();
  const legs = checkin.getByRole("radiogroup", { name: "Jambes" });
  await legs.getByRole("radio", { name: "Fraîches" }).click();
  await expect(legs.getByRole("radio", { name: "Fraîches" })).toBeChecked();
  await expect(checkin.getByText(/^Saisi à \d{2}:\d{2}$/)).toBeVisible();
  await checkin
    .getByRole("radiogroup", { name: "Stress" })
    .getByRole("radio", { name: "Élevé" })
    .click();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: /Ton ressenti/ })
      .getByRole("radiogroup", { name: "Jambes" })
      .getByRole("radio", { name: "Fraîches" }),
  ).toBeChecked();
  await expect(page.getByText("Tu as noté des jambes fraîches.")).toBeVisible();
});

test("progress tabs switch between fitness and recovery", async ({ page }) => {
  await signIn(page);
  await page.goto("/progress");
  await page
    .getByRole("navigation", { name: "Sections de la progression" })
    .last()
    .getByRole("link", { name: "Récupération" })
    .click();
  await expect(page).toHaveURL("/progress/recovery");
  await expect(
    page
      .getByRole("navigation", { name: "Fil d’Ariane" })
      .getByText("Récupération"),
  ).toBeVisible();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`health week view renders Garmin signals at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto("/progress/health");
    await expect(
      page.getByRole("heading", { level: 1, name: "Santé" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Tu récupères bien de la charge, mais ton sommeil ne suit plus.",
      }),
    ).toBeVisible();
    const sleep = page.getByRole("region", { name: "Sommeil" });
    await expect(sleep.getByText("5h52", { exact: true })).toBeVisible();
    await expect(sleep.getByText("58 min")).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Charge et forme" })
        .getByText("Aérobie faible", { exact: true }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}

test("health switches to the month and explains values on hover", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/progress/health");
  await page
    .getByRole("navigation", { name: "Période" })
    .getByRole("link", { name: "Mois" })
    .click();
  await expect(page).toHaveURL("/progress/health?view=month");
  await expect(page.getByText("Garmin · sommeil · 30 nuits")).toBeVisible();
  const chart = page
    .getByRole("region", { name: "Sommeil" })
    .getByRole("group", { name: /Durée de sommeil/ });
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  await chart.hover({ position: { x: box.width - 4, y: box.height / 2 } });
  await expect(chart.getByRole("status")).toContainText("5h52");
  await expect(chart.getByRole("status")).toContainText("Ta moyenne");
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`health day view explains the day at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto("/progress/health?view=day&date=2026-10-10");
    await expect(
      page
        .getByRole("region", { name: "Choisir une journée" })
        .getByText("sam. 10 oct.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Nuit courte, journée chargée.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Nuit du 9 au 10" }),
    ).toBeVisible();
    const moments = page.getByRole("region", { name: "Moments de la journée" });
    await expect(moments.getByText("Stress élevé · 1h15")).toBeVisible();
    const timeline = page.getByRole("group", {
      name: /Ta journée heure par heure/,
    });
    await timeline.scrollIntoViewIfNeeded();
    const box = (await timeline.boundingBox())!;
    await timeline.hover({
      position: { x: box.width * 0.54, y: box.height / 2 },
    });
    await expect(timeline.getByRole("status")).toContainText("Body Battery");
    await expect(timeline.getByRole("status")).toContainText("Stress");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}

test("health day navigation moves between days", async ({ page }) => {
  await signIn(page);
  await page.goto("/progress/health?view=day&date=2026-10-10");
  await page.getByRole("link", { name: "Jour suivant" }).click();
  await expect(page).toHaveURL("/progress/health?view=day&date=2026-10-11");
  await page.getByRole("link", { name: "Jour précédent" }).click();
  await expect(page).toHaveURL("/progress/health?view=day&date=2026-10-10");
});

test("signed-out visitors cannot open Records", async ({ page }) => {
  await page.goto("/progress/records");
  await expect(page).toHaveURL(/\/sign-in$/);
});
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Records filters, disclosures and charts at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto("/progress/records");
    await expect(
      page.getByRole("heading", { level: 1, name: "Records" }),
    ).toBeVisible();
    const road = page.getByRole("region", { name: "Route", exact: true });
    await expect(road).toBeVisible();
    await expect(
      road
        .locator('[data-slot="confidence-meter"][data-level="moderate"]')
        .first(),
    ).toContainText("Confiance modérée");
    await expect(
      road.locator('[data-slot="confidence-meter"][data-level="low"]'),
    ).toContainText("Confiance faible");
    const disclosure = road.locator("details").first();
    if (viewport.width === 390)
      await expect(
        disclosure.getByText("· 5:30/km", { exact: true }),
      ).toBeVisible();
    await disclosure.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAttribute("open", "");
    const chart = disclosure.getByRole("group", {
      name: /^Historique du record/,
    });
    await chart.focus();
    await chart.press("Home");
    await expect(chart.getByRole("status")).toContainText("Garmin");
    await chart.press("ArrowRight");
    await chart.press("Escape");
    const chartBounds = await chart.boundingBox();
    await chart.dispatchEvent("pointerdown", {
      pointerType: "touch",
      clientX: chartBounds!.x + chartBounds!.width / 2,
      clientY: chartBounds!.y + chartBounds!.height / 2,
    });
    await expect(chart.getByRole("status")).toContainText("Garmin");
    const source = disclosure.getByRole("link", {
      name: "Ouvrir l’activité du record →",
    });
    await expect(source).toHaveAttribute("href", /\/activities\//);
    const href = await source.getAttribute("href");
    await source.click();
    await expect(page).toHaveURL(href!, { timeout: 15_000 });
    await page.goBack();
    const filters = page.getByRole("navigation", { name: "Type de records" });
    await filters.getByRole("link", { name: "Trail et ultra" }).click();
    await expect(page).toHaveURL(/filter=trail/);
    await expect(
      page.getByRole("region", { name: "Route", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Trail et ultra", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("article")
        .filter({ has: page.getByRole("heading", { name: "VAM sur 20 min" }) })
        .locator("[data-slot=metric]"),
    ).toContainText("840");
    await page.reload();
    await expect(
      filters.getByRole("link", { name: "Trail et ultra" }),
    ).toHaveAttribute("aria-current", "page");
    await filters.getByRole("link", { name: "Route", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Trail et ultra", exact: true }),
    ).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/filter=trail/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await filters.getByRole("link", { name: "Tous", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Courses terminées" }),
    ).toContainText("ne sont pas encore disponibles");
    await expect(
      filters.getByRole("link", { name: "Tous", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("region", { name: "Route", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Prochains records à portée" })
        .getByRole("link", { name: "EcoTrail Paris 120K →" }),
    ).toHaveAttribute("href", "/races/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    await page.evaluate(() => document.fonts.ready);
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.width === 390 ? 4080 : 2942,
    });
    await page.screenshot({
      path: `test-results/records-${viewport.width}.png`,
    });
    await page.setViewportSize(viewport);
    const finalRoad = page.getByRole("region", { name: "Route", exact: true });
    const finalDisclosure = finalRoad.locator("details").first();
    await finalDisclosure.locator(":scope > summary").click();
    await finalDisclosure.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/records-road-${viewport.width}.png`,
    });
    const endurance = page.getByRole("region", {
      name: "Trail et ultra",
      exact: true,
    });
    await endurance.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/records-endurance-${viewport.width}.png`,
    });
  });
}
for (const mode of ["empty", "failure", "goal-failure"] as const) {
  test(`Records displays explicit ${mode} state`, async ({ page }) => {
    await page.goto("/sign-in");
    await page
      .getByLabel("Email", { exact: true })
      .fill(`records-${mode}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/progress/records");
    await expect(
      page.getByRole("heading", { level: 1, name: "Records" }),
    ).toBeVisible();
    if (mode === "empty") {
      await expect(
        page.getByRole("heading", {
          name: "Tes records attendent ton historique.",
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Aucun record documenté pour ce filtre."),
      ).toBeVisible();
    } else
      await expect(page.getByRole("alert")).toContainText(
        "Impossible de lire ton historique",
      );
    await page
      .getByRole("navigation", { name: "Sections de la progression" })
      .first()
      .getByRole("link", { name: "Forme", exact: true })
      .click();
    await expect(page).toHaveURL("/progress", { timeout: 15_000 });
  });
}
