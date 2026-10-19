import { expect, test } from "@playwright/test";

test("auth navigation, accessible controls, focus and blank initial state", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Content de te revoir" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue("");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("a-test-password");
  await page
    .getByRole("button", { name: "Afficher le mot de passe", exact: true })
    .click();
  await expect(
    page.getByLabel("Mot de passe", { exact: true }),
  ).toHaveAttribute("type", "text");
  await expect(page.getByLabel("Mot de passe", { exact: true })).toBeFocused();
  await page
    .getByRole("button", { name: "Masquer le mot de passe", exact: true })
    .click();
  await expect(
    page.getByLabel("Mot de passe", { exact: true }),
  ).toHaveAttribute("type", "password");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await expect(
    page.getByRole("heading", { name: "Crée ton compte" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Créer un compte", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Nom complet").fill("Jules Thibault");
  await page.getByLabel("E-mail", { exact: true }).fill("runner@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("a-quiet-trail-at-dawn");
  await page
    .getByLabel("Confirmer le mot de passe", { exact: true })
    .fill("different");
  await expect(
    page.getByText("Les mots de passe ne correspondent pas encore."),
  ).toBeVisible();
  await expect(
    page.getByLabel("Confirmer le mot de passe", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page
    .getByLabel("Confirmer le mot de passe", { exact: true })
    .fill("a-quiet-trail-at-dawn");
  await expect(
    page.getByRole("button", { name: "Créer un compte", exact: true }),
  ).toBeEnabled();
  await page.getByText("Conditions", { exact: true }).click();
  await expect(
    page.getByText(/conditions de Stride ne sont pas encore publiées/),
  ).toBeVisible();
});

test("recovery stages start gated and reset rejects anonymous sessions", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("button", { name: "Envoyer le lien" }),
  ).toBeVisible();
  await expect(page.getByText("Renvoyer", { exact: false })).not.toBeVisible();
  await expect(
    page.getByLabel("Nouveau mot de passe", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/reset-password");
  await expect(
    page.getByText(
      "Connecte-toi ou ouvre un nouveau lien de réinitialisation depuis ta boîte mail avant de choisir un nouveau mot de passe.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enregistrer et se connecter" }),
  ).toHaveCount(0);
});

test("invalid callback redirects safely without echoing tokens", async ({
  page,
}) => {
  await page.goto(
    "/auth/callback?next=https://evil.example&token_hash=private-token&type=invalid",
  );
  await expect(page).toHaveURL(/\/sign-in\?error=link$/);
  await expect(
    page.getByText(/Ce lien n’est plus valide ou a expiré/),
  ).toBeVisible();
  await expect(page.getByText("private-token")).toHaveCount(0);
});

for (const width of [390, 1440]) {
  for (const route of [
    "sign-in",
    "sign-up",
    "forgot-password",
    "reset-password",
  ]) {
    test(`${route} has no overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(`/${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });
  }
}

for (const route of ["forgot-password", "reset-password"]) {
  test(`${route} follows the mobile recovery layout`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${route}`);
    const back = page.getByRole("link", { name: "Retour à la connexion" });
    const wordmark = page.getByRole("link", { name: "Stride, se connecter" });
    const backBox = await back.boundingBox();
    const wordmarkBox = await wordmark.boundingBox();
    expect(backBox && wordmarkBox && backBox.x < wordmarkBox.x).toBe(true);
    expect(backBox?.height).toBeGreaterThanOrEqual(44);
    const stages = page.locator("section", {
      has: page.getByRole("heading", { level: 2 }),
    });
    await expect(stages).toHaveCount(3);
    const first = await stages.nth(0).boundingBox();
    const second = await stages.nth(1).boundingBox();
    expect(first && second && second.y > first.y && second.x === first.x).toBe(
      true,
    );
    await expect(stages.nth(0)).toHaveCSS("border-top-width", "1px");
    await expect(page.locator("main")).toHaveCSS(
      "background-color",
      "rgb(12, 13, 11)",
    );
  });
}
