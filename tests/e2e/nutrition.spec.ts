import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email = "athlete@example.com") {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL("/today");
}

test("the nutrition page shows today's targets and the next seven days", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/activities");
  await page.getByRole("link", { name: "Nutrition", exact: true }).click();
  await expect(page).toHaveURL(/\/nutrition$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /^Environ [\d  ]+ kcal aujourd’hui\.$/,
    }),
  ).toBeVisible();
  const targets = page.getByRole("region", { name: "Objectifs du jour" });
  for (const label of ["Énergie", "Glucides", "Protéines", "Lipides"])
    await expect(targets.getByText(label, { exact: true })).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveCount(8);
  await expect(table.locator('tr[aria-current="date"]')).toHaveCount(1);
  await expect(
    page.getByText("Comment on calcule", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Demander à Léa" }),
  ).toHaveAttribute("href", "/coach");
});

test("the nutrition page fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/nutrition");
  await expect(
    page.getByRole("heading", { level: 1, name: /kcal aujourd’hui\.$/ }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeHidden();
  await expect(
    page.getByRole("link", { name: "Demander à Léa" }).last(),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the team shows every specialist with a face choice", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/coach/equipe");
  for (const name of ["Inès", "Marc", "Hugo", "Léa"])
    await expect(
      page.getByRole("heading", { level: 3, name, exact: true }),
    ).toBeVisible();
  for (const role of [
    "Directeur sportif",
    "Stratège de course",
    "Nutritionniste",
  ])
    await expect(page.getByText(role, { exact: true }).first()).toBeVisible();
});
