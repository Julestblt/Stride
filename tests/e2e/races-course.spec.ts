import { expect, test } from "@playwright/test";

test("a populated race opens every workspace section on desktop and mobile", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await request.post(
    `http://127.0.0.1:${process.env.PLAYWRIGHT_AUTH_PORT ?? 3200}/__test__/race-course`,
  );
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("athlete@example.com");
  await page.getByLabel("Password", { exact: true }).fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/races");
    await expect(
      page.getByRole("heading", { level: 1, name: "EcoTrail Paris 120K" }),
    ).toBeVisible();
    await expect(
      page.getByText("parcours-test.gpx").nth(viewport.width < 500 ? 1 : 0),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/race-course-${viewport.width}.png`,
      fullPage: true,
    });
    const sections = page.getByRole("navigation", {
      name: "Sections de la course",
    });
    for (const label of [
      "Roadbook",
      "Nutrition",
      "Équipement",
      "Préparation",
    ]) {
      await sections.getByRole("link", { name: label }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "EcoTrail Paris 120K" }),
      ).toBeVisible();
    }
    await page.goto("/races/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/waypoints");
    await expect(
      page.getByRole("heading", { name: /Points de passage/ }).first(),
    ).toBeVisible();
  }
});
