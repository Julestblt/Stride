import { expect, test, type Page } from "@playwright/test";
import type { DataActivityObservation } from "../../src/features/data-activity/model";

const successAt = "2026-10-13T06:12:00Z";
function observation(
  state: "running" | "complete" = "running",
  count = 20,
): DataActivityObservation {
  const category = {
    state,
    oldestSynchronizedDate: "2026-01-01",
    lastSuccessAt: state === "complete" ? successAt : null,
    lastErrorCode: null,
    activityCount: null,
  };
  return {
    connection: "connected",
    sync: {
      started: true,
      lastSyncAt: successAt,
      updatedAt: successAt,
      categories: {
        activities: { ...category, activityCount: count },
        recovery: category,
        fitness: category,
        patterns: category,
      },
    },
  };
}
async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}
async function pollNow(page: Page) {
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
}

for (const width of [1440, 390]) {
  test(`Garmin panel is accessible and fits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/data-activity", (route) =>
      route.fulfill({ json: observation() }),
    );
    await signIn(page);
    await page.goto("/activities");
    const status = page
      .getByRole("button", { name: /État des données/ })
      .filter({ visible: true })
      .first();
    await expect(status).toBeVisible();
    await page.waitForLoadState("networkidle");
    await status.click();
    const panel = page.getByRole("dialog", { name: "État des données" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Activités", { exact: true })).toBeVisible();
    await expect(
      panel.getByText("Sommeil et récupération", { exact: true }),
    ).toBeVisible();
    await expect(panel.getByText("Strava", { exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({ path: `test-results/data-panel-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
    await expect(status).toBeFocused();
  });
}

test("background data stays in place until the athlete applies it", async ({
  page,
}) => {
  let value = observation("complete");
  await page.route("**/api/data-activity", (route) =>
    route.fulfill({ json: value }),
  );
  await signIn(page);
  await page.goto("/activities");
  await expect(
    page.getByRole("heading", { name: "Activités", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: /État des données/ })
      .filter({ visible: true })
      .first(),
  ).toContainText("synchronisé");
  const before = await page.getByRole("article").boundingBox();
  value = observation("complete", 21);
  value.sync.categories.activities.lastSuccessAt = "2026-10-13T06:15:00Z";
  await pollNow(page);
  const apply = page.getByRole("button", { name: "Afficher", exact: true });
  await expect(apply).toBeVisible();
  const after = await page.getByRole("article").boundingBox();
  expect(after).toEqual(before);
  await apply.click();
  await expect(apply).not.toBeVisible();
  await pollNow(page);
  await expect(apply).not.toBeVisible();
});

test("offline and malformed responses retain athlete content", async ({
  page,
  context,
}) => {
  let malformed = false;
  await page.route("**/api/data-activity", (route) =>
    route.fulfill({ json: malformed ? { unexpected: true } : observation() }),
  );
  await signIn(page);
  await page.goto("/activities");
  const article = page.getByRole("article");
  await expect(article).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: /État des données/ })
      .filter({ visible: true })
      .first(),
  ).toContainText("synchro");
  await context.setOffline(true);
  await expect(
    page
      .getByRole("button", { name: /État des données/ })
      .filter({ visible: true })
      .first(),
  ).toContainText("Hors ligne");
  await expect(article).toBeVisible();
  await context.setOffline(false);
  malformed = true;
  await pollNow(page);
  await expect(
    page
      .getByRole("button", { name: /État des données/ })
      .filter({ visible: true })
      .first(),
  ).toContainText(/indisponible/i);
  await expect(article).toBeVisible();
});

test("reduced motion leaves Garmin loading readable without animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/data-activity", (route) =>
    route.fulfill({ json: observation() }),
  );
  await signIn(page);
  await page.goto("/activities");
  const status = page
    .getByRole("button", { name: /État des données/ })
    .filter({ visible: true })
    .first();
  await expect(status).toContainText(/Garmin/);
  await page.waitForLoadState("networkidle");
  await status.click();
  await expect(
    page.getByRole("dialog", { name: "État des données" }),
  ).toBeVisible();
  const animated = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === "running" &&
            animation.effect?.getTiming().iterations === Infinity,
        ).length,
  );
  expect(animated).toBe(0);
});

