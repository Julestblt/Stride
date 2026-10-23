import { expect, test, type Page, type Route } from "@playwright/test";
import { signInAs } from "./support/session";

const authPort = Number(process.env.PLAYWRIGHT_AUTH_PORT ?? 3200);
const kneeThread = "c0c0c0c0-0000-4000-8000-000000000001";
const planThread = "c0c0c0c0-0000-4000-8000-000000000002";
const spikeThread = "c0c0c0c0-0000-4000-8000-000000000003";
const newThread = "c0c0c0c0-0000-4000-8000-0000000000aa";
const newPlanProposal = "eeeeeeee-eeee-4eee-8eee-900000000001";
const coachActivity = "aaaaaaaa-aaaa-4aaa-8aaa-000000009101";
const coachRace = "c0ace000-0000-4000-8000-000000000001";
const addContext = "Ajouter du contexte : séance, activité ou course";

test.describe.configure({ mode: "serial" });

async function resetCoach() {
  await fetch(`http://127.0.0.1:${authPort}/__test__/coach`, {
    method: "DELETE",
  });
}

async function coachTurn(update: {
  session: Record<string, unknown>;
  items?: { kind: string; body: Record<string, unknown> }[];
}) {
  const response = await fetch(
    `http://127.0.0.1:${authPort}/__test__/coach-turn`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: planThread, ...update }),
    },
  );
  expect(response.ok).toBe(true);
}

test.beforeAll(resetCoach);
test.afterAll(resetCoach);

function signIn(page: Page, email = "coach@example.com") {
  return signInAs(page, email);
}

const at = () => new Date().toISOString();

function stream(events: unknown[]) {
  return async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      body: events
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(""),
    });
  };
}

function item(kind: string, body: Record<string, unknown>) {
  return { type: "item", item: { kind, at: at(), ...body } };
}

async function expectNotFound(page: Page) {
  await expect(
    page.getByRole("heading", { level: 1, name: "Conversation introuvable" }),
  ).toBeVisible();
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]'),
  ).not.toHaveCount(0);
}

