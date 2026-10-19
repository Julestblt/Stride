import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail", { exact: true }).fill("athlete@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL("/");
}

test("signed-out athletes are sent to sign-in", async ({ page }) => {
  await page.goto("/activities");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("activities are grouped, filtered through the URL and opened in place", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/activities");
  await expect(
    page.getByRole("heading", { level: 1, name: "Activités" }),
  ).toBeVisible();
  const sidebar = page.locator('[data-sidebar="sidebar"]').first();
  await expect(sidebar.getByRole("link", { name: /A EcoTrail Paris 120K/ })).toBeVisible();
  await expect(sidebar.getByText(/Course A · J-\d+/)).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "Activités" }),
  ).toHaveAttribute("aria-current", "page");
  const list = page.locator("ul").filter({ hasText: "Course à pied" }).first();
  await expect(list).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Course à pied" }),
  ).toBeVisible();
  await expect(page.getByText("Tout vient de Garmin")).toBeVisible();
  await expect(page.getByText("Trail · Fontainebleau")).toBeVisible();
  await expect(page.getByText("Renforcement")).toBeVisible();

  await page
    .getByRole("navigation", { name: "Filtrer les activités" })
    .getByRole("link", { name: "Trail" })
    .click();
  await expect(page).toHaveURL(/\/activities\?filter=trail$/);
  await expect(
    page
      .getByRole("navigation", { name: "Filtrer les activités" })
      .getByRole("link", { name: "Trail" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Renforcement")).toHaveCount(0);

  await page.getByRole("link", { name: /Trail · Trail 80K/ }).click();
  await expect(page).toHaveURL(
    /\/activities\/aaaaaaaa-aaaa-4aaa-8aaa-000000000005\?filter=trail$/,
  );
  const detail = page.getByRole("article");
  await expect(
    detail.getByRole("heading", { level: 1, name: "Trail · Trail 80K" }),
  ).toBeVisible();
  await expect(detail.getByText("80,2")).toBeVisible();
  await expect(detail.getByText("11:15:00")).toBeVisible();
  await expect(detail.getByText("1 620")).toBeVisible();
  await expect(detail.getByText("FC moy.")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Trail · Trail 80K/ }),
  ).toHaveAttribute("aria-current", "true");
});

test("the selected preview expands and stays centered on a wide desktop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/activities");
  const article = page.getByRole("article");
  await expect(
    article.getByRole("heading", { level: 2, name: "Course à pied" }),
  ).toBeVisible();

  const referenceWidth = await article.evaluate((element) => {
    const parent = element.parentElement!;
    return Math.min(parent.clientWidth, 960);
  });
  await expect(article).toHaveJSProperty("offsetWidth", referenceWidth);
  await page.screenshot({
    path: "test-results/activity-preview-reference-desktop.png",
  });

  await page.setViewportSize({ width: 2560, height: 1440 });

  const geometry = await article.evaluate((element) => {
    const article = element.getBoundingClientRect();
    const pane = element.parentElement!.getBoundingClientRect();
    return {
      articleWidth: article.width,
      articleLeft: article.left,
      expectedLeft: pane.left + (pane.width - article.width) / 2,
    };
  });
  expect(geometry.articleWidth).toBe(1440);
  expect(Math.abs(geometry.articleLeft - geometry.expectedLeft)).toBeLessThan(
    1,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(2560);
  await page.screenshot({
    path: "test-results/activity-preview-wide-desktop.png",
  });
});