test("the thread delays fast work and holds visible loading for 600ms", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-13T10:00:00Z") });
  let value = observation("complete");
  await page.route("**/api/data-activity", (route) =>
    route.fulfill({ json: value }),
  );
  await signIn(page);
  await page.goto("/activities");
  const status = page
    .getByRole("button", { name: /État des données/ })
    .filter({ visible: true })
    .first();
  await expect(status).toContainText("synchronisé");
  await page.waitForLoadState("networkidle");
  await page.clock.pauseAt(new Date("2026-10-13T10:02:00Z"));
  const thread = page
    .getByTestId("data-activity-thread")
    .filter({ visible: true });
  value = observation("running");
  await pollNow(page);
  await expect(status).toContainText("synchro…");
  await page.clock.runFor(299);
  await expect(thread).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(thread).toBeVisible();
  value = observation("complete");
  await pollNow(page);
  await expect(status).toContainText("synchronisé");
  await page.clock.runFor(599);
  await expect(thread).toBeVisible();
  await page.clock.runFor(1);
  await expect(thread).toHaveCount(0);
});

test("the app status API requires a session and remains private with onboarding disabled", async ({
  page,
  context,
  request,
}) => {
  const signedOut = await request.get("/api/data-activity");
  expect(signedOut.status()).toBe(401);
  expect(signedOut.headers()["cache-control"]).toBe("private, no-store");
  await signIn(page);
  const authenticated = await context.request.get("/api/data-activity");
  expect(authenticated.status()).toBe(200);
  expect(authenticated.headers()["cache-control"]).toBe("private, no-store");
  const data = await authenticated.json();
  expect(data).toMatchObject({
    connection: "disconnected",
    sync: { started: false },
  });
  expect(JSON.stringify(data)).not.toContain("access_token");
});

test("a failed activities category stays readable while recovery imports", async ({
  page,
}) => {
  const value = observation();
  value.sync.categories.activities.state = "failed";
  await page.route("**/api/data-activity", (route) =>
    route.fulfill({ json: value }),
  );
  await signIn(page);
  await page.goto("/activities");
  const article = page.getByRole("article");
  await expect(article).toBeVisible();
  const status = page
    .getByRole("button", { name: /État des données/ })
    .filter({ visible: true })
    .first();
  await expect(status).toContainText("synchro…");
  await expect(article.locator('[data-slot="metric"]').first()).toHaveCSS(
    "opacity",
    "1",
  );
});