test("the conversations list, consult, question and Suivi at 1440", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/today");
  const coachLink = page.getByRole("link", { name: "Coach", exact: true });
  const coachItem = page.locator("li", { has: coachLink }).first();
  await expect(coachItem).toContainText(
    "1 question et 1 proposition en attente",
  );
  await expect(coachItem.getByText("Conversations")).toHaveCount(0);
  await coachLink.click();
  await expect(page).toHaveURL("/coach", { timeout: 20_000 });
  const sidebarConversations = coachItem.getByRole("link", {
    name: "Conversations",
  });
  await expect(sidebarConversations).toHaveAttribute("aria-current", "page");
  await expect(
    coachItem.getByRole("link", { name: "L’équipe" }),
  ).not.toHaveAttribute("aria-current");

  const filters = page.getByRole("group", { name: "Filtrer" });
  const all = filters.getByRole("button", { name: "Toutes" });
  const mine = filters.getByRole("button", { name: "À toi · 2" });
  await expect(all).toHaveAttribute("aria-pressed", "true");
  const filterStyle = await mine.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.minHeight, style.fontSize, style.borderTopWidth];
  });
  expect(filterStyle).toEqual(["30px", "12px", "1px"]);
  await mine.click();
  await expect(mine).toHaveAttribute("aria-pressed", "true");
  await expect(all).toHaveAttribute("aria-pressed", "false");
  await all.click();

  const list = page.getByRole("region", { name: "Conversations" });
  await expect(list.getByText("En cours")).toBeVisible();
  await expect(
    list.getByRole("link", { name: /Genou en descente/ }),
  ).toContainText("Question pour toi");
  await expect(
    list.getByRole("link", { name: /Mon premier plan/ }),
  ).toContainText("Proposition à valider");
  await expect(list.getByRole("link")).toHaveCount(3);
  await expect(list.getByText("Conversation", { exact: true })).toHaveCount(0);
  await list.getByRole("link", { name: /Genou en descente/ }).click();
  await expect(page).toHaveURL(`/coach/${kneeThread}`, { timeout: 20_000 });

  const log = page.getByRole("log", { name: "Messages" });
  await expect(log.getByText("@Inès", { exact: true })).toHaveCount(2);
  expect(
    await log
      .locator("span", { hasText: /^@Inès$/ })
      .last()
      .evaluate((element) => getComputedStyle(element).color),
  ).toBe("rgb(213, 255, 63)");
  await expect(log).not.toContainText("Vérifie s’il peut courir");
  await expect(log).not.toContainText("Concertation");
  const question = log.getByRole("group", {
    name: "Comment réagit ton genou en descente ?",
  });
  await expect(question).toContainText("Question d’Inès");
  for (const option of [
    "Aucune gêne",
    "Gêne légère, qui passe",
    "Douleur qui m’oblige à ralentir",
    "Autre…",
  ])
    await expect(
      question.getByRole("button", { name: option, exact: true }),
    ).toBeEnabled();
  await expect(log.getByText("A lu")).toBeVisible();
  await expect(log.getByText("Signalements · 14 jours")).toBeVisible();

  const suivi = page.getByRole("complementary", {
    name: "Suivi de la conversation",
  });
  await expect(suivi.getByText("Question pour toi")).toBeVisible();
  await expect(suivi.getByText("Médecin · mentionnée")).toBeVisible();
  await expect(suivi.getByText("Signalements · 14 jours")).toBeVisible();
  await expect(suivi.locator('[aria-current="step"]')).toHaveText(
    /Question d’Inès/,
  );
  await page.screenshot({ path: "test-results/coach-desktop.png" });

  let posted: unknown = null;
  await page.route("**/api/coach/turns", async (route) => {
    posted = route.request().postDataJSON();
    await stream([
      {
        type: "session",
        sessionId: "sesn_01Genou",
        threadId: kneeThread,
        consoleUrl: "https://console.test",
      },
      item("answer", { toolUseId: "sevt_knee", text: "Aucune gêne" }),
      item("staff_message", {
        thread: "sthr_knee",
        agent: "medical",
        text: "@Jules Alors tu peux courir, en gardant les descentes faciles.",
      }),
      item("consult_reply", {
        thread: "sthr_knee",
        agent: "medical",
        text: "Limites pour le plan : descentes faciles jusqu’au 31/10.",
      }),
      item("consult_end", { thread: "sthr_knee", agent: "medical" }),
      item("coach", { text: "Parfait, on garde la sortie longue." }),
      { type: "done", status: "idle" },
    ])(route);
  });
  await question.getByRole("button", { name: "Aucune gêne" }).click();
  await expect(
    log.getByText("Parfait, on garde la sortie longue."),
  ).toBeVisible();
  await expect(log.getByText("En réponse à Inès")).toBeVisible();
  await expect(log.getByText("Alors tu peux courir")).toBeVisible();
  await expect(log).not.toContainText("Limites pour le plan");
  await expect(question).toContainText("Répondue");
  await expect(
    question.getByRole("button", { name: "Aucune gêne" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(suivi.locator('[aria-current="step"]')).toHaveCount(1);
  await expect(suivi.locator('[aria-current="step"]')).toContainText(
    "Dernière étape",
  );
  await expect(
    suivi.getByText("Ta réponse à Inès", { exact: true }),
  ).toBeVisible();
  expect(posted).toEqual({
    sessionId: "sesn_01Genou",
    mode: "conversation",
    input: { kind: "answer", toolUseId: "sevt_knee", text: "Aucune gêne" },
  });
});

test("a new conversation asks Inès and keeps the thread after the turn", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/coach/nouvelle");
  let posted: unknown = null;
  await page.route("**/api/coach/turns", async (route) => {
    posted = route.request().postDataJSON();
    await stream([
      {
        type: "session",
        sessionId: "sesn_01Nouveau",
        threadId: newThread,
        consoleUrl: "https://console.test",
      },
      item("athlete", { text: "Mon mollet est tendu", consult: "medical" }),
      item("coach", { text: "@Inès, tu peux regarder ton mollet ?" }),
      item("consult_request", {
        thread: "sthr_calf",
        agent: "medical",
        text: "Calf tightness, any risk?",
      }),
      item("read", {
        thread: "sthr_calf",
        agent: "medical",
        tool: "get_hrv_data",
        label: "Garmin · VFC",
      }),
      item("consult_reply", {
        thread: "sthr_calf",
        agent: "medical",
        text: "@Jules Risque faible, reste en facile.",
      }),
      item("consult_end", { thread: "sthr_calf", agent: "medical" }),
      item("coach", {
        text: "**Inès est rassurante** : on reste en facile.\n\n- footing\n- étirements",
      }),
      { type: "done", status: "idle" },
    ])(route);
  });
  const composer = page.getByRole("textbox", { name: "Écrire au staff" });
  await composer.fill("Mon mollet est tendu");
  await page.getByRole("button", { name: "Mentionner Inès" }).click();
  await page.getByRole("button", { name: "Envoyer" }).click();

  await expect(page).toHaveURL(`/coach/${newThread}`);
  const log = page.getByRole("log", { name: "Messages" });
  await expect(
    log.locator("strong", { hasText: "Inès est rassurante" }),
  ).toBeVisible();
  await expect(
    log.getByRole("listitem").filter({ hasText: "footing" }),
  ).toBeVisible();
  await expect(log).not.toContainText("**");
  await expect(log.getByText("Risque faible, reste en facile.")).toBeVisible();
  await expect(log.getByText("Garmin · VFC")).toBeVisible();
  await expect(log).not.toContainText("Calf tightness");
  expect(posted).toEqual({
    mode: "conversation",
    input: {
      kind: "message",
      text: "Mon mollet est tendu",
      consult: "medical",
    },
  });
  await expect(
    page
      .getByRole("region", { name: "Conversations" })
      .getByRole("link", { name: /Mon mollet est tendu/ }),
  ).toContainText(
    "Claire : Inès est rassurante : on reste en facile. footing étirements",
  );
  await expect(
    page.getByRole("heading", { name: "Mon mollet est tendu" }),
  ).toBeVisible();
});