test("the list and the detail scroll independently inside a fixed-height shell", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await signIn(page);
  await page.goto("/activities");
  const list = page.getByRole("region", { name: "Liste des activités" });
  await expect(list.getByText("50 sur 75 activités")).toBeVisible();
  const fits = () =>
    page.evaluate(
      () =>
        document.documentElement.scrollHeight <= window.innerHeight &&
        document.documentElement.scrollTop === 0,
    );
  expect(await fits()).toBe(true);
  const breadcrumb = page.getByRole("navigation", { name: "Fil d’Ariane" });
  await expect(breadcrumb).toBeInViewport();
  const detail = page.getByRole("article").locator("xpath=..");
  const scrollable = await list.evaluate(
    (element) => element.scrollHeight - element.clientHeight,
  );
  expect(scrollable).toBeGreaterThan(1500);

  await list.evaluate((element) => {
    element.scrollTop = 1500;
  });
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(1400);
  expect(await detail.evaluate((element) => element.scrollTop)).toBe(0);
  expect(await fits()).toBe(true);
  await expect(breadcrumb).toBeInViewport();
  const stuck = await list.evaluate((element) => {
    const top = element.getBoundingClientRect().top;
    return Array.from(element.querySelectorAll("h2")).some(
      (heading) => Math.abs(heading.getBoundingClientRect().top - top) <= 1,
    );
  });
  expect(stuck).toBe(true);

  await page.getByRole("link", { name: "Charger les suivantes" }).click();
  await expect(page).toHaveURL(/\/activities\?limit=100$/);
  await expect(list.getByText("75 sur 75 activités")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Charger les suivantes" }),
  ).toHaveCount(0);
  expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(
    1000,
  );
  const target = list.getByRole("link", { name: /Course à pied/ }).nth(30);
  await target.scrollIntoViewIfNeeded();
  const before = await list.evaluate((element) => element.scrollTop);
  await target.click();
  await expect(page).toHaveURL(
    /\/activities\/aaaaaaaa-aaaa-4aaa-8aaa-[0-9a-f]{12}\?limit=100$/,
  );
  await expect(page.getByRole("article")).toBeVisible();
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(before - 5);
  expect(await list.evaluate((element) => element.scrollTop)).toBeLessThan(
    before + 5,
  );
  await expect(list.locator('[aria-current="true"]')).toBeInViewport();
});

test("the full detail shows laps, effort and provenance from stored rows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto(
    "/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000004?filter=road",
  );
  await Promise.all([
    page.waitForURL(
      /\/activities\/aaaaaaaa-aaaa-4aaa-8aaa-000000000004\/details\?filter=road$/,
    ),
    page.getByRole("link", { name: /Détail complet/ }).click(),
  ]);
  await expect(page).toHaveURL(
    /\/activities\/aaaaaaaa-aaaa-4aaa-8aaa-000000000004\/details\?filter=road$/,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Threshold 3 × 10 min" }),
  ).toBeVisible();
  const table = page.getByRole("table", { name: "Tours" });
  await expect(table.getByRole("row")).toHaveCount(8);
  const rep = table.getByRole("row").nth(2);
  await expect(rep.getByRole("rowheader")).toHaveText("2");
  await expect(rep).toContainText("10:00");
  await expect(rep).toContainText("2,27");
  await expect(rep).toContainText("4:24");
  await expect(rep).toContainText("161");
  const effort = page.getByRole("region", { name: "Effort" });
  await expect(effort).toContainText("Effet aérobie");
  await expect(effort).toContainText("3,4");
  await expect(effort).toContainText("FC max");
  await expect(effort).toContainText("176");
  await expect(effort).not.toContainText("Puissance");
  await expect(effort).not.toContainText("Garmin");
  await expect(effort.locator('[data-slot="provenance"]')).toHaveCount(0);
  await expect(effort.locator("dd:empty")).toHaveCount(0);
  await expect(page.getByText("détail importé le 07/10/2026")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
  await Promise.all([
    page.waitForURL(/\/activities\?filter=road$/),
    page
      .getByRole("navigation", { name: "Fil d’Ariane" })
      .getByRole("link", { name: "Activités" })
      .click(),
  ]);
  await expect(page).toHaveURL(/\/activities\?filter=road$/);
});

