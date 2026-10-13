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
  const thread = page.getByTestId("data-activity-thread");
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
