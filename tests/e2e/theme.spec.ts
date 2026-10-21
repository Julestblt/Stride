import { expect, test } from "@playwright/test";

test("the header theme menu switches, persists and follows the system", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/sign-in");
  await page.getByLabel("E-mail", { exact: true }).fill("athlete@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL("/today");
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Thème : Sombre" }).click();
  await expect(
    page.getByRole("menuitemradio", { name: "Sombre" }),
  ).toBeChecked();
  await page.getByRole("menuitemradio", { name: "Clair" }).click();
  await expect(root).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "Thème : Clair" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Thème : Clair" }).click();
  await page.getByRole("menuitemradio", { name: "Système" }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-theme", "dark");
});