test("a refused turn shows a French message and keeps the draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/coach/${planThread}`);
  await page.route("**/api/coach/turns", (route) =>
    route.fulfill({ status: 409, json: { code: "turn_in_progress" } }),
  );
  const composer = page.getByRole("textbox", { name: "Écrire au staff" });
  await composer.fill("Et la semaine prochaine ?");
  await composer.press("Enter");
  await expect(
    page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "Le staff travaille déjà sur ta demande." }),
  ).toBeVisible();
  await expect(composer).toHaveValue("Et la semaine prochaine ?");
});

test("suggested replies send from the keyboard and hide while the staff works", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/coach/${kneeThread}`);
  await expect(
    page.getByRole("log", { name: "Messages" }).getByText("Question d’Inès"),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Réponses suggérées" }),
  ).toHaveCount(0);

  await page.goto(`/coach/${planThread}`);
  const row = page.getByRole("group", { name: "Réponses suggérées" });
  const replies = row.getByRole("button");
  await expect(replies).toHaveText([
    "Pourquoi ce changement ?",
    "Quel impact sur ma semaine ?",
    "Propose une autre option",
  ]);
  const replyStyle = await replies.first().evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.minHeight, style.fontSize];
  });
  expect(replyStyle).toEqual(["32px", "13px"]);
  await page.screenshot({ path: "test-results/coach-replies-desktop.png" });

  let posted: unknown = null;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/coach/turns", async (route) => {
    posted = route.request().postDataJSON();
    await gate;
    await stream([
      item("athlete", {
        text: "Propose une autre option",
        consult: null,
        attachments: [],
      }),
      item("coach", { text: "Je te prépare une variante plus douce." }),
      { type: "done", status: "idle" },
    ])(route);
  });
  const composer = page.getByRole("textbox", { name: "Écrire au staff" });
  await composer.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  const other = row.getByRole("button", { name: "Propose une autre option" });
  await expect(other).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Claire réfléchit…" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Envoyer" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Arrêter le staff" }),
  ).toHaveCount(0);
  await expect(row).toHaveCount(0);
  await expect(composer).toHaveValue("");
  expect(posted).toEqual({
    sessionId: expect.any(String),
    mode: "plan",
    input: { kind: "message", text: "Propose une autre option" },
  });
  release();
  await expect(
    page
      .getByRole("log", { name: "Messages" })
      .getByText("Je te prépare une variante plus douce."),
  ).toBeVisible();
  await expect(row).toBeVisible();
});

test("suggested replies scroll at 390 and restore a failed reply", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`/coach/${planThread}`);
  const row = page.getByRole("group", { name: "Réponses suggérées" });
  const first = row.getByRole("button").first();
  await expect(first).toBeVisible();
  const reply = await first.evaluate((element) => {
    const style = getComputedStyle(element);
    return [
      element.getBoundingClientRect().height,
      style.borderTopLeftRadius,
      style.transitionProperty,
    ];
  });
  expect(reply[0]).toBeGreaterThanOrEqual(44);
  expect(reply[1]).not.toBe("8px");
  expect(reply[2]).toBe("none");
  const scroll = await row.evaluate((element) => ({
    overflow: element.scrollWidth > element.clientWidth,
    left: Math.round(element.getBoundingClientRect().left),
    right: Math.round(element.getBoundingClientRect().right),
  }));
  expect(scroll).toEqual({ overflow: true, left: 0, right: 390 });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/coach-replies-mobile.png" });

  await page.route("**/api/coach/turns", (route) =>
    route.fulfill({ status: 409, json: { code: "turn_in_progress" } }),
  );
  await row.getByRole("button", { name: "Pourquoi ce changement ?" }).click();
  await expect(
    page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "Le staff travaille déjà sur ta demande." }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Écrire au staff" }),
  ).toHaveValue("Pourquoi ce changement ?");
  await expect(row).toBeVisible();
});

test("context chips are picked with the keyboard, survive a failed send and reach the staff", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/coach/nouvelle");
  const trigger = page.getByRole("button", { name: addContext });
  await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  await trigger.click();
  const picker = page.getByRole("dialog", { name: "Ajouter du contexte" });
  await expect(picker).toBeVisible();
  await expect
    .poll(async () => {
      const box = await picker.boundingBox();
      return box && [Math.round(box.x + box.width), Math.round(box.width)];
    })
    .toEqual([1440, 440]);
  const tabs = picker.getByRole("tablist", { name: "Type de contexte" });
  const sessions = tabs.getByRole("tab", { name: "Séances" });
  await sessions.click();
  await expect(sessions).toHaveAttribute("aria-selected", "true");
  await expect(sessions).toBeFocused();
  await expect(
    picker.getByText(
      "Aucune séance prévue autour d’aujourd’hui dans ton plan actif.",
    ),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "Activités" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("ArrowRight");
  const races = tabs.getByRole("tab", { name: "Courses" });
  await expect(races).toHaveAttribute("aria-selected", "true");
  await expect(races).toBeFocused();
  const race = picker.getByRole("button", { name: /Trail des Lacs/ });
  await expect(race).toContainText("50 km · 2 400 m D+");
  await page.keyboard.press("Tab");
  if (!(await race.evaluate((element) => element === document.activeElement)))
    await page.keyboard.press("Tab");
  await expect(race).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(race).toHaveAttribute("aria-pressed", "true");
  await expect(picker.getByRole("status")).toHaveText("1 élément joint sur 3");
  await page.keyboard.press("Escape");
  await expect(picker).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await picker.getByRole("tab", { name: "Activités" }).click();
  const activity = picker.getByRole("button", {
    name: /Sortie longue vallonnée/,
  });
  await expect(activity).toContainText("24,6 km · 680 m D+");
  await activity.click();
  await activity.click();
  await expect(activity).toHaveAttribute("aria-pressed", "false");
  await activity.click();
  await expect(picker.getByRole("status")).toHaveText(
    "2 éléments joints sur 3",
  );
  const others = picker.locator('button[aria-pressed="false"]');
  await others.first().click();
  await expect(picker.getByRole("status")).toHaveText("3 éléments au plus");
  await expect(others.first()).toBeDisabled();
  await picker.getByRole("button", { name: "Terminé" }).click();
  await expect(picker).toBeHidden();

  const chips = page.getByRole("list", { name: "Contexte joint au message" });
  await expect(chips.getByRole("listitem")).toHaveCount(3);
  const extra = chips.getByRole("listitem").nth(2);
  const extraTitle = (await extra.innerText()).split("\n")[0];
  await extra.getByRole("button", { name: /^Retirer / }).click();
  const composer = page.getByRole("textbox", { name: "Écrire au staff" });
  await expect(composer).toBeFocused();
  await expect(chips.getByRole("listitem")).toHaveCount(2);
  await expect(chips).not.toContainText(extraTitle);

  await page.route("**/api/coach/turns", (route) =>
    route.fulfill({ status: 500, json: { code: "failed" } }),
  );
  await composer.fill("Analyse ça");
  await composer.press("Enter");
  await expect(
    page.locator("[data-sonner-toast]").filter({
      hasText: "Le message n’a pas pu être envoyé.",
    }),
  ).toBeVisible();
  await expect(composer).toHaveValue("Analyse ça");
  await expect(chips.getByRole("listitem")).toHaveCount(2);

  await page.unroute("**/api/coach/turns");
  const attachments = [
    { kind: "race", id: coachRace },
    { kind: "activity", id: coachActivity },
  ];
  let posted: unknown = null;
  await page.route("**/api/coach/turns", async (route) => {
    posted = route.request().postDataJSON();
    await stream([
      {
        type: "session",
        sessionId: "sesn_01Contexte",
        threadId: newThread,
        consoleUrl: "https://console.test",
      },
      item("athlete", {
        text: "Analyse ça",
        consult: null,
        attachments: [
          {
            ...attachments[0],
            title: "Trail des Lacs",
            date: "2027-06-27",
          },
          {
            ...attachments[1],
            title: "Sortie longue vallonnée",
            date: "2026-10-04",
          },
        ],
      }),
      item("coach", { text: "Je regarde ta sortie." }),
      { type: "done", status: "idle" },
    ])(route);
  });
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(chips).toBeHidden();
  expect(posted).toEqual({
    mode: "conversation",
    input: { kind: "message", text: "Analyse ça", attachments },
  });
  const sent = page
    .getByRole("log", { name: "Messages" })
    .getByRole("list", { name: "Contexte joint" });
  await expect(
    sent.getByRole("link", { name: /Trail des Lacs/ }),
  ).toHaveAttribute("href", `/races/${coachRace}`);
  await expect(
    sent.getByRole("link", { name: /Sortie longue vallonnée/ }),
  ).toHaveAttribute("href", `/activities/${coachActivity}`);
  await expect(sent).toContainText("27/06/2027");
});

test("a stored message keeps its chips and answer mode hides the context control", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/coach/${kneeThread}`);
  const sent = page
    .getByRole("log", { name: "Messages" })
    .getByRole("list", { name: "Contexte joint" });
  await expect(
    sent.getByRole("link", { name: /Sortie longue vallonnée/ }),
  ).toHaveAttribute("href", `/activities/${coachActivity}`);
  await expect(
    page.getByRole("textbox", { name: "Ta réponse au staff" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: addContext })).toHaveCount(0);
});

