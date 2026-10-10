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
