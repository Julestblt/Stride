import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./support/session";

function signIn(page: Page) {
  return signInAs(page, "plan-history@example.com");
}

test("Historique lists proposals by month with decisions and versions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/plan");
  await page.getByRole("link", { name: "Historique 7 propositions" }).click();
  await expect(page).toHaveURL("/plan/historique", { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Historique du plan" }),
  ).toBeVisible();
  await expect(
    page.getByText(/^Marathon de Paris · version 3 en cours depuis le /),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Tout · 7" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const applied = page.getByRole("article", { name: "Repos avancé à mardi" });
  await expect(applied.getByText("Appliquée", { exact: true })).toBeVisible();
  await expect(applied.getByText("v2 → v3")).toBeVisible();
  await expect(applied.getByText("Proposée par Claire")).toBeVisible();

  const stale = page.getByRole("article", {
    name: "Échanger le seuil et la sortie longue",
  });
  await expect(stale.getByText("Périmée", { exact: true })).toBeVisible();
  await expect(
    stale.getByText(
      "Le plan a changé avant son application. Rien n’a été appliqué.",
    ),
  ).toBeVisible();

  const rejected = page.getByRole("article", {
    name: "Ajouter des côtes courtes",
  });
  await expect(
    rejected.getByText(
      /^Refusée par toi le \d{2}\/\d{2}\/\d{4} : week-end en famille\.$/,
    ),
  ).toBeVisible();

  const created = page.getByRole("article", {
    name: "Nouveau plan · Marathon de Paris",
  });
  await expect(created.getByText("Créé avec Claire")).toBeVisible();
  await expect(
    created.getByRole("link", { name: "Voir le programme" }),
  ).toBeVisible();

  await page.screenshot({
    path: "test-results/plan-history-desktop.png",
    fullPage: true,
  });

  await page
    .getByRole("article", { name: "Raccourcir la séance" })
    .getByRole("link", { name: "Examiner" })
    .click();
  await expect(page).toHaveURL(/\/plan\?proposition=/, { timeout: 20_000 });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL("/plan/historique");

  await page.getByRole("link", { name: /^Refusées · / }).click();
  await expect(page).toHaveURL("/plan/historique?filtre=refusees");
  await expect(
    page.getByRole("article", { name: "Ajouter des côtes courtes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Repos avancé à mardi" }),
  ).toHaveCount(0);
});

test("Historique fits a phone and leads back to the plan", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/plan/historique");
  await expect(
    page.getByRole("heading", { level: 1, name: "Historique du plan" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("article", { name: "Repos avancé à mardi" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: "test-results/plan-history-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Retour au plan" }).click();
  await expect(page).toHaveURL("/plan");
  const entry = page.getByRole("link", { name: "Historique", exact: true });
  await expect(entry).toBeVisible();
  await page.screenshot({ path: "test-results/plan-mobile-history-link.png" });
  await entry.click();
  await expect(page).toHaveURL("/plan/historique");
});
