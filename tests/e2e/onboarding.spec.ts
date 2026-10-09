import { expect, test, type Page } from "@playwright/test";
import { onboardingTestClients } from "../fixtures/onboarding-clients";
const password = "Str1de-!test-athlete-passphrase";
const { admin, athlete } = onboardingTestClients();
const createdUsers: string[] = [];
const clients = new Map<string, ReturnType<typeof athlete>>();
async function makeAthlete() {
  const email = `onboarding-${crypto.randomUUID()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw error ?? new Error("Unable to create isolated athlete");
  createdUsers.push(data.user.id);
  const client = athlete();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session)
    throw (
      signedIn.error ?? new Error("Unable to authenticate isolated athlete")
    );
  clients.set(data.user.id, client);
  return {
    id: data.user.id,
    email,
    client,
    token: signedIn.data.session.access_token,
  };
}
async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/welcome$/);
}
async function seed(userId: string, currentStep = "about") {
  const client = clients.get(userId)!;
  for (const step of ["welcome", "garmin", "history"] as const) {
    const row = await read(userId);
    const response =
      step === "garmin"
        ? await admin.rpc("complete_onboarding_step_server", {
            p_user_id: userId,
            p_step: step,
            p_expected_revision: row.revision,
          })
        : await client.rpc("complete_onboarding_step", {
            p_step: step,
            p_expected_revision: row.revision,
          });
    if (response.error) throw response.error;
  }
  const row = await read(userId);
  const response = await client.rpc("set_onboarding_current_step", {
    p_step: currentStep,
    p_expected_revision: row.revision,
  });
  if (response.error) throw response.error;
}
async function read(userId: string) {
  const response = await clients
    .get(userId)!
    .from("onboarding_progress")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (response.error) throw response.error;
  return response.data;
}
test.afterAll(async () => {
  for (const userId of createdUsers) await admin.auth.admin.deleteUser(userId);
});
test("signed-out routes redirect and sync rejects anonymous access without caching", async ({
  page,
  request,
}) => {
  await page.goto("/onboarding/goals");
  await expect(page).toHaveURL(/\/sign-in$/);
  const response = await request.get("/api/onboarding/sync?userId=foreign");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});
test("first entry, locked URLs, refresh/relogin and second context preserve durable progress", async ({
  page,
  browser,
}) => {
  const user = await makeAthlete();
  await signIn(page, user.email);
  const initial = await read(user.id);
  expect(initial.current_step).toBe("welcome");
  await page.reload();
  expect((await read(user.id)).revision).toBe(initial.revision);
  await page.goto("/onboarding/profile");
  await expect(page).toHaveURL(/\/onboarding\/welcome$/);
  await page.goto("/onboarding/unknown");
  await expect(
    page.getByRole("heading", { name: "Page introuvable" }),
  ).toBeVisible();
  await seed(user.id);
  await page.goto("/onboarding/about");
  await expect(page).toHaveURL(/\/onboarding\/about$/);
  const before = await read(user.id);
  await page.reload();
  expect(await read(user.id)).toEqual(before);
  const second = await browser.newContext();
  const secondPage = await second.newPage();
  await secondPage.goto("http://127.0.0.1:3110/sign-in");
  await secondPage.getByLabel("Email", { exact: true }).fill(user.email);
  await secondPage.getByLabel("Password", { exact: true }).fill(password);
  await secondPage
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(secondPage).toHaveURL(/\/onboarding\/about$/);
  expect(await read(user.id)).toEqual(before);
  await page.context().clearCookies();
  await page.goto("/onboarding/about");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/about$/);
  expect(await read(user.id)).toEqual(before);
  await second.close();
});
test("explicit sidebar and Back navigation persist; a stale context reloads safely", async ({
  page,
}) => {
  const user = await makeAthlete();
  await signIn(page, user.email);
  await seed(user.id);
  await page.goto("/onboarding/about");
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/history$/);
  expect((await read(user.id)).current_step).toBe("history");
  await page
    .getByRole("button", { name: "À propos de toi", exact: true })
    .click();
  await expect(page).toHaveURL(/\/onboarding\/about$/);
  expect((await read(user.id)).current_step).toBe("about");
  const row = await read(user.id);
  await user.client.rpc("set_onboarding_current_step", {
    p_step: "welcome",
    p_expected_revision: row.revision,
  });
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "autre fenêtre" }),
  ).toBeVisible();
  expect((await read(user.id)).current_step).toBe("welcome");
});
test("completed athletes reach the application and second athletes cannot read progress", async ({
  page,
}) => {
  const user = await makeAthlete();
  await signIn(page, user.email);
  const other = await makeAthlete();
  const foreign = await other.client
    .from("onboarding_progress")
    .select("*")
    .eq("user_id", user.id);
  expect(foreign.data).toEqual([]);
  await seed(user.id);
  const profile = await user.client.from("athlete_profiles").insert({
    user_id: user.id,
    first_name: "Athlete",
    birth_date: "1990-01-01",
    sex: "unspecified",
    height_cm: 175,
    weight_kg: 70,
    primary_terrain: "mixed",
    available_weekdays: [1, 3, 6],
    long_run_day: "saturday",
    weekday_session_minutes: 60,
  });
  expect(profile.error).toBeNull();
  const goal = await user.client
    .from("athlete_goals")
    .insert({ user_id: user.id, focus: "general_fitness" });
  expect(goal.error).toBeNull();
  for (const step of ["about", "goals"] as const) {
    const row = await read(user.id);
    const result = await user.client.rpc("complete_onboarding_step", {
      p_step: step,
      p_expected_revision: row.revision,
    });
    expect(result.error).toBeNull();
  }
  const row = await read(user.id);
  const completed = await admin.rpc("complete_onboarding_step_server", {
    p_user_id: user.id,
    p_step: "profile",
    p_expected_revision: row.revision,
  });
  expect(completed.error).toBeNull();
  await page.goto("/onboarding/garmin");
  await expect(page).toHaveURL("http://127.0.0.1:3110/");
  await page.reload();
  await expect(page).toHaveURL("http://127.0.0.1:3110/");
});
test("real sync count continues across navigation, shell geometry and keyboard are accessible", async ({
  page,
}) => {
  const user = await makeAthlete();
  await signIn(page, user.email);
  await seed(user.id);
  const connection = await fetch(
    "http://127.0.0.1:3310/v1/connections/garmin/start",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "athlete@example.com",
        password: "correct-password",
      }),
    },
  );
  expect(connection.ok).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboarding/about");
  await expect(
    page.getByText(/Activités · Import en cours · \d+ activités/),
  ).toBeVisible();
  const sidebar = await page.getByRole("complementary").boundingBox();
  expect(sidebar?.width).toBe(264);
  await page.screenshot({ path: "test-results/onboarding-desktop.png" });
  await page.getByRole("button", { name: "Retour", exact: true }).focus();
  await expect(
    page.getByRole("button", { name: "Retour", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/onboarding\/history$/);
  await expect(
    page.getByText(/Activités · .* · (50|75|100) activités/),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("progressbar", { name: "Progression du parcours" }),
  ).toHaveAttribute("aria-valuetext", "Étape 3 sur 6");
  await page.getByLabel("Étape du parcours").selectOption("about");
  await expect(page).toHaveURL(/\/onboarding\/about$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/onboarding-mobile.png" });
});
