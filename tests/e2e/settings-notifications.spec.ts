import { expect, test } from "@playwright/test";
import { signInAs } from "./support/session";

const categories = [
  "Séance du jour",
  "Plan et staff",
  "Débrief prêt",
  "Problèmes Garmin",
];

test("notification settings show the browser state and the four categories", async ({
  context,
  page,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default" });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, "athlete@example.com");
  await page.goto("/settings/training");

  const device = page.getByRole("switch", { name: "Sur ce navigateur" });
  await expect(device).toBeVisible({ timeout: 15_000 });
  await expect(device).not.toBeChecked();
  await expect(device).toBeEnabled();
  await expect(
    page.getByText("Ton navigateur te demandera ton accord.", {
      exact: true,
    }),
  ).toBeVisible();
  for (const name of categories) {
    const toggle = page.getByRole("switch", { name });
    await expect(toggle).toBeChecked();
    await expect(toggle).toBeDisabled();
  }
  await expect(
    page.getByText("Active cet appareil pour choisir ce que tu reçois."),
  ).toBeVisible();
});

test("a browser with blocked notifications explains how to allow them", async ({
  context,
  page,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "denied" });
  });
  await signInAs(page, "athlete@example.com");
  await page.goto("/settings/training");

  const device = page.getByRole("switch", { name: "Notifications bloquées" });
  await expect(device).toBeDisabled({ timeout: 15_000 });
  await expect(device).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Plan et staff" })).toHaveCount(
    0,
  );
});

test("an iPhone outside the home screen gets the install steps", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  await signInAs(page, "athlete@example.com");
  await page.goto("/settings/training");

  await expect(page.getByText("Installe Stride sur ton iPhone")).toBeVisible({
    timeout: 15_000,
  });
  const steps = page.getByRole("list").filter({ hasText: "Partager" });
  await expect(steps.getByRole("listitem")).toHaveCount(3);
  await expect(
    page.getByRole("switch", { name: "Séance du jour" }),
  ).toHaveCount(0);
  await context.close();
});
