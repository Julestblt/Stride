import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./support/session";

const authUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_AUTH_PORT ?? 3200}`;

function lastMonday() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
  }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday - 7);
  return date.toISOString().slice(0, 10);
}

function signIn(page: Page) {
  return signInAs(page, "plan@example.com");
}

test("an imported run marks its missed session as done on the next render", async ({
  page,
}) => {
  const reset = await fetch(`${authUrl}/__test__/plan-import`, {
    method: "DELETE",
  });
  expect(reset.ok).toBe(true);
  await signIn(page);
  await page.goto(`/plan?week=${lastMonday()}`);
  const missed = page.getByText("Non fait", { exact: true }).filter({
    visible: true,
  });
  await expect(missed).toHaveCount(1);

  const response = await fetch(`${authUrl}/__test__/plan-import`, {
    method: "POST",
  });
  expect(response.ok).toBe(true);
  const { sessionKey } = (await response.json()) as { sessionKey: string };

  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1 }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(missed).toHaveCount(0);
  await expect(
    page
      .locator(`a[href*="seance=${sessionKey}"]`)
      .filter({ visible: true })
      .first(),
  ).toContainText(/Fait|Partiel/);
});