test("mobile picks context from a bottom sheet at 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/coach/nouvelle");
  const trigger = page.getByRole("button", { name: addContext });
  const triggerBox = await trigger.boundingBox();
  expect(Math.round(triggerBox!.height)).toBeGreaterThanOrEqual(44);
  await trigger.focus();
  await page.keyboard.press("Enter");
  const picker = page.getByRole("dialog", { name: "Ajouter du contexte" });
  await expect(picker).toBeVisible();
  await expect
    .poll(async () => {
      const box = await picker.boundingBox();
      return box && [Math.round(box.width), Math.round(box.y + box.height)];
    })
    .toEqual([390, 844]);
  await picker.getByRole("tab", { name: "Courses" }).click();
  await picker.getByRole("button", { name: /Trail des Lacs/ }).click();
  await picker.getByRole("button", { name: "Terminé" }).click();
  const chips = page.getByRole("list", { name: "Contexte joint au message" });
  const remove = chips.getByRole("button", {
    name: "Retirer Trail des Lacs du contexte",
  });
  const removeBox = await remove.boundingBox();
  expect(Math.round(removeBox!.height)).toBe(44);
  expect(Math.round(removeBox!.width)).toBe(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await remove.click();
  await expect(chips).toBeHidden();
  await expect(
    page.getByRole("textbox", { name: "Écrire au staff" }),
  ).toBeFocused();
});

