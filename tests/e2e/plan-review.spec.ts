import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./support/session";

const authPort = Number(process.env.PLAYWRIGHT_AUTH_PORT ?? 3200);
const ready = "eeeeeeee-eeee-4eee-8eee-700000000001";
const toAccept = "eeeeeeee-eeee-4eee-8eee-700000000002";
const toReject = "eeeeeeee-eeee-4eee-8eee-700000000003";
const foreign = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const extension = "eeeeeeee-eeee-4eee-8eee-700000000009";

test.describe.configure({ mode: "serial" });

async function resetProposals() {
  await fetch(`http://127.0.0.1:${authPort}/__test__/plan-proposals`, {
    method: "DELETE",
  });
}

test.beforeAll(resetProposals);
test.afterAll(resetProposals);

function signIn(page: Page) {
  return signInAs(page, "plan-review@example.com");
}

test("Examiner opens the review of a ready proposal", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/plan");
  await page
    .getByRole("link", { name: "Examiner" })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`proposition=${ready}`), {
    timeout: 20_000,
  });
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("heading", { name: "Raccourcir la séance" }),
  ).toBeVisible();
  await expect(sheet.getByText("À toi de décider")).toBeVisible();
  await expect(sheet.getByText("Sur la version 3 du plan")).toBeVisible();
  await expect(sheet.getByText("Proposée par Claire, avec Inès")).toBeVisible();
  await expect(
    sheet.getByRole("heading", { name: "Ce qui change · 1 modification" }),
  ).toBeVisible();
  await expect(sheet.getByText("Remplacée", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Footing court", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Médecin · consultée")).toBeVisible();
  await expect(sheet.getByText("D’accord", { exact: true })).toBeVisible();
  await expect(
    sheet.getByRole("heading", { name: "Contrôles de Stride" }),
  ).toBeVisible();
  await expect(
    sheet.getByText("Aucune séance passée ou déjà faite n’est modifiée."),
  ).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Accepter" })).toBeEnabled();
  await page.screenshot({ path: "test-results/plan-review-desktop.png" });

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/proposition=/);
});

test("the review opens as a bottom sheet on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`/plan?proposition=${ready}`);
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("heading", { name: "Raccourcir la séance" }),
  ).toBeVisible({ timeout: 20_000 });
  const box = await sheet.boundingBox();
  expect(box?.width).toBe(390);
  expect((box?.y ?? 0) > 0).toBe(true);
  await expect(sheet.getByRole("button", { name: "Accepter" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Refuser" })).toBeVisible();
  await page.screenshot({ path: "test-results/plan-review-mobile.png" });
});

test("rejecting leaves the plan unchanged and is listed as Refusée", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/plan?proposition=${toReject}`);
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Refuser" }).click({
    timeout: 20_000,
  });
  await expect(sheet.getByText("Refusée · ton plan ne change pas")).toBeVisible(
    { timeout: 20_000 },
  );
  await expect(sheet.getByRole("button", { name: "Accepter" })).toHaveCount(0);

  await page.goto("/plan/historique");
  const entry = page.getByRole("article", { name: "Remplacer les côtes" });
  await expect(entry.getByText("Refusée", { exact: true })).toBeVisible();
  await expect(entry.getByText("Sur v3")).toBeVisible();
});

test("accepting applies the proposal and lists it as Appliquée", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/plan?proposition=${toAccept}`);
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Supprimée", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await sheet.getByRole("button", { name: "Accepter" }).click();
  await expect(
    sheet.getByText("Appliquée · ton plan passe en version 4"),
  ).toBeVisible({ timeout: 20_000 });
  await expect(sheet.getByRole("link", { name: "Historique" })).toBeVisible();

  await page.goto("/plan/historique");
  await expect(
    page.getByText(/^Marathon de Paris · version 4 en cours depuis le /),
  ).toBeVisible();
  const entry = page.getByRole("article", { name: "Retirer un footing" });
  await expect(entry.getByText("Appliquée", { exact: true })).toBeVisible();
  await expect(entry.getByText("v3 → v4")).toBeVisible();
});

test("a proposal on an older version can no longer be accepted", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/plan?proposition=${ready}`);
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByText("Cette proposition ne peut plus être appliquée"),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    sheet.getByText(/il est passé en version 4\. Rien n’a été modifié\./),
  ).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Accepter" })).toBeDisabled();
  await expect(sheet.getByRole("button", { name: "Refuser" })).toBeEnabled();
});

test("another athlete's proposal is never shown", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  for (const id of [foreign, "eeeeeeee-eeee-4eee-8eee-0000000000ff", "x"]) {
    await page.goto(`/plan?proposition=${id}`);
    await expect(
      page.locator("main").getByRole("heading", { level: 1 }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("an extension proposal shows the added race and the new plan end", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/plan?proposition=${extension}`);
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByRole("heading", {
      name: "Ajoute le Trail des Lacs et prolonge le plan",
    }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(sheet.getByText("Proposition · nouvelle course")).toBeVisible();
  await expect(sheet.getByText("Prolonge la version 3 du plan")).toBeVisible();
  await expect(
    sheet.getByRole("heading", {
      name: "Ce qui change · course ajoutée, plan prolongé",
    }),
  ).toBeVisible();
  await expect(
    sheet.getByText("Trail des Lacs 30K", { exact: true }),
  ).toBeVisible();
  await expect(sheet.getByText("Prolongé", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Nouvelle fin", { exact: true })).toBeVisible();
  await expect(
    sheet.getByRole("link", { name: "Voir le programme prolongé" }),
  ).toHaveAttribute("href", "/plan?race=77777777-0000-4000-8000-000000000009");

  await page.goto("/plan/historique");
  const entry = page.getByRole("article", {
    name: "Ajoute le Trail des Lacs et prolonge le plan",
  });
  await expect(entry.getByText("Prolonge v3")).toBeVisible();
  await expect(
    entry.getByText(/^Fin du plan : .+ → .+, \+\d semaines\.$/),
  ).toBeVisible();
});