test("the full detail says when Garmin sent no laps and stays within 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signIn(page);
  await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000001/details");
  await expect(
    page
      .getByRole("article")
      .getByText("Garmin n’a transmis aucun tour pour cette activité."),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000004/details");
  await expect(page.getByRole("table", { name: "Tours" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Cad." })).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .getByRole("table", { name: "Tours" })
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  const response = await page.goto(
    "/activities/cccccccc-cccc-4ccc-8ccc-cccccccccccc/details",
  );
  expect(response?.status()).toBe(404);
});

test("an unknown or foreign activity is not found", async ({ page }) => {
  await signIn(page);
  for (const id of ["not-an-id", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"]) {
    const response = await page.goto(`/activities/${id}`);
    expect(response?.status()).toBe(404);
  }
});

test("mobile shows the list, then the activity alone, without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/activities");
  await expect(page.getByRole("article")).toBeHidden();
  await page
    .getByRole("link", { name: /Course à pied/ })
    .first()
    .click();
  await expect(page.getByRole("article")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Activités" }),
  ).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Retour aux activités" }).click();
  await expect(page).toHaveURL(/\/activities$/);
  await page
    .getByRole("button", { name: "Afficher ou masquer la barre latérale" })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Activités" }),
  ).toBeVisible();
});

test("normalized tracks show real charts, zone time and a usable route fallback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("https://basemaps.cartocdn.com/**", (route) =>
    route.abort(),
  );
  await signIn(page);
  await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000004/details");
  await expect(
    page.getByRole("heading", { level: 1, name: "Threshold 3 × 10 min" }),
  ).toBeVisible();
  const route = page.getByRole("region", { name: "Parcours", exact: true });
  await expect(route).toBeVisible();
  await expect(route.getByRole("img", { name: /Tracé GPS/ })).toBeVisible();
  const modes = route.getByRole("radiogroup", { name: "Colorer le tracé par" });
  await modes.getByRole("radio", { name: "Allure", exact: true }).click();
  await expect(
    modes.getByRole("radio", { name: "Allure", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await modes.getByRole("radio", { name: "FC", exact: true }).click();
  await expect(
    modes.getByRole("radio", { name: "FC", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByText("Gris : tours plus rapides · estimation Stride"),
  ).toBeVisible();
  await expect(
    page.getByText("Bande jaune : Z4 estimée par Stride"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/activity-detail-desktop-top.png",
  });
  await page
    .getByRole("region", { name: "Graphiques de l’activité" })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("img", {
      name: "Fréquence cardiaque selon le temps écoulé",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Temps dans les zones" }),
  ).toBeVisible();
  await page.getByRole("region", { name: "Effort" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("region", { name: "Effort" })).toContainText(
    "720",
  );
  await page.screenshot({
    path: "test-results/activity-detail-desktop.png",
    fullPage: true,
  });
});

test("samples without GPS retain heart rate charts without running pace", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000003/details");
  await expect(
    page.getByText("Aucun tracé GPS n’est disponible pour cette activité."),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Fréquence cardiaque selon le temps écoulé",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Allure selon le temps écoulé",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("radiogroup", { name: "Colorer le tracé par" }),
  ).toHaveCount(0);
});

test("route controls and full detail fit narrow screens", async ({ page }) => {
  await page.route("https://basemaps.cartocdn.com/**", (route) =>
    route.abort(),
  );
  await signIn(page);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000004/details");
    const route = page.getByRole("region", { name: "Parcours", exact: true });
    await expect(route).toBeVisible();
    await route.getByRole("radio", { name: "Altitude", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const article = page.getByRole("article");
    expect(
      await article.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    if (width === 390) {
      await article.evaluate((element) => {
        if (element.parentElement) element.parentElement.scrollTop = 0;
      });
      await page.screenshot({
        path: "test-results/activity-detail-mobile.png",
        fullPage: true,
      });
    }
  }
});

test("the bundled map worker renders a GPS route with map controls", async ({
  page,
}) => {
  await page.route("https://basemaps.cartocdn.com/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#080907" },
          },
        ],
      }),
    }),
  );
  await signIn(page);
  await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000004/details");
  const route = page.getByRole("region", { name: "Parcours", exact: true });
  await expect(route.getByRole("button", { name: "Zoom avant" })).toBeVisible({
    timeout: 15000,
  });
  await route.getByRole("button", { name: "Zoom avant" }).click();
  await route.getByRole("button", { name: "Recentrer le tracé" }).click();
  await expect(route.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "test-results/activity-detail-map.png" });
});