test("a new-plan proposal opens the review sheet and activates without an active plan", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/coach/${planThread}`);
  const card = page.getByRole("log", { name: "Messages" });
  await expect(card.getByText("Proposition · Nouveau plan")).toBeVisible();
  await expect(card.getByText("À toi de décider")).toBeVisible();
  await card.getByRole("link", { name: "Examiner" }).click();
  await expect(page).toHaveURL(new RegExp(`proposition=${newPlanProposal}`), {
    timeout: 20_000,
  });
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Premier plan")).toBeVisible();
  await sheet.getByRole("button", { name: "Activer ce plan" }).click();
  await expect(
    sheet.getByText("Appliquée · ton nouveau plan est actif"),
  ).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(`/coach/${planThread}`);
  await page.reload();
  await expect(
    page.getByRole("log", { name: "Messages" }).getByText("Appliquée"),
  ).toBeVisible();
});

test("a reload keeps the list and the thread", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/coach/${kneeThread}`);
  const log = page.getByRole("log", { name: "Messages" });
  const before = (await log.textContent()) ?? "";
  const list =
    (await page.getByRole("region", { name: "Conversations" }).textContent()) ??
    "";
  await page.reload();
  await expect(log).toHaveText(before);
  await expect(page.getByRole("region", { name: "Conversations" })).toHaveText(
    list,
  );
  await expect(
    log.getByRole("button", { name: "Aucune gêne", exact: true }),
  ).toBeEnabled();
});

