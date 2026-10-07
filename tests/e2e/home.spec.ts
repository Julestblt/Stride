import { expect, test } from "@playwright/test";

test("the Stride foundation page presents the product clearly", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Stride/);
  await expect(
    page.getByRole("heading", { name: /Your running, with context\./ }),
  ).toBeVisible();
  await expect(page.getByText("Road and trail, in one stride.")).toBeVisible();
});
