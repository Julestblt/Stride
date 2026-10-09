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
test("Welcome persists completion before moving on and stays reachable without resetting progress", async ({
  page,
}) => {
  const user = await makeAthlete();
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, user.email);
  await expect(
    page.getByRole("heading", { name: "Configurons ton coach." }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Configuration de ton coach" }),
  ).toContainText(user.email);
  await page.route("**/onboarding/welcome", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: "C’est parti", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "L’enregistrement a échoué" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding\/welcome$/);
  expect((await read(user.id)).welcome_completed_at).toBeNull();
  await page.unroute("**/onboarding/welcome");
  const retry = page.getByRole("button", { name: "Réessayer", exact: true });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/onboarding\/garmin$/);
  const completed = await read(user.id);
  expect(completed.welcome_completed_at).not.toBeNull();
  expect(completed.current_step).toBe("garmin");
  await page.goBack();
  await expect(page).toHaveURL(/\/onboarding\/welcome$/);
  await page.reload();
  await expect(page).toHaveURL(/\/onboarding\/welcome$/);
  expect(await read(user.id)).toEqual(completed);
  await seed(user.id);
  const advanced = await read(user.id);
  await page.goto("/onboarding/welcome");
  await expect(page).toHaveURL(/\/onboarding\/welcome$/);
  expect(await read(user.id)).toEqual(advanced);
  await page.getByRole("button", { name: "C’est parti", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/garmin$/);
  const returned = await read(user.id);
  for (const step of ["welcome", "garmin", "history"] as const)
    expect(returned[`${step}_completed_at`]).toBe(
      advanced[`${step}_completed_at`],
    );
  await page.goto("/onboarding/about");
  await expect(page).toHaveURL(/\/onboarding\/about$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding/welcome");
  const start = page.getByRole("button", { name: "C’est parti", exact: true });
  await expect(start).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/onboarding-welcome-mobile.png" });
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
  const importCard = page.getByRole("region", { name: "Import depuis Garmin" });
  await expect(importCard).toContainText(
    /\d+ activités · actuellement en \d{4}/,
  );
  await expect(
    page.getByRole("complementary", { name: "Configuration de ton coach" }),
  ).toContainText(/Lecture en cours · \d{4}/);
  const sidebar = await page
    .getByRole("complementary", { name: "Configuration de ton coach" })
    .boundingBox();
  expect(sidebar?.width).toBe(264);
  await page.screenshot({ path: "test-results/onboarding-desktop.png" });
  await page.getByRole("button", { name: "Retour", exact: true }).focus();
  await expect(
    page.getByRole("button", { name: "Retour", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/onboarding\/history$/);
  await expect(importCard).toContainText(/(50|75|100) activités/);
  await expect(
    page
      .locator("header")
      .getByText("Garmin connecté")
      .filter({ visible: true }),
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
async function atGarminStep(page: Page) {
  const user = await makeAthlete();
  await signIn(page, user.email);
  const row = await read(user.id);
  const welcome = await user.client.rpc("complete_onboarding_step", {
    p_step: "welcome",
    p_expected_revision: row.revision,
  });
  if (welcome.error) throw welcome.error;
  await page.goto("/onboarding/garmin");
  await expect(
    page.getByRole("heading", { name: "Connecter Garmin" }),
  ).toBeVisible();
  return user;
}
function watchTraffic(page: Page) {
  const urls: string[] = [];
  const bodies: Promise<string>[] = [];
  page.on("request", (request) => urls.push(request.url()));
  page.on("response", (response) => {
    if (response.request().method() === "POST")
      bodies.push(response.text().catch(() => ""));
  });
  return async () => ({ urls, bodies: await Promise.all(bodies) });
}
async function expectNothingPersisted(
  page: Page,
  traffic: () => Promise<{ urls: string[]; bodies: string[] }>,
  secrets: string[],
) {
  const stored = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage, url: location.href }),
  );
  const cookies = JSON.stringify(await page.context().cookies());
  const { urls, bodies } = await traffic();
  for (const secret of secrets) {
    expect(stored).not.toContain(secret);
    expect(cookies).not.toContain(secret);
    for (const url of urls) expect(url).not.toContain(secret);
    for (const body of bodies) expect(body).not.toContain(secret);
  }
}
async function signInToGarmin(page: Page, email: string, password: string) {
  await page.getByLabel("E-mail Garmin Connect").fill(email);
  await page.getByLabel("Mot de passe Garmin Connect").fill(password);
  await page.getByLabel("Mot de passe Garmin Connect").press("Enter");
}
test("Garmin connects without MFA, recovers from invalid credentials and keeps secrets out of storage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const user = await atGarminStep(page);
  const traffic = watchTraffic(page);
  await page
    .getByRole("main")
    .getByRole("button", { name: "Connecter Garmin" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Connecte-toi à Garmin Connect" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Configuration de ton coach" }),
  ).toContainText("Connexion en cours");
  await signInToGarmin(page, "athlete@example.com", "wrong-password");
  await expect(
    page.getByRole("alert").filter({ hasText: "n’a pas pu vérifier" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail Garmin Connect")).toHaveValue(
    "athlete@example.com",
  );
  await expect(page.getByLabel("Mot de passe Garmin Connect")).toHaveValue("");
  await expect(page.getByLabel("Mot de passe Garmin Connect")).toBeFocused();
  await page.screenshot({ path: "test-results/garmin-invalid-desktop.png" });
  await page.getByLabel("Mot de passe Garmin Connect").fill("correct-password");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Garmin connecté" }),
  ).toBeVisible();
  await expect(page.getByText("Passage automatique dans")).toBeVisible();
  await expect(
    page
      .getByRole("complementary", { name: "Configuration de ton coach" })
      .getByText("Connecté", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("header")
      .getByText("Garmin connecté")
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding\/history$/, { timeout: 10_000 });
  const progress = await read(user.id);
  expect(progress.garmin_completed_at).not.toBeNull();
  expect(progress.current_step).toBe("history");
  await expectNothingPersisted(page, traffic, [
    "correct-password",
    "wrong-password",
  ]);
  await page.goto("/onboarding/garmin");
  await expect(
    page.getByRole("heading", { name: "Garmin connecté" }),
  ).toBeVisible();
  await expect(page.getByText("Passage automatique dans")).toHaveCount(0);
});
test("Garmin MFA handles refresh, rejected and expired codes, then a pasted code", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const user = await atGarminStep(page);
  const traffic = watchTraffic(page);
  const toCode = async () => {
    await signInToGarmin(page, "mfa@example.com", "correct-password");
    await expect(
      page.getByRole("heading", { name: "Confirme que c’est toi" }),
    ).toBeVisible();
    await expect(page.getByLabel("Code de vérification")).toBeFocused();
  };
  await page
    .getByRole("main")
    .getByRole("button", { name: "Connecter Garmin" })
    .click();
  await toCode();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Connecter Garmin" }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("button", { name: "Connecter Garmin" })
    .click();
  await toCode();
  const verify = page.getByRole("button", { name: "Vérifier", exact: true });
  await expect(verify).toBeDisabled();
  await page.getByLabel("Code de vérification").fill("000000");
  await verify.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Ce code n’a pas été accepté." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Se reconnecter" }).click();
  await expect(page.getByLabel("E-mail Garmin Connect")).toHaveValue(
    "mfa@example.com",
  );
  await expect(page.getByLabel("Mot de passe Garmin Connect")).toHaveValue("");
  await toCode();
  await page.getByLabel("Code de vérification").fill("111111");
  await verify.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Ce code a expiré." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Se reconnecter" }).click();
  await toCode();
  await page.getByLabel("Code de vérification").fill("482 716");
  await expect(page.getByLabel("Code de vérification")).toHaveValue("482716");
  await page.screenshot({ path: "test-results/garmin-code-mobile.png" });
  await page.getByLabel("Code de vérification").press("Enter");
  await expect(
    page.getByRole("heading", { name: "Garmin connecté" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Continuer vers l’import", exact: true })
    .click();
  await expect(page).toHaveURL(/\/onboarding\/history$/);
  expect((await read(user.id)).garmin_completed_at).not.toBeNull();
  await expectNothingPersisted(page, traffic, [
    "correct-password",
    "482716",
    "000000",
    "111111",
  ]);
});
test("Garmin outages, rate limits and failed connections keep the athlete on sign-in", async ({
  page,
}) => {
  const user = await atGarminStep(page);
  await page
    .getByRole("main")
    .getByRole("button", { name: "Connecter Garmin" })
    .click();
  await signInToGarmin(page, "unavailable@example.com", "correct-password");
  await expect(
    page.getByRole("alert").filter({ hasText: "plus de temps que d’habitude" }),
  ).toBeVisible();
  await expect(page.getByLabel("Mot de passe Garmin Connect")).toHaveValue(
    "correct-password",
  );
  await signInToGarmin(page, "limited@example.com", "correct-password");
  await expect(
    page.getByRole("alert").filter({ hasText: "en pause un instant" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Réessayer", exact: true }),
  ).toBeEnabled();
  await signInToGarmin(page, "paused@example.com", "correct-password");
  await expect(
    page.getByRole("button", { name: /^Réessayer dans [12]:\d\d$/ }),
  ).toBeDisabled();
  await page.reload();
  await page
    .getByRole("main")
    .getByRole("button", { name: "Connecter Garmin" })
    .click();
  await signInToGarmin(page, "failed@example.com", "correct-password");
  await expect(
    page.getByRole("alert").filter({ hasText: "n’a pas pu aboutir" }),
  ).toBeVisible();
  await expect(page.getByLabel("Mot de passe Garmin Connect")).toHaveValue("");
  await page
    .getByRole("button", { name: "Retour", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Connecter Garmin" }),
  ).toBeVisible();
  expect((await read(user.id)).garmin_completed_at).toBeNull();
});
test("a slow Garmin sign-in explains the wait after 15 seconds", async ({
  page,
}) => {
  await page.clock.install();
  await atGarminStep(page);
  await page
    .getByRole("main")
    .getByRole("button", { name: "Connecter Garmin" })
    .click();
  await signInToGarmin(page, "slow@example.com", "correct-password");
  await expect(
    page.getByRole("button", { name: "Connexion à Garmin…" }),
  ).toBeVisible();
  await page.clock.fastForward(15_000);
  await expect(
    page.getByText("Toujours en contact avec Garmin…"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Garmin connecté" }),
  ).toBeVisible({ timeout: 10_000 });
});
test("history import shows real sync states without estimates and continues immediately", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const user = await makeAthlete();
  await signIn(page, user.email);
  for (const step of ["welcome", "garmin"] as const) {
    const row = await read(user.id);
    const response =
      step === "garmin"
        ? await admin.rpc("complete_onboarding_step_server", {
            p_user_id: user.id,
            p_step: step,
            p_expected_revision: row.revision,
          })
        : await user.client.rpc("complete_onboarding_step", {
            p_step: step,
            p_expected_revision: row.revision,
          });
    if (response.error) throw response.error;
  }
  await page.goto("/onboarding/history");
  const content = page.getByRole("region", { name: "Contenu de l’étape" });
  await expect(
    content.getByRole("heading", { name: "Création de ton profil d’athlète" }),
  ).toBeVisible();
  await expect(content.getByText("Import en pause.")).toBeVisible();
  await expect(
    content.getByRole("list", { name: "Import par catégorie" }),
  ).toContainText("En attente");
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
  await page.reload();
  await expect(content.getByText("Import en pause.")).toHaveCount(0);
  await expect(
    content.getByRole("list", { name: "Import par catégorie" }),
  ).toContainText(/\d+ activités/);
  const years = await content
    .getByRole("region", { name: "Historique lu" })
    .getByRole("listitem")
    .count();
  expect(years).toBeGreaterThanOrEqual(1);
  expect(years).toBeLessThanOrEqual(12);
  await expect(
    content.getByRole("list", { name: "Import par catégorie" }),
  ).toContainText(/100 activités/, { timeout: 60_000 });
  await expect(content).toContainText("Tout l’historique disponible est lu.");
  expect(await content.innerText()).not.toMatch(
    /%|~|minutes? environ|Ce que je remarque|dans \d+ min/,
  );
  await page.screenshot({ path: "test-results/history-desktop.png" });
  expect((await read(user.id)).history_completed_at).toBeNull();
  await content.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/about$/);
  const progress = await read(user.id);
  expect(progress.history_completed_at).not.toBeNull();
  expect(progress.current_step).toBe("about");
});