for (const width of [390, 700]) {
  test(`progress retains live Garmin status at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/data-activity", (route) =>
      route.fulfill({ json: observation() }),
    );
    await signIn(page);
    await page.goto("/progress/health");
    const status = page
      .getByRole("button", { name: /État des données/ })
      .filter({ visible: true });
    await expect(status).toHaveCount(1);
    await expect(status).toContainText("synchro…");
    await page.screenshot({ path: `test-results/data-health-${width}.png` });
  });
}

test("collapsed desktop navigation keeps the data panel accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/data-activity", (route) =>
    route.fulfill({ json: observation("complete") }),
  );
  await signIn(page);
  await page.goto("/progress");
  await page
    .getByRole("button", { name: "Afficher ou masquer la barre latérale" })
    .click();
  const status = page
    .getByRole("button", { name: /État des données/ })
    .filter({ visible: true });
  await expect(status).toHaveCount(1);
  await page.waitForLoadState("networkidle");
  await status.click();
  await expect(
    page.getByRole("dialog", { name: "État des données" }),
  ).toBeVisible();
});

test("mobile activity values keep their content and signal a running import", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let value = observation("complete");
  await page.route("**/api/data-activity", (route) =>
    route.fulfill({ json: value }),
  );
  await signIn(page);
  await page.goto("/activities");
  const status = page
    .getByRole("button", { name: /État des données/ })
    .filter({ visible: true })
    .first();
  await expect(status).toContainText("synchronisé");
  const metric = page
    .getByRole("region", { name: "Liste des activités" })
    .locator('[data-slot="metric"]')
    .first();
  const text = await metric.textContent();
  const before = await metric.boundingBox();
  value = observation("running");
  await pollNow(page);
  await expect(metric).toHaveCSS("opacity", "0.5");
  expect(await metric.textContent()).toBe(text);
  expect(await metric.boundingBox()).toEqual(before);
  await expect(
    page
      .getByText("Mise à jour…", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

async function holdNavigation(page: Page, path: string) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrived = () => {};
  const requested = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  await page.route(`**${path}?*`, async (route) => {
    if (route.request().headers().rsc !== "1") return route.continue();
    arrived();
    await gate;
    await route.continue();
  });
  return { requested, release };
}

async function expectHeaderThread(page: Page) {
  const thread = page
    .getByTestId("data-activity-thread")
    .filter({ visible: true });
  await expect(thread).toHaveCount(1);
  const geometry = await thread.evaluate((element) => {
    const line = element.getBoundingClientRect();
    const header = element.parentElement!.getBoundingClientRect();
    return {
      height: line.height,
      bottom: line.bottom,
      headerBottom: header.bottom,
      width: line.width,
      headerWidth: header.width,
    };
  });
  expect(geometry.height).toBe(2);
  expect(Math.abs(geometry.bottom - geometry.headerBottom)).toBeLessThanOrEqual(
    1,
  );
  expect(Math.abs(geometry.width - geometry.headerWidth)).toBeLessThanOrEqual(
    2,
  );
  return thread;
}

for (const width of [1440, 390]) {
  test(`server loading keeps the activity layout at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto("/activities?q=loading-fixture", { waitUntil: "commit" });
    const loading = page.getByRole("status", {
      name: "Chargement des activités",
      exact: true,
    });
    await expect(loading).toBeVisible();
    const heading = loading.getByRole("heading", {
      name: "Activités",
      level: 1,
    });
    await expect(heading).toBeVisible();
    expect(await heading.locator('[data-slot="skeleton"]').count()).toBe(0);
    await expectHeaderThread(page);
    const list = loading.locator(":scope > div > div").first();
    if (width === 1440) {
      expect(
        await list.evaluate((element) => element.getBoundingClientRect().width),
      ).toBe(320);
      await expect(
        loading.getByRole("navigation", { name: "Fil d’Ariane" }),
      ).toBeVisible();
    } else {
      expect(
        await list.evaluate((element) => element.getBoundingClientRect().width),
      ).toBe(width);
      await expect(
        loading.getByRole("navigation", { name: "Fil d’Ariane" }),
      ).toBeHidden();
    }
    await page.screenshot({
      path: `test-results/activity-loading-${width}.png`,
    });
    await page.waitForLoadState("load");
    await expect(loading).not.toBeVisible();
    await expect(
      page.getByTestId("data-activity-thread").filter({ visible: true }),
    ).toHaveCount(0);
  });
}

for (const width of [1440, 390]) {
  test(`activity selection retains the loaded list during preview loading at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto("/activities?filter=road&limit=100&q=Course");
    const list = page.getByRole("region", { name: "Liste des activités" });
    await expect(list).toContainText("69 sur 69 activités");
    await page.waitForLoadState("networkidle");
    const target = list.locator('a[href*="000000000168"]');
    await target.scrollIntoViewIfNeeded();
    const before = await list.evaluate((element) => element.scrollTop);
    const rows = await list.getByRole("link").count();
    await target.click();
    const loading = page.getByRole("status", {
      name: "Chargement de l’activité",
      exact: true,
    });
    await expect(loading).toBeVisible();
    await expectHeaderThread(page);
    const retainedList = loading.getByRole("region", {
      name: "Liste des activités",
      includeHidden: true,
    });
    await expect(retainedList).toContainText("69 sur 69 activités");
    expect(await retainedList.locator("a").count()).toBe(rows);
    expect(await retainedList.locator('[data-slot="skeleton"]').count()).toBe(
      0,
    );
    await expect(
      loading.getByRole("searchbox", {
        name: "Rechercher par nom",
        includeHidden: true,
      }),
    ).toHaveValue("Course");
    await expect(retainedList.locator('[aria-current="true"]')).toHaveAttribute(
      "href",
      /000000000168\?filter=road&limit=100&q=Course$/,
    );
    if (width === 1440) {
      await expect(retainedList).toBeVisible();
      expect(await retainedList.evaluate((element) => element.scrollTop)).toBe(
        before,
      );
    } else {
      await expect(retainedList).toBeHidden();
    }
    await expect(
      loading.locator('[data-slot="skeleton"]').first(),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/activity-retained-list-${width}.png`,
    });
    await expect(loading).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("article")).toBeVisible();
    await expect(page).toHaveURL(
      /000000000168\?filter=road&limit=100&q=Course$/,
    );
    if (width === 1440) {
      const resolvedList = page
        .getByRole("region", { name: "Liste des activités" })
        .filter({ visible: true });
      expect(await resolvedList.evaluate((element) => element.scrollTop)).toBe(
        before,
      );
    }
  });
}

