import { expect, test } from "@playwright/test";

test("signed-in session updates home, visitor routes, 404, and sign-out", async ({
  page,
  request,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail", { exact: true }).fill("athlete@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL("/today");

  for (const path of [
    "/",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/link-expired",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL("/today");
  }

  await page.goto("/missing-route");
  await expect(
    page.getByRole("heading", { name: "Page introuvable" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Se connecter" })).toHaveCount(0);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Content de te revoir" }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL("/sign-in");
  await page.goto("/missing-route");
  await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();

  const events = await (
    await request.get("http://127.0.0.1:3200/__test__/events")
  ).json();
  expect(events).toContainEqual(
    expect.objectContaining({ path: "/auth/v1/logout", scope: "local" }),
  );
});

for (const remember of [true, false]) {
  test(`password sign-in preserves ${remember ? "persistent" : "session"} cookies`, async ({
    page,
    context,
  }) => {
    await page.goto("/sign-in");
    await page
      .getByLabel("E-mail", { exact: true })
      .fill("athlete@example.com");
    await page
      .getByLabel("Mot de passe", { exact: true })
      .fill("TrailMiles2026!");
    if (!remember) await page.getByRole("checkbox").uncheck();
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
    await expect(page).toHaveURL("/today");
    const cookies = (await context.cookies()).filter((cookie) =>
      cookie.name.includes("auth-token"),
    );
    expect(cookies.length).toBeGreaterThan(0);
    for (const cookie of cookies) {
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("Lax");
      expect(remember ? cookie.expires > 0 : cookie.expires === -1).toBe(true);
    }
  });
}

test("rejected credentials give safe feedback", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail", { exact: true }).fill("athlete@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("WrongPassword2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(
    page.getByText("Connexion impossible.", { exact: false }),
  ).toBeVisible();
});

test("signup requiring confirmation shows inbox feedback", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Nom complet").fill("Jules Thibault");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("confirmation@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page
    .getByLabel("Confirmer le mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page
    .getByRole("button", { name: "Créer un compte", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Vérifie ta boîte mail" }),
  ).toBeVisible();
  await expect(page).toHaveURL("/sign-up");
  await expect(
    page.getByRole("button", { name: "Renvoyer l’e-mail" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Changer d’e-mail" }).click();
  await expect(
    page.getByRole("heading", { name: "Crée ton compte" }),
  ).toBeVisible();
});

test("unconfirmed sign-in resends a confirmation link", async ({
  page,
  request,
}) => {
  await page.goto("/sign-in");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("confirmation@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(
    page.getByText("Confirme ton e-mail pour continuer"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Renvoyer l’e-mail" }),
  ).toBeDisabled();
  const events = await (
    await request.get("http://127.0.0.1:3200/__test__/events")
  ).json();
  expect(
    events.some((event: { path: string }) => event.path === "/auth/v1/resend"),
  ).toBe(true);
});

test("confirmed signup link reaches the confirmed page", async ({ page }) => {
  await page.goto(
    "/auth/callback?token_hash=valid-token&type=signup&next=/email-confirmed",
  );
  await expect(page).toHaveURL("/email-confirmed");
  await expect(
    page.getByRole("heading", { name: "C’est validé, Jules." }),
  ).toBeVisible();
});

test("signup token links without a next parameter reach confirmation", async ({
  page,
}) => {
  await page.goto("/auth/callback?token_hash=valid-token&type=signup");
  await expect(page).toHaveURL("/email-confirmed");
});

test("expired signup link offers a replacement", async ({ page }) => {
  await page.goto(
    "/auth/callback?token_hash=expired-token&type=signup&next=/email-confirmed",
  );
  await expect(page).toHaveURL("/link-expired");
  await expect(
    page.getByRole("heading", { name: "Ce lien n’est plus valide" }),
  ).toBeVisible();
  await page.getByLabel("E-mail").fill("confirmation@example.com");
  await page.getByRole("button", { name: "Envoyer un nouveau lien" }).click();
  await expect(
    page.getByText("Si cette adresse doit être confirmée", { exact: false }),
  ).toBeVisible();
});

test("recovery reports the first provider failure", async ({ page }) => {
  await page.goto("/forgot-password");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("unavailable@example.com");
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(
    page.getByText("Impossible de demander un lien.", { exact: false }),
  ).toBeVisible();
});

test("recovery exchanges a code, saves a password and revokes other sessions", async ({
  page,
  request,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("E-mail", { exact: true }).fill("athlete@example.com");
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(
    page.getByRole("button", { name: /Renvoyer dans/ }),
  ).toBeDisabled();
  const link = await (
    await request.get(
      "http://127.0.0.1:3200/__test__/link?email=athlete@example.com",
    )
  ).json();
  await page.goto(link.url);
  await expect(page).toHaveURL("/reset-password");
  await page
    .getByLabel("Nouveau mot de passe", { exact: true })
    .fill("LongTrailAtSunrise2026!");
  await page
    .getByLabel("Confirmer", { exact: true })
    .fill("LongTrailAtSunrise2026!");
  await page
    .getByRole("button", { name: "Enregistrer et se connecter" })
    .click();
  await expect(page).toHaveURL("/today");
  const events = await (
    await request.get("http://127.0.0.1:3200/__test__/events")
  ).json();
  expect(events).toContainEqual(
    expect.objectContaining({ method: "PUT", path: "/auth/v1/user" }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({ path: "/auth/v1/logout", scope: "others" }),
  );
});

test("verified token hash cannot redirect off site", async ({ page }) => {
  await page.goto(
    "/auth/callback?token_hash=valid-token&type=magiclink&next=https://evil.example",
  );
  await expect(page).toHaveURL("/today");
});

for (const remember of [true, false]) {
  test(`magic link and token refresh preserve ${remember ? "persistent" : "session"} cookies`, async ({
    page,
    context,
    request,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/sign-in");
    await page
      .getByLabel("E-mail", { exact: true })
      .fill(
        remember ? "magic-persistent@example.com" : "magic-session@example.com",
      );
    if (!remember) await page.getByRole("checkbox").uncheck();
    await page
      .getByRole("button", { name: "M’envoyer un lien de connexion" })
      .click();
    await expect(
      page.getByText("Si cette adresse peut recevoir un lien", {
        exact: false,
      }),
    ).toBeVisible();
    const link = await (
      await request.get(
        `http://127.0.0.1:3200/__test__/link?email=${remember ? "magic-persistent@example.com" : "magic-session@example.com"}`,
      )
    ).json();
    await page.goto(link.url);
    await expect(page).toHaveURL("/today");
    const cookie = (await context.cookies()).find((item) =>
      item.name.endsWith("auth-token"),
    );
    expect(cookie).toBeDefined();
    expect(remember ? cookie!.expires > 0 : cookie!.expires === -1).toBe(true);
    const expired = await (
      await request.get("http://127.0.0.1:3200/__test__/expired-session")
    ).json();
    await context.addCookies([
      {
        ...cookie!,
        value: `base64-${Buffer.from(JSON.stringify(expired)).toString("base64url")}`,
      },
    ]);
    const response = await page.goto("/reset-password");
    await expect(
      page.getByLabel("Nouveau mot de passe", { exact: true }),
    ).toBeVisible();
    expect(response?.headers()["cache-control"]).toContain("no-store");
    const refreshed = (await context.cookies()).find((item) =>
      item.name.endsWith("auth-token"),
    );
    expect(refreshed?.value).not.toContain(
      Buffer.from(JSON.stringify(expired)).toString("base64url"),
    );
    expect(remember ? refreshed!.expires > 0 : refreshed!.expires === -1).toBe(
      true,
    );
    expect(refreshed?.httpOnly).toBe(true);
    const events = await (
      await request.get("http://127.0.0.1:3200/__test__/events")
    ).json();
    expect(events).toContainEqual(
      expect.objectContaining({
        grant: "refresh_token",
        path: "/auth/v1/token",
      }),
    );
    expect(errors).toEqual([]);
  });
}

test("overlapping recovery requests retain the earlier link verifier", async ({
  page,
  request,
  context,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("E-mail", { exact: true }).fill("earlier@example.com");
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(
    page.getByRole("button", { name: /Renvoyer dans/ }),
  ).toBeDisabled();
  const earlier = await (
    await request.get(
      "http://127.0.0.1:3200/__test__/link?email=earlier@example.com",
    )
  ).json();
  await page.getByRole("button", { name: "Utiliser un autre e-mail" }).click();
  await page.getByLabel("E-mail", { exact: true }).fill("later@example.com");
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(
    page.getByRole("button", { name: /Renvoyer dans/ }),
  ).toBeDisabled();
  await page.goto(earlier.url);
  await expect(
    page.getByLabel("Nouveau mot de passe", { exact: true }),
  ).toBeVisible();
  const isolated = await context.browser()!.newContext();
  const anonymous = await isolated.newPage();
  const later = await (
    await request.get(
      "http://127.0.0.1:3200/__test__/link?email=later@example.com",
    )
  ).json();
  await anonymous.goto(later.url);
  await expect(anonymous).toHaveURL(/\/sign-in\?error=link&reason=verifier$/);
  await isolated.close();
});

test("failed resend keeps the accepted inbox state", async ({ page }) => {
  await page.clock.install();
  await page.goto("/forgot-password");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("resend-failure@example.com");
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(
    page.getByRole("button", { name: /Renvoyer dans/ }),
  ).toBeDisabled();
  await page.clock.fastForward(61_000);
  await page.getByRole("button", { name: "Renvoyer le lien" }).click();
  await expect(
    page.getByText("Impossible de demander un lien.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("resend-failure@example.com", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Envoyer le lien" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Renvoyer dans/ }),
  ).toBeDisabled();
});

test("signup with a provider session returns to Stride", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Nom complet").fill("Jules Thibault");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("new-account@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page
    .getByLabel("Confirmer le mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page
    .getByRole("button", { name: "Créer un compte", exact: true })
    .click();
  await expect(page).toHaveURL("/today");
});
