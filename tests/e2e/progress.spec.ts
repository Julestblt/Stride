import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./support/session";

function signIn(page: Page) {
  return signInAs(page, "athlete@example.com");
}

test("signed-out visitors cannot open progress", async ({ page }) => {
  await page.goto("/progress");
  await expect(page).toHaveURL(/\/sign-in$/);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Forme renders the goal, load and measures at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto("/progress");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const goal = page.getByRole("region", { name: "EcoTrail Paris 120K" });
    await expect(goal.getByRole("link")).toHaveAttribute(
      "href",
      "/races/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    await expect(
      goal.getByText(
        "Pas de prévision de temps fiable en ultra : Stride suit ta préparation.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Condition et fatigue" }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /^Condition \d+, fatigue \d+/ }).first(),
    ).toBeAttached();
    const predictions = page.getByRole("region", {
      name: "Prévisions de course",
    });
    await expect(predictions.getByText("45:02")).toBeVisible();
    await expect(predictions.getByText("−0:18")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Course à pied · km par semaine" }),
    ).toContainText("Cette semaine :");
    const measures = page.getByRole("region", { name: "Ce qui évolue" });
    await expect(measures.getByText("Efficacité aérobie")).toBeVisible();
    await expect(
      measures.getByRole("link", { name: /Régularité/ }),
    ).toHaveAttribute("href", "/plan");
    await expect(
      measures.getByText("Disponible avec un plan d’entraînement"),
    ).toBeVisible();
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
  test(`Corps renders readiness, factors and nights at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto("/progress/body");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Une courte nuit pèse sur ta forme du jour.",
      }),
    ).toBeVisible();
    const readiness = page.getByRole("region", {
      name: "Prêt pour aujourd’hui ?",
    });
    await expect(readiness.getByText(/^Modéré|^Bas/)).toBeVisible();
    const factors = page.getByRole("region", {
      name: "Ce qui pèse aujourd’hui",
    });
    await expect(factors.getByText("Sommeil · 5h52")).toBeVisible();
    await expect(factors.getByText("VFC · 46 ms")).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "VFC nocturne" })
        .getByText("Sous ta plage"),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Nuits" })).toBeVisible();
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
  await page.goto("/progress/body");
  const checkin = page.getByRole("region", { name: "Ton ressenti" });
  await expect(checkin.getByText("À saisir ce matin")).toBeVisible();
  const legs = checkin.getByRole("radiogroup", { name: "Jambes" });
  await legs.getByRole("radio", { name: "Fraîches" }).click();
  await expect(legs.getByRole("radio", { name: "Fraîches" })).toBeChecked();
  await expect(
    checkin.getByText(/^ce matin · enregistré à \d{2}:\d{2}$/),
  ).toBeVisible();
  await checkin
    .getByRole("radiogroup", { name: "Stress hors sport" })
    .getByRole("radio", { name: "Élevé" })
    .click();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Ton ressenti" })
      .getByRole("radiogroup", { name: "Jambes" })
      .getByRole("radio", { name: "Fraîches" }),
  ).toBeChecked();
  await expect(
    page.getByText("Tu as noté des jambes fraîches.").filter({ visible: true }),
  ).toBeVisible();
});

test("progress tabs switch between Forme and Corps", async ({ page }) => {
  await signIn(page);
  await page.goto("/progress");
  await page
    .getByRole("navigation", { name: "Sections de la progression" })
    .last()
    .getByRole("link", { name: "Corps" })
    .click();
  await expect(page).toHaveURL("/progress/body");
  await expect(
    page.getByRole("navigation", { name: "Fil d’Ariane" }).getByText("Corps"),
  ).toBeVisible();
});

test("old Récupération and Santé links land on Corps", async ({ page }) => {
  await signIn(page);
  await page.goto("/progress/recovery");
  await expect(page).toHaveURL("/progress/body");
  await page.goto("/progress/health?view=month");
  await expect(page).toHaveURL("/progress/body?view=month");
  await page.goto("/progress/health?view=day&date=2026-10-10");
  await expect(page).toHaveURL("/progress/body?view=day&date=2026-10-10");
});

test("Corps switches to 30 days and explains nights on hover", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/progress/body");
  await page
    .getByRole("navigation", { name: "Échelle" })
    .getByRole("link", { name: "30 jours" })
    .click();
  await expect(page).toHaveURL("/progress/body?view=month");
  const chart = page
    .getByRole("region", { name: "Nuits" })
    .getByRole("group", { name: /Durée et phases de sommeil des 30/ });
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
  test(`Corps day view explains the day at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto("/progress/body?view=day&date=2026-10-10");
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

test("Corps day navigation moves between days", async ({ page }) => {
  await signIn(page);
  await page.goto("/progress/body?view=day&date=2026-10-10");
  await page.getByRole("link", { name: "Jour suivant" }).click();
  await expect(page).toHaveURL("/progress/body?view=day&date=2026-10-11");
  await page.getByRole("link", { name: "Jour précédent" }).click();
  await expect(page).toHaveURL("/progress/body?view=day&date=2026-10-10");
});

test("the health day shows the stored strip before the Garmin day arrives", async ({
  page,
}) => {
  const garminUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_GARMIN_PORT ?? 3300}`;
  const hold = (held: boolean) =>
    fetch(`${garminUrl}/__test__/wellness`, {
      method: "POST",
      body: JSON.stringify({ day: "2026-10-07", hold: held }),
    });
  expect((await hold(true)).ok).toBe(true);
  try {
    await signIn(page);
    await page.goto("/progress/body?view=day&date=2026-10-07", {
      waitUntil: "commit",
    });
    await expect(
      page
        .getByRole("region", { name: "Choisir une journée" })
        .getByText("mer. 7 oct.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Chargement de la journée" }),
    ).toBeVisible();
  } finally {
    await hold(false);
  }
  await expect(
    page.getByRole("status", { name: "Chargement de la journée" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Moments de la journée" }),
  ).toBeVisible();
});

test("signed-out visitors cannot open Records", async ({ page }) => {
  await page.goto("/progress/records");
  await expect(page).toHaveURL(/\/sign-in$/);
});
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Records shows markers, speed and endurance at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);
    await page.goto("/progress/records");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const markers = page.getByRole("region", { name: "Tes repères actuels" });
    await expect(markers.getByText("4:38")).toBeVisible();
    await expect(markers.getByText("171")).toBeVisible();
    await expect(
      markers.getByRole("link", { name: "Voir tes zones d’allure et de FC →" }),
    ).toHaveAttribute("href", "/settings/profile#entrainement");
    const speed = page.getByRole("region", { name: "Vitesse" });
    await expect(speed.getByText("Marathon", { exact: true })).toBeVisible();
    await expect(speed.getByText("prévision 3:33:40")).toBeVisible();
    const endurance = page.getByRole("region", { name: "Endurance" });
    await expect(endurance.getByText("VAM sur 20 min")).toBeVisible();
    await expect(endurance.getByText("840 m/h")).toBeVisible();
    const source = endurance.getByRole("link", { name: /Plus longue sortie/ });
    await expect(source).toHaveAttribute("href", /\/activities\//);
    await expect(
      page
        .getByRole("region", { name: "À portée" })
        .getByRole("link", { name: /EcoTrail Paris 120K/ }),
    ).toHaveAttribute("href", "/races/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
}
for (const mode of ["empty", "failure", "goal-failure"] as const) {
  test(`Records displays explicit ${mode} state`, async ({ page }) => {
    await signInAs(page, `records-${mode}@example.com`);
    await page.goto("/progress/records");
    if (mode === "empty") {
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Tes records attendent ton historique.",
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Aucun record d’endurance documenté."),
      ).toBeVisible();
    } else
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Impossible de lire ton historique" }),
      ).toContainText("Impossible de lire ton historique");
    await page
      .getByRole("navigation", { name: "Sections de la progression" })
      .first()
      .getByRole("link", { name: "Forme", exact: true })
      .click();
    await expect(page).toHaveURL("/progress", { timeout: 15_000 });
  });
}