test("all four charts inspect recorded values on hover and with the keyboard", async ({
  page,
}) => {
  await page.route("https://basemaps.cartocdn.com/**", (route) =>
    route.abort(),
  );
  await signIn(page);
  await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000004/details");
  for (const [title, value] of [
    ["Allure", "5:33 min/km"],
    ["Fréquence cardiaque", "125 bpm"],
    ["Cadence", "168 pas/min"],
    ["Altitude", "42 m"],
  ]) {
    const chart = page.getByRole("region", { name: title, exact: true });
    const plot = chart.getByRole("img");
    await expect(async () => {
      await page.mouse.move(0, 0);
      await plot.hover({ position: { x: 1, y: 60 } });
      await expect(chart.getByRole("status")).toContainText(value);
    }).toPass({ timeout: 15_000 });
    await expect(chart.getByRole("status")).toContainText(
      "Temps écoulé · 0:00",
    );
    await page.mouse.move(0, 0);
    await expect(chart.getByRole("status")).toHaveCount(0);
    const inspection = chart.getByRole("group");
    await inspection.focus();
    await expect(chart.getByRole("status")).toContainText(value);
    await inspection.press("ArrowRight");
    await expect(chart.getByRole("status")).toContainText(
      "Temps écoulé · 0:36",
    );
    await inspection.press("End");
    await expect(chart.getByRole("status")).toContainText(
      "Temps écoulé · 58:40",
    );
    await inspection.press("Home");
    await expect(chart.getByRole("status")).toContainText(
      "Temps écoulé · 0:00",
    );
    await inspection.press("Escape");
    await expect(chart.getByRole("status")).toHaveCount(0);
    await inspection.press("ArrowRight");
    await inspection.press("Tab");
    await expect(chart.getByRole("status")).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Fil d’Ariane" })
      .getByRole("link", { name: "Activités" })
      .focus();
  }
});

test.describe("touch chart inspection", () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 844 } });
  test("keeps all chart annotations readable within a narrow screen", async ({
    page,
  }) => {
    await page.route("https://basemaps.cartocdn.com/**", (route) =>
      route.abort(),
    );
    await signIn(page);
    await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000004/details");
    for (const title of [
      "Allure",
      "Fréquence cardiaque",
      "Cadence",
      "Altitude",
    ]) {
      const chart = page.getByRole("region", { name: title, exact: true });
      await chart.getByRole("img").tap();
      const annotation = chart.getByRole("status");
      await expect(annotation).toBeVisible();
      await expect(annotation).not.toContainText("Temps écoulé · 0:00");
      const bounds = await annotation.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.screenshot({
      path: "test-results/activity-chart-inspection-mobile.png",
    });
  });
});