test("direct activity loading still shows list placeholders without a snapshot", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/activities/aaaaaaaa-aaaa-4aaa-8aaa-000000000168", {
    waitUntil: "commit",
  });
  const loading = page.getByRole("status", {
    name: "Chargement de l’activité",
    exact: true,
  });
  await expect(loading).toBeVisible();
  await expect(loading.getByRole("searchbox")).toHaveCount(0);
  await expect(loading.locator('[data-slot="skeleton"]').first()).toBeVisible();
  await page.waitForLoadState("load");
  await expect(loading).not.toBeVisible();
  await expect(page.getByRole("article")).toBeVisible();
});

test("a blocked server navigation starts the header thread before its response", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/activities");
  await expect(page.getByRole("article")).toBeVisible();
  const before = await page.getByRole("article").boundingBox();
  const gate = await holdNavigation(page, "/progress");
  try {
    await page.getByRole("link", { name: "Progression", exact: true }).click();
    await gate.requested;
    await expectHeaderThread(page);
    expect(new URL(page.url()).pathname).toBe("/activities");
    expect(await page.getByRole("article").boundingBox()).toEqual(before);
    await expect(
      page
        .getByRole("button", { name: /État des données/ })
        .filter({ visible: true })
        .first(),
    ).toContainText("reconnecter");
    await page.screenshot({
      path: "test-results/activity-pending-navigation.png",
    });
  } finally {
    gate.release();
  }
  await expect(page).toHaveURL("/progress");
  await expect(
    page.getByTestId("data-activity-thread").filter({ visible: true }),
  ).toHaveCount(0);
});

test("a superseding navigation cleans up its pending header thread", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/activities");
  await expect(page.getByRole("article")).toBeVisible();
  const gate = await holdNavigation(page, "/progress");
  try {
    await page.getByRole("link", { name: "Progression", exact: true }).click();
    await gate.requested;
    await expectHeaderThread(page);
    await page
      .getByRole("navigation", { name: "Filtrer les activités" })
      .getByRole("link", { name: "Route", exact: true })
      .click();
    await expect(page).toHaveURL(/activities\?filter=road$/);
  } finally {
    gate.release();
  }
  await expect(
    page.getByTestId("data-activity-thread").filter({ visible: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/activities\?filter=road$/);
});

test("opening a navigation link in another tab leaves the current thread idle", async ({
  page,
  context,
}) => {
  await signIn(page);
  await page.goto("/activities");
  await expect(page.getByRole("article")).toBeVisible();
  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    page
      .getByRole("link", { name: "Progression", exact: true })
      .click({ modifiers: ["Control"] }),
  ]);
  await expect(page).toHaveURL("/activities");
  await expect(
    page.getByTestId("data-activity-thread").filter({ visible: true }),
  ).toHaveCount(0);
  await popup.close();
});

test("activity search shares pending server navigation feedback", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/activities");
  await expect(page.getByRole("article")).toBeVisible();
  const gate = await holdNavigation(page, "/activities");
  try {
    await page
      .getByRole("searchbox", { name: "Rechercher par nom" })
      .fill("THRESHOLD");
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();
    await gate.requested;
    await expectHeaderThread(page);
    await expect(page.getByRole("article")).toBeVisible();
  } finally {
    gate.release();
  }
  await expect(page).toHaveURL(/activities\?q=THRESHOLD$/);
  await expect(
    page.getByRole("region", { name: "Liste des activités" }),
  ).toContainText("1 sur 1 activités");
  await expect(
    page.getByTestId("data-activity-thread").filter({ visible: true }),
  ).toHaveCount(0);
});

test("fitness period changes show loading before the server response", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/progress");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  const before = await heading.textContent();
  const gate = await holdNavigation(page, "/progress");
  try {
    await page
      .getByRole("navigation", { name: "Période" })
      .getByRole("link", { name: "12 sem.", exact: true })
      .click();
    await gate.requested;
    await expectHeaderThread(page);
    expect(await heading.textContent()).toBe(before);
  } finally {
    gate.release();
  }
  await expect(page).toHaveURL("/progress?period=12w");
  await expect(
    page.getByTestId("data-activity-thread").filter({ visible: true }),
  ).toHaveCount(0);
});
