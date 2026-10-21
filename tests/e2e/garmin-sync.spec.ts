import { expect, test, type Page } from "@playwright/test";

const garminUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_GARMIN_PORT ?? 3300}`;
const syncUserId = "66666666-6666-4666-8666-666666666666";
const garminToken = `e30.${Buffer.from(JSON.stringify({ sub: syncUserId })).toString("base64url")}.fixture`;

test.describe.configure({ mode: "serial" });

async function connectGarmin() {
  const response = await fetch(`${garminUrl}/__test__/connected`, {
    method: "POST",
    headers: { Authorization: `Bearer ${garminToken}` },
  });
  expect(response.ok).toBe(true);
}

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail", { exact: true }).fill("sync@example.com");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("TrailMiles2026!");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL("/today");
}

function dataStatus(page: Page) {
  return page
    .getByRole("button", { name: /État des données/ })
    .filter({ visible: true })
    .first();
}

test("settings sync shows progress, refreshes the page and explains the limit", async ({
  page,
}) => {
  await connectGarmin();
  await signIn(page);
  await page.goto("/settings/connections/garmin");
  const button = page.getByRole("button", {
    name: "Synchroniser maintenant",
  });
  await expect(button).toBeEnabled();
  await expect(page.getByText("à l’instant", { exact: true })).toHaveCount(0);
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Synchronisation en cours…" }),
  ).toBeDisabled();
  await expect(page.getByText("à l’instant", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  const ready = page.getByRole("button", { name: "Synchroniser maintenant" });
  await expect(ready).toBeDisabled();
  await expect(
    page.getByText(/^Synchronisation possible à \d{2}:\d{2}\.$/),
  ).toBeVisible();
});

test.describe("mobile pull-to-sync", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  async function pull(page: Page, distance: number, release = true) {
    const client = await page.context().newCDPSession(page);
    const x = 195;
    const y = 260;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 6; step += 1)
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + (distance * step) / 6 }],
      });
    if (release)
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    return client;
  }

  test("a short pull cancels and a full pull syncs with progress", async ({
    page,
  }) => {
    await connectGarmin();
    await signIn(page);
    await page.goto("/activities");
    await expect(dataStatus(page)).toBeVisible();
    await page.waitForLoadState("networkidle");

    await pull(page, 40);
    await expect(page.getByTestId("pull-to-sync")).toHaveCount(0);
    await expect(dataStatus(page)).not.toHaveAttribute(
      "title",
      /Garmin · \d sur/,
    );

    const client = await pull(page, 100, false);
    await expect(page.getByTestId("pull-to-sync")).toHaveText(
      "Relâche pour synchroniser Garmin",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({ path: "test-results/pull-to-sync-390.png" });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(dataStatus(page)).toHaveAttribute(
      "title",
      /^Garmin · \d sur 2/,
    );
    await expect(dataStatus(page)).toHaveAttribute("title", /synchronisé/, {
      timeout: 15_000,
    });

    await pull(page, 100, false);
    await expect(page.getByTestId("pull-to-sync")).toHaveText(
      /^Synchronisation possible à \d{2}:\d{2}$/,
    );
  });

  test("the data panel triggers a sync and stays still under reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await connectGarmin();
    await signIn(page);
    await page.goto("/activities");
    await page.waitForLoadState("networkidle");
    await dataStatus(page).click();
    const panel = page.getByRole("dialog", { name: "État des données" });
    await panel
      .getByRole("button", { name: "Synchroniser maintenant" })
      .click();
    await expect(
      panel.getByRole("button", { name: "Synchronisation en cours…" }),
    ).toBeDisabled();
    const animated = await page
      .getByTestId("data-activity-thread")
      .filter({ visible: true })
      .first()
      .evaluate((element) =>
        [element, ...element.querySelectorAll("*")].some(
          (node) => getComputedStyle(node).animationName !== "none",
        ),
      )
      .catch(() => false);
    expect(animated).toBe(false);
    await expect(
      panel.getByText(/^Synchronisation possible à \d{2}:\d{2}\.$/),
    ).toBeVisible({ timeout: 15_000 });
  });
});