test("another athlete's thread is not found", async ({ page }) => {
  await signIn(page, "plan-review@example.com");
  await page.goto(`/coach/${kneeThread}`);
  await expectNotFound(page);
});

test("an untitled empty legacy session is never shown", async ({ page }) => {
  await signIn(page);
  await page.goto(`/coach/${spikeThread}`);
  await expectNotFound(page);
});

test("the Plan empty state asks the Coach for a plan", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/plan");
  await page.getByRole("link", { name: "Demander un plan" }).click();
  await expect(page).toHaveURL("/coach/nouvelle?demande=plan");
  await expect(
    page.getByRole("heading", { name: "Demande ton plan à Claire" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Écrire au staff" }),
  ).toHaveValue("Construis-moi un plan d’entraînement pour mon objectif.");
});

test("a prefilled request starts the composer with its text", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(
    `/coach/nouvelle?texte=${encodeURIComponent("Ma fatigue dépasse ma condition. Peux-tu alléger ma semaine ?")}`,
  );
  await expect(
    page.getByRole("textbox", { name: "Écrire au staff" }),
  ).toHaveValue(
    "Ma fatigue dépasse ma condition. Peux-tu alléger ma semaine ?",
  );
  await page.goto(`/coach/nouvelle?texte=${"a".repeat(600)}`);
  await expect(
    page.getByRole("textbox", { name: "Écrire au staff" }),
  ).toHaveValue("a".repeat(500));
});

