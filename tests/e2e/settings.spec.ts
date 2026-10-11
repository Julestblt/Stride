import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}

test("settings requires a signed-in athlete", async ({ page }) => {
  await page.goto("/settings/profile");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("desktop settings reflect stored athlete data and expose every supported section", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "You settings" })
    .getByRole("link", { name: "Profile" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Profile" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "First name" })).toHaveValue(
    "Jules",
  );
  await expect(page.getByLabel("Weight (kg)")).toHaveValue("68.2");
  await page.getByLabel("Weight (kg)").fill("69");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page).toHaveURL(/\/settings\/profile\?status=saved$/);
  await page.reload();
  await expect(page.getByLabel("Weight (kg)")).toHaveValue("69");
  await page
    .getByRole("navigation", { name: "You settings" })
    .getByRole("link", { name: "Training" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Training" }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Trail" })).toBeChecked();
  await page.getByText("Road", { exact: true }).click();
  await page.getByRole("button", { name: "Save training preferences" }).click();
  await expect(page).toHaveURL(/\/settings\/training\?status=saved$/);
  await page.reload();
  await expect(page.getByRole("radio", { name: "Road" })).toBeChecked();
  await page
    .getByRole("navigation", { name: "You settings" })
    .getByRole("link", { name: "Goals and races" })
    .click();
  await expect(page.getByText("EcoTrail Paris 120K").first()).toBeVisible();
  await page
    .getByRole("combobox", { name: "What are you working toward?" })
    .selectOption("trail");
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page).toHaveURL(/\/settings\/goals\?status=saved$/);
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "What are you working toward?" }),
  ).toHaveValue("trail");
  const add = page.getByRole("form", { name: "Add race" });
  await add.getByLabel("Race name").fill("Training 10K");
  await add.getByLabel("Date").fill("2027-08-10");
  await add.getByLabel("Distance (km)").fill("10");
  await add.getByRole("button", { name: "Add race" }).click();
  await expect(page).toHaveURL(/\/settings\/goals\?status=saved$/);
  await page.reload();
  await page.getByText("Training 10K", { exact: false }).first().click();
  await page.getByRole("button", { name: "Remove race" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove race" })
    .click();
  await expect(page.getByText("Training 10K")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Data settings" })
    .getByRole("link", { name: "Connections" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Connections" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Manage" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Garmin" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Data settings" })
    .getByRole("link", { name: "Data and privacy" })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JSON" }).click();
  expect((await download).suggestedFilename()).toBe("stride-settings.json");
});

test("mobile settings keep a narrow viewport navigable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/settings");
  await expect(
    page.getByRole("link", { name: /Goals and races/ }).last(),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Goals and races/ })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Goals and races" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to settings" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
