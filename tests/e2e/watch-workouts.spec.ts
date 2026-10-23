import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./support/session";

const garminUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_GARMIN_PORT ?? 3300}`;
const authUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_AUTH_PORT ?? 3200}`;
const watchUserId = "abababab-abab-4bab-8bab-abababababab";
const watchPlanId = "dddddddd-dddd-4ddd-8ddd-abababababab";
const garminToken = `e30.${Buffer.from(JSON.stringify({ sub: watchUserId })).toString("base64url")}.fixture`;
const garminHeaders = { Authorization: `Bearer ${garminToken}` };

type WatchCall = {
  method: string;
  body: {
    from?: string;
    to?: string;
    workouts?: {
      key: string;
      date: string;
      force?: boolean;
      allow_simplified?: boolean;
    }[];
  };
};

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await fetch(`${authUrl}/__test__/watch-settings`, { method: "DELETE" });
  const connected = await fetch(`${garminUrl}/__test__/connected`, {
    method: "POST",
    headers: garminHeaders,
  });
  expect(connected.ok).toBe(true);
});

async function calls(): Promise<WatchCall[]> {
  const response = await fetch(`${garminUrl}/__test__/watch`, {
    headers: garminHeaders,
  });
  return response.json();
}

async function failWorkouts(fail: boolean) {
  await fetch(`${garminUrl}/__test__/watch`, {
    method: "POST",
    headers: { ...garminHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ fail }),
  });
}

function signIn(page: Page) {
  return signInAs(page, "watch@example.com");
}

async function sentWeek() {
  const sent = (await calls())
    .flatMap((call) => call.body.workouts ?? [])
    .find((workout) => workout.allow_simplified);
  if (!sent) throw new Error("No confirmed workout");
  const date = new Date(`${sent.date}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

const sessionLinks = (page: Page) =>
  page.locator('a[href*="seance="]').filter({ visible: true });

test("turning sending on pushes the next seven days to the watch", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/connections/garmin");
  const toggle = page.getByRole("switch", {
    name: "Envoyer les séances prévues à ta montre",
  });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Bientôt")).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("heading", { name: "Sur ta montre · 7 prochains jours" }),
  ).toBeVisible({ timeout: 15_000 });
  const confirm = page.getByRole("button", { name: "Envoyer quand même" });
  await expect(confirm.first()).toBeVisible();
  const held = await confirm.count();
  await confirm.last().click();
  await expect(page.getByText("Envoyée").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(confirm).toHaveCount(held - 1);

  const [put] = await calls();
  expect(put.method).toBe("PUT");
  const { from, to, workouts = [] } = put.body;
  expect(workouts.length).toBeGreaterThan(0);
  for (const workout of workouts) {
    expect(workout.key.startsWith(`${watchPlanId}:`)).toBe(true);
    expect(workout.date >= (from ?? "")).toBe(true);
    expect(workout.date <= (to ?? "")).toBe(true);
    expect(workout.force).toBeUndefined();
  }
  const confirmed = (await calls()).at(-1)?.body.workouts ?? [];
  expect(confirmed.filter((workout) => workout.allow_simplified)).toHaveLength(
    1,
  );
  await page.screenshot({ path: "test-results/watch-settings-desktop.png" });
});

test("a sent session shows its watch status and can be sent again", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/plan?week=${await sentWeek()}`);
  const tagged = sessionLinks(page).filter({ hasText: "Sur la montre" });
  await expect(tagged.first()).toBeVisible();
  await tagged.first().click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("Sur ta montre", { exact: true })).toBeVisible();
  const resend = panel.getByRole("button", { name: "Renvoyer sur la montre" });
  await expect(resend).toBeEnabled();
  const before = (await calls()).length;
  await resend.click();
  await expect.poll(async () => (await calls()).length).toBe(before + 1);
  const last = (await calls()).at(-1);
  const sessionKey = new URL(page.url()).searchParams.get("seance");
  expect(
    last?.body.workouts?.find(
      (workout) => workout.key === `${watchPlanId}:${sessionKey}`,
    )?.force,
  ).toBe(true);
  await page.screenshot({ path: "test-results/watch-panel-desktop.png" });
});

test("a failed push explains itself and offers a retry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`/plan?week=${await sentWeek()}`);
  const tagged = sessionLinks(page).filter({ hasText: "Sur la montre" });
  await tagged.first().click();
  const panel = page.getByRole("dialog");
  await failWorkouts(true);
  await panel.getByRole("button", { name: "Renvoyer sur la montre" }).click();
  await expect(
    panel.getByText("Pas sur ta montre", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    panel.getByText("Garmin n’a pas répondu. Je réessaie au prochain passage."),
  ).toBeVisible();
  await failWorkouts(false);
  await panel.getByRole("button", { name: "Réessayer" }).click();
  await expect(panel.getByText("Sur ta montre", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({ path: "test-results/watch-panel-mobile.png" });
});

test("turning sending off removes the upcoming workouts", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/connections/garmin");
  const toggle = page.getByRole("switch", {
    name: "Envoyer les séances prévues à ta montre",
  });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(
    page.getByRole("heading", { name: "Sur ta montre · 7 prochains jours" }),
  ).toHaveCount(0, { timeout: 15_000 });
  expect((await calls()).at(-1)?.method).toBe("DELETE");
  await page.goto("/plan");
  await expect(
    sessionLinks(page).filter({ hasText: "Sur la montre" }),
  ).toHaveCount(0);
});