test("mobile shows the list, the thread and the Suivi sheet at 390", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/coach");
  await expect(
    page.getByRole("heading", { name: "Coach", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("log")).toBeHidden();
  const portraitWidth = await page
    .getByRole("region", { name: "Ton staff" })
    .getByRole("link", { name: "Claire, coach, voir l’équipe" })
    .locator("img")
    .evaluate((image: HTMLImageElement) => image.naturalWidth);
  expect(portraitWidth).toBeGreaterThanOrEqual(Math.ceil(56 * 1.8));
  await page.screenshot({ path: "test-results/coach-mobile-list.png" });
  await page
    .getByRole("region", { name: "Conversations" })
    .getByRole("link", { name: /Genou en descente/ })
    .click();
  await expect(page).toHaveURL(`/coach/${kneeThread}`, { timeout: 20_000 });
  await expect(
    page.getByRole("region", { name: "Conversations" }),
  ).toBeHidden();
  await expect(
    page.getByRole("link", { name: "Retour aux conversations" }),
  ).toBeVisible();
  const log = page.getByRole("log", { name: "Messages" });
  await expect(log.getByText("Question d’Inès")).toBeVisible();
  await expect(
    log.getByRole("button", { name: "Aucune gêne", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/coach-mobile.png" });
  await page.getByRole("button", { name: "Suivi de la conversation" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Participants")).toBeVisible();
  await expect(sheet.getByText("Médecin · mentionnée")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await page.goto(`/coach/${planThread}`);
  const card = page.getByRole("log", { name: "Messages" });
  await expect(card.getByText("Proposition · Nouveau plan")).toBeVisible();
  await expect(
    card.getByRole("link", { name: /^(Examiner|Voir la proposition)$/ }),
  ).toBeVisible();
  const cardWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(cardWidth).toBeLessThanOrEqual(390);
});

test("mobile tab bar reaches the main screens and hides in a conversation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/coach");
  const tabs = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(tabs).toBeVisible();
  const coach = tabs.getByRole("link", { name: /^Coach, .+ en attente$/ });
  await expect(coach).toHaveAttribute("aria-current", "page");
  await expect(coach.locator('[data-kind="count"]')).toHaveText(/^\d+$/);
  const box = await tabs.boundingBox();
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
  const covered = await tabs.evaluate((nav) => {
    const previous = nav.previousElementSibling;
    if (!previous) return true;
    const bottom = Math.max(
      ...[...previous.children].map(
        (child) => child.getBoundingClientRect().bottom,
      ),
    );
    return bottom > nav.getBoundingClientRect().top + 1;
  });
  expect(covered).toBe(false);

  await tabs.getByRole("link", { name: "Aujourd’hui" }).focus();
  await page.keyboard.press("Tab");
  const plan = tabs.getByRole("link", { name: "Plan" });
  await expect(plan).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/plan/, { timeout: 20_000 });
  await expect(plan).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: /^Coach/ })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.goto(`/coach/${kneeThread}`);
  await expect(page.getByRole("log", { name: "Messages" })).toBeVisible();
  await expect(tabs).toHaveCount(0);

  await page.goto("/coach/equipe");
  await expect(tabs.getByRole("link", { name: /^Coach/ })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(tabs).toBeHidden();
});

test("reduced motion stops the live indicators", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/coach/${kneeThread}`);
  const animated = await page.evaluate(
    () =>
      [...document.querySelectorAll("main, [role=log], aside, body *")].filter(
        (element) => getComputedStyle(element).animationName !== "none",
      ).length,
  );
  expect(animated).toBe(0);
});

test("deleting a conversation asks for confirmation and refreshes the badge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/coach/${kneeThread}`);
  await page.getByRole("button", { name: "Plus d’options" }).click();
  await page
    .getByRole("menuitem", { name: "Supprimer la conversation" })
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Supprimer la conversation ?");
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(page).toHaveURL(`/coach/${kneeThread}`);

  await page.getByRole("button", { name: "Plus d’options" }).click();
  await page
    .getByRole("menuitem", { name: "Supprimer la conversation" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Supprimer" })
    .click();
  await expect(page).toHaveURL("/coach", { timeout: 20_000 });
  await expect(
    page
      .getByRole("region", { name: "Conversations" })
      .getByRole("link", { name: /Genou en descente/ }),
  ).toHaveCount(0);
  const coachLink = page.getByRole("link", { name: "Coach", exact: true });
  await expect(
    page.locator("li", { has: coachLink }).first(),
  ).not.toContainText("en attente");
  await page.goto(`/coach/${kneeThread}`);
  await expectNotFound(page);
});

test("the thread menu offers deletion on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`/coach/${planThread}`);
  await page.getByRole("button", { name: "Plus d’options" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Supprimer la conversation" }),
  ).toBeVisible();
});

test("portraits load the full source file", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await signIn(page);
  await page.goto("/coach");
  const portrait = page
    .getByRole("region", { name: "Ton staff" })
    .getByRole("link", { name: "Claire, coach, voir l’équipe" })
    .locator("img");
  await expect(portrait).toBeVisible();
  const { width, source } = await portrait.evaluate(
    (image: HTMLImageElement) => ({
      width: image.naturalWidth,
      source: image.currentSrc,
    }),
  );
  expect(new URL(source).pathname).toMatch(
    /^\/_next\/static\/media\/claire\..+\.webp$/,
  );
  expect(width).toBe(768);
  await context.close();
});

test("the team page shows the whole staff and changes faces everywhere", async ({
  page,
}) => {
  await resetCoach();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto("/coach");
  const coachLink = page.getByRole("link", { name: "Coach", exact: true });
  const coachItem = page.locator("li", { has: coachLink }).first();
  await coachItem.getByRole("link", { name: "L’équipe" }).click();
  await expect(page).toHaveURL("/coach/equipe", { timeout: 20_000 });
  await expect(
    coachItem.getByRole("link", { name: "L’équipe" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Une équipe autour de toi, dans une seule conversation.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Ton staff · 5 agents IA")).toBeVisible();
  const coach = page.getByRole("region", { name: "Claire" });
  await expect(coach).toContainText("Ta première interlocutrice.");
  await expect(coach).toContainText("2 conversations ce mois");
  const specialists = page.getByRole("region", { name: "Les spécialistes" });
  await expect(specialists.getByRole("article")).toHaveCount(4);
  const medical = specialists.getByRole("article", { name: "Inès" });
  await expect(medical).toContainText("1 avis ce mois");
  for (const name of ["Marc", "Hugo", "Léa"])
    await expect(
      specialists.getByRole("article", { name, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Comment le staff travaille" }),
  ).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(1440);
  await page.screenshot({
    path: "test-results/coach-team.png",
    fullPage: true,
  });

  const coachFaces = page.getByRole("group", { name: "Visage de coach" });
  await expect(
    coachFaces.getByRole("button", { name: "Claire" }),
  ).toHaveAttribute("aria-pressed", "true");
  await coachFaces.getByRole("button", { name: "Thomas" }).click();
  await page
    .getByRole("group", { name: "Visage de médecin" })
    .getByRole("button", { name: "Karim" })
    .click();
  await expect(page.getByRole("region", { name: "Thomas" })).toContainText(
    "Ton premier interlocuteur. Il construit",
  );
  await expect(
    specialists.getByRole("article", { name: "Karim" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("group", { name: "Visage de coach" })
      .getByRole("button", { name: "Thomas" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("link", { name: "Écrire à Thomas" }),
  ).toBeVisible();

  await page.goto(`/coach/${kneeThread}`);
  await expect(page.getByText("Thomas, avec Karim")).toBeVisible();
  await expect(
    page.getByRole("log", { name: "Messages" }).getByText("Question de Karim"),
  ).toBeVisible();
  await expect(page.locator('img[src*="karim"]').first()).toBeAttached();

  await page.goto("/coach/equipe");
  await page
    .getByRole("group", { name: "Visage de coach" })
    .getByRole("button", { name: "Claire" })
    .click();
  await page
    .getByRole("group", { name: "Visage de médecin" })
    .getByRole("button", { name: "Inès" })
    .click();
  await expect(page.getByRole("region", { name: "Claire" })).toBeVisible();
  await expect(
    specialists.getByRole("article", { name: "Inès" }),
  ).toBeVisible();
});

test("mobile reaches the team page from the conversations list at 390", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/coach");
  await page.getByRole("link", { name: "Voir l’équipe", exact: true }).click();
  await expect(page).toHaveURL("/coach/equipe", { timeout: 20_000 });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Une équipe autour de toi, une seule conversation.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Rien ne change sans ton accord")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Comment le staff travaille" }),
  ).toBeHidden();
  await expect(
    page.getByRole("group", { name: "Visage de médecin" }),
  ).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/coach-team-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Retour aux conversations" }).click();
  await expect(page).toHaveURL("/coach", { timeout: 20_000 });
});

test("a refresh during a turn keeps the staff working and shows its result", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto(`/coach/${planThread}`);
  await page.route("**/api/coach/turns", () => new Promise<void>(() => {}));
  const request = "Prolonge mon plan jusqu’à l’EcoTrail 120K.";
  const composer = page.getByRole("textbox", { name: "Écrire au staff" });
  await composer.fill(request);
  await composer.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Claire réfléchit…" }),
  ).toBeVisible();

  await coachTurn({
    session: {
      status: "running",
      last_turn_at: at(),
      composing_since: new Date(Date.now() - 3 * 60_000 - 5_000).toISOString(),
    },
    items: [
      {
        kind: "athlete",
        body: { text: request, consult: null, attachments: [] },
      },
    ],
  });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.reload();

  const log = page.getByRole("log", { name: "Messages" });
  await expect(log.getByText(request)).toBeVisible();
  const working = page
    .getByRole("status")
    .filter({ hasText: "Claire rédige sa réponse…" });
  await expect(working).toContainText("depuis 3 min");
  await expect(working).toContainText(
    "Tu peux quitter la page : le staff continue et sa réponse t’attendra ici.",
  );
  await expect(page.getByRole("button", { name: "Envoyer" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Arrêter le staff" }),
  ).toHaveCount(0);

  await coachTurn({
    session: { status: "idle", composing_since: null },
    items: [
      {
        kind: "coach",
        body: { text: "J’ai ajouté les semaines jusqu’à l’EcoTrail 120K." },
      },
    ],
  });
  await expect(
    log.getByText("J’ai ajouté les semaines jusqu’à l’EcoTrail 120K."),
  ).toBeVisible({ timeout: 15_000 });
  await expect(working).toHaveCount(0);
  await composer.fill("Merci");
  await expect(page.getByRole("button", { name: "Envoyer" })).toBeEnabled();
  await resetCoach();
});