test("selected preview reuses the map, factual effort and two recorded charts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("https://basemaps.cartocdn.com/**", (route) =>
    route.abort(),
  );
  await signIn(page);
  await page.goto("/activities");
  await expect(
    page.getByRole("article").getByRole("heading", { name: "Course à pied" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toContainText("Aucun tracé GPS");
  await page
    .getByRole("button", { name: "Afficher ou masquer la barre latérale" })
    .last()
    .click();
  await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000004");
  const article = page.getByRole("article");
  await expect(
    article
      .getByRole("region", { name: "Parcours", exact: true })
      .getByRole("img", { name: /Tracé GPS/ }),
  ).toBeVisible();
  await expect(
    article.getByRole("region", { name: "Effort enregistré" }),
  ).toContainText("720");
  await expect(
    article.getByRole("region", { name: "Cadence", exact: true }),
  ).toHaveCount(0);
  await expect(
    article.getByRole("region", { name: "Altitude", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/activities-preview-desktop.png",
  });
  const heartRate = article.getByRole("region", {
    name: "Fréquence cardiaque",
    exact: true,
  });
  await heartRate.getByRole("group").focus();
  await expect(heartRate.getByRole("status")).toContainText("125 bpm");
  await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000003");
  await expect(article).toContainText("Aucun tracé GPS");
  await expect(
    article.getByRole("region", { name: "Fréquence cardiaque", exact: true }),
  ).toBeVisible();
  await expect(
    article.getByRole("region", { name: "Allure", exact: true }),
  ).toHaveCount(0);
});

test("name search filters before pagination and keeps context through drill-down", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/activities?limit=100&filter=road");
  await page
    .getByRole("searchbox", { name: "Rechercher par nom" })
    .fill("THRESHOLD");
  await Promise.all([
    page.waitForURL(/q=THRESHOLD/),
    page.getByRole("button", { name: "Rechercher", exact: true }).click(),
  ]);
  expect(new URL(page.url()).searchParams.has("limit")).toBe(false);
  await expect(
    page.getByRole("region", { name: "Liste des activités" }),
  ).toContainText("1 sur 1 activités");
  await page
    .getByRole("region", { name: "Liste des activités" })
    .getByRole("link", { name: /Threshold/ })
    .click();
  await expect(page).toHaveURL(/000000000004\?filter=road&q=THRESHOLD$/);
  await Promise.all([
    page.waitForURL(/\/details\?filter=road&q=THRESHOLD$/),
    page.getByRole("link", { name: /Détail complet/ }).click(),
  ]);
  const breadcrumb = page.getByRole("navigation", { name: "Fil d’Ariane" });
  await expect(
    breadcrumb.getByRole("link", { name: "Activités", exact: true }),
  ).toHaveAttribute("href", "/activities?filter=road&q=THRESHOLD");
  await breadcrumb
    .getByRole("link", { name: "Activités", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Filtrer les activités" })
    .getByRole("link", { name: "Trail", exact: true })
    .click();
  await expect(page).toHaveURL(/filter=trail&q=THRESHOLD$/);
  await expect(
    page
      .getByRole("region", { name: "Liste des activités" })
      .getByText("Aucune activité ne correspond à ce nom."),
  ).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Rechercher par nom" }),
  ).toHaveValue("THRESHOLD");
});

test("name search treats wildcard and punctuation literally before pagination", async ({
  page,
}) => {
  await signIn(page);
  for (const search of [
    "été",
    "%",
    "_",
    "\\",
    "*",
    "(soir), lac",
    "100%_effort",
    "absent",
    "%,activity_type.eq.running",
    "Fontainebleau",
    "**",
  ]) {
    await page.goto(`/activities?q=${encodeURIComponent(search)}`);
    const list = page.getByRole("region", { name: "Liste des activités" });
    if (
      ["absent", "%,activity_type.eq.running", "Fontainebleau", "**"].includes(
        search,
      )
    ) {
      await expect(list).toContainText(
        "Aucune activité ne correspond à ce nom.",
      );
    } else {
      await expect(list).toContainText("1 sur 1 activités");
      await expect(
        list.getByRole("link", { name: /Été 100%_effort/ }),
      ).toBeVisible();
    }
  }
  await page.goto("/activities?limit=100&q=%C3%89t%C3%A9");
  await expect(
    page
      .getByRole("region", { name: "Liste des activités" })
      .getByRole("link", { name: /Été/ }),
  ).toHaveAttribute("href", /limit=100&q=%C3%89t%C3%A9$/);
});

test("name search preserves query through load-more and selection", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/activities?filter=road&q=Course");
  const searchedList = page.getByRole("region", {
    name: "Liste des activités",
  });
  await expect(searchedList).toContainText("50 sur 69 activités");
  await searchedList
    .getByRole("link", { name: "Charger les suivantes" })
    .click();
  await expect(page).toHaveURL(/filter=road&limit=100&q=Course$/);
  await expect(searchedList).toContainText("69 sur 69 activités");
  await searchedList
    .getByRole("link", { name: /Course à pied/ })
    .last()
    .click();
  await expect(page).toHaveURL(/000000000169\?filter=road&limit=100&q=Course$/);
});

test("mobile list and GPS preview fit 390 and 320 pixels", async ({ page }) => {
  await page.route("https://basemaps.cartocdn.com/**", (route) =>
    route.abort(),
  );
  await signIn(page);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/activities");
    await expect(page.getByRole("article")).toBeHidden();
    await expect(
      page.getByRole("searchbox", { name: "Rechercher par nom" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/activities-list-${width}.png`,
    });
    await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000004");
    const article = page.getByRole("article");
    await expect(article).toBeVisible();
    await expect(
      article.getByRole("region", { name: "Parcours", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await article.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/activities-preview-${width}.png`,
    });
  }
});
