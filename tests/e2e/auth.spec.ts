import { expect, test } from "@playwright/test";

test("auth navigation, accessible controls, focus and blank initial state", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
  await page.getByLabel("Password", { exact: true }).fill("a-test-password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Full name").fill("Jules Thibault");
  await page.getByLabel("Email", { exact: true }).fill("runner@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a-quiet-trail-at-dawn");
  await page.getByLabel("Confirm password", { exact: true }).fill("different");
  await expect(page.getByText("Passwords don't match yet.")).toBeVisible();
  await expect(
    page.getByLabel("Confirm password", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("a-quiet-trail-at-dawn");
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeEnabled();
  await page.getByText("Terms", { exact: true }).click();
  await expect(page.getByText(/terms are not published yet/)).toBeVisible();
});

test("recovery stages start gated and reset rejects anonymous sessions", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("button", { name: "Send reset link" }),
  ).toBeVisible();
  await expect(page.getByText("Resend", { exact: false })).not.toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  await page.goto("/reset-password");
  await expect(
    page.getByText(
      "Sign in or open a fresh recovery link from your inbox before choosing a new password.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save and sign in" }),
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
    page.getByText(/This link is invalid or has expired/),
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
    const back = page.getByRole("link", { name: "Back to sign in" });
    const wordmark = page.getByRole("link", { name: "Stride sign in" });
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
