import { expect, type Cookie, type Page } from "@playwright/test";

const sessions = new Map<string, Cookie[]>();

export async function signInAs(page: Page, email: string) {
  const cookies = sessions.get(email);
  if (cookies) {
    await page.context().addCookies(cookies);
    await page.goto("/today");
  } else {
    await page.goto("/sign-in");
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page
      .getByLabel("Mot de passe", { exact: true })
      .fill("TrailMiles2026!");
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
  }
  await expect(page).toHaveURL("/today", { timeout: 20_000 });
  if (!cookies)
    sessions.set(
      email,
      (await page.context().cookies()).filter((cookie) =>
        cookie.name.startsWith("sb-"),
      ),
    );
}
