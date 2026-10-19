import { expect, test } from "@playwright/test";

test("remote dev origin loads signup scripts and password guidance", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://stride.test:3100/sign-up");
  const password = page.getByLabel("Mot de passe", { exact: true });
  const confirmation = page.getByLabel("Confirmer le mot de passe", {
    exact: true,
  });
  const createAccount = page.getByRole("button", {
    name: "Créer un compte",
    exact: true,
  });
  await expect(createAccount).toBeDisabled();
  await page.getByLabel("Nom complet").fill("Jules Thibault");
  await page.getByLabel("E-mail", { exact: true }).fill("athlete@example.com");
  await password.fill("LongTrailAtSunrise2026!");
  await page
    .getByRole("button", { name: "Afficher le mot de passe", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Masquer le mot de passe", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(page.getByText("Fort", { exact: true })).toBeVisible();
  const rules = page.locator("#password-guidance li");
  for (const rule of await rules.all()) {
    await expect(rule.locator(".sr-only")).toHaveText("Respecté :");
    expect(
      await rule.locator(".sr-only").evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          style.position === "absolute" &&
          element.getBoundingClientRect().width <= 1
        );
      }),
    ).toBe(true);
  }
  await confirmation.fill("mismatch");
  await expect(createAccount).toBeDisabled();
  await confirmation.fill("LongTrailAtSunrise2026!");
  await expect(createAccount).toBeEnabled();
  await page
    .getByRole("button", { name: "Afficher la confirmation", exact: true })
    .click();
  await expect(confirmation).toHaveAttribute("type", "text");
  expect(errors).toEqual([]);
});
