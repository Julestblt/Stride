import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
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
  await expect(sidebar.getByText("EcoTrail Paris 120K")).toBeVisible();
  await expect(sidebar.getByText("Course A · J-164")).toBeVisible();
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
  await page
    .getByRole("navigation", { name: "Fil d’Ariane" })
    .getByRole("link", { name: "Activités" })
    .click();
  await expect(page).toHaveURL(/\/activities$/);
  await page.getByRole("button", { name: "Toggle sidebar" }).first().click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "Activités" }),
  ).toBeVisible();
});
