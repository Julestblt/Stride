import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email = "athlete@example.com") {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL("/");
}

test("signed-out athletes are sent to sign-in", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("today shows the plan session, form, week and what comes next", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "plan@example.com");
  await page.goto("/today");
  await expect(
    page.getByRole("link", { name: "Aujourd’hui", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /^Aujourd’hui, [a-z]{3}\. \d{2}\/\d{2}\/\d{4}$/,
    }),
  ).toBeAttached();

  await expect(
    page.getByRole("link", { name: /Marathon de Paris/ }).first(),
  ).toBeVisible();
  await expect(page.getByText(/^S\d+ \/ \d+ · /)).toBeVisible();

  const session = page.getByRole("region", { name: "Séance du jour" });
  await expect(session.getByRole("heading", { level: 2 })).toBeVisible();
  const steps = session.getByRole("link", { name: "Voir les étapes" });
  if (await steps.count())
    await expect(steps).toHaveAttribute("href", /^\/plan\?seance=s-/);
  else
    await expect(
      session.getByRole("heading", { level: 2, name: "Repos" }),
    ).toBeVisible();

  const week = page.getByRole("region", { name: /^Cette semaine · S\d+$/ });
  await expect(week.getByRole("listitem")).toHaveCount(7);
  await expect(week.locator('[aria-current="date"]')).toHaveCount(1);
  await expect(
    week.getByRole("progressbar", { name: "Volume de la semaine réalisé" }),
  ).toBeVisible();

  const upcoming = page.getByRole("region", { name: "À venir" });
  await expect(
    upcoming.getByRole("link", { name: /10K Vincennes/ }),
  ).toHaveAttribute("href", /^\/races\//);

  const latest = page.getByRole("region", {
    name: /^(Hier|Aujourd’hui|Dernière activité)/,
  });
  await expect(latest.getByRole("link", { name: "Activité" })).toBeVisible();

  const form = page.getByRole("region", { name: "Forme du jour" });
  await expect(
    form.getByRole("link", { name: "Récupération" }),
  ).toHaveAttribute("href", "/progress/recovery");
  const legs = form.getByRole("radiogroup", {
    name: "Et tes jambes ce matin ?",
  });
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/today",
  );
  await legs.getByRole("radio", { name: "Fraîches" }).click();
  await expect(legs.getByRole("radio", { name: "Fraîches" })).toBeChecked();
  await saved;
  await page.reload();
  await expect(
    page
      .getByRole("radiogroup", { name: "Et tes jambes ce matin ?" })
      .getByRole("radio", { name: "Fraîches" }),
  ).toBeChecked();
});

test("today explains the missing plan and keeps Garmin data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/today");
  const session = page.getByRole("region", { name: "Séance du jour" });
  await expect(
    session.getByRole("heading", { level: 2, name: "Aucun plan actif" }),
  ).toBeVisible();
  await expect(
    session.getByRole("link", { name: "Voir le plan" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: /^Cette semaine/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Forme du jour" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "À venir" })).toBeVisible();
});

test("today stacks the day in reading order on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "plan@example.com");
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { level: 1, name: "Aujourd’hui" }),
  ).toBeVisible();
  const order = await Promise.all(
    ["Séance du jour", "Forme du jour", /^Cette semaine/, "À venir"].map(
      async (name) =>
        (await page.getByRole("region", { name }).boundingBox())?.y ?? -1,
    ),
  );
  expect(order.every((y) => y >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
