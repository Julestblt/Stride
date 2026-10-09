import { expect, test } from "@playwright/test";

test("remote dev origin loads signup scripts and password guidance", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://stride.test:3100/sign-up");
  const password = page.getByLabel("Password", { exact: true });
  const confirmation = page.getByLabel("Confirm password", { exact: true });
  const createAccount = page.getByRole("button", {
    name: "Create account",
    exact: true,
  });
  await expect(createAccount).toBeDisabled();
  await page.getByLabel("Full name").fill("Jules Thibault");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await password.fill("LongTrailAtSunrise2026!");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(page.getByText("Strong", { exact: true })).toBeVisible();
  const rules = page.locator("#password-guidance li");
  for (const rule of await rules.all()) {
    await expect(rule.locator(".sr-only")).toHaveText("Met:");
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
    .getByRole("button", { name: "Show confirm password", exact: true })
    .click();
  await expect(confirmation).toHaveAttribute("type", "text");
  expect(errors).toEqual([]);
});
