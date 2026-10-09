import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  buildInsightFacts,
  joinDays,
  shareLabel,
  type InsightActivity,
  type InsightFact,
  type InsightObservation,
} from "../../src/features/insights/facts";
import {
  acceptPhrasing,
  aiCooldownMs,
  phraseHistoryInsights,
  resetHistoryInsightsCache,
} from "../../src/server/ai/skills/history-insights";
import { completeJson } from "../../src/server/ai/provider";

const today = new Date("2026-10-10T12:00:00Z");
function activity(
  daysAgo: number,
  overrides: Partial<InsightActivity> = {},
): InsightActivity {
  const started = new Date(today.getTime() - daysAgo * 86_400_000);
  return {
    startedAt: started.toISOString(),
    localStartedAt: started.toISOString().slice(0, 19),
    type: "running",
    distanceMeters: 10_000,
    durationSeconds: 3_600,
    elevationGainMeters: 50,
    ...overrides,
  };
}
function weeklyRuns(weeks: number, extra: Partial<InsightActivity> = {}) {
  return Array.from({ length: weeks * 2 }, (_, index) =>
    activity(Math.floor(index / 2) * 7 + (index % 2) * 2 + 1, extra),
  );
}
function observations(metric: string, values: number[]): InsightObservation[] {
  return values.map((value, index) => ({
    metric,
    observedOn: `2026-10-${String(index + 1).padStart(2, "0")}`,
    value,
  }));
}
const facts = (input: Partial<Parameters<typeof buildInsightFacts>[0]>) =>
  buildInsightFacts({
    activities: [],
    longest: null,
    observations: [],
    today,
    ...input,
  });
const byKey = (items: InsightFact[], key: InsightFact["key"]) =>
  items.find((fact) => fact.key === key);

describe("insight facts", () => {
  it("returns nothing without enough history", () => {
    expect(facts({ activities: weeklyRuns(2) })).toEqual([]);
  });
  it("computes weekly volume and usual days over twelve months", () => {
    const volume = byKey(facts({ activities: weeklyRuns(52) }), "volume");
    expect(volume?.sentence).toMatch(
      /^Tu t’entraînes environ 2 heures par semaine, surtout /,
    );
    expect(volume?.source).toBe("Activités · 12 derniers mois");
  });
  it("labels shorter histories with their real start", () => {
    const volume = byKey(facts({ activities: weeklyRuns(10) }), "volume");
    expect(volume?.source).toBe("Activités · depuis août 2026");
  });
  it("describes the running surface mix and strength frequency in words", () => {
    const runs = weeklyRuns(20);
    const trail = weeklyRuns(20, { type: "trail_running" });
    const strength = weeklyRuns(20, { type: "strength_training" });
    expect(
      byKey(facts({ activities: [...runs, ...trail] }), "mix")?.sentence,
    ).toBe("Le trail fait la moitié de ta course à pied.");
    expect(
      byKey(facts({ activities: [...runs, ...strength] }), "mix")?.sentence,
    ).toBe(
      "La route fait l’essentiel de ta course à pied, avec environ 2 séances de renfo par semaine.",
    );
  });
  it("reports the longest run with elevation only when meaningful", () => {
    expect(
      byKey(
        facts({
          longest: activity(30, {
            distanceMeters: 62_961,
            elevationGainMeters: 1_057,
          }),
        }),
        "longest",
      )?.sentence,
    ).toBe("Sortie la plus longue : 63 km en septembre 2026, 1 057 m D+.");
    expect(
      byKey(
        facts({ longest: activity(30, { distanceMeters: 21_100 }) }),
        "longest",
      )?.sentence,
    ).toBe("Sortie la plus longue : 21,1 km en septembre 2026.");
    expect(
      byKey(
        facts({ longest: activity(30, { distanceMeters: 3_000 }) }),
        "longest",
      ),
    ).toBeUndefined();
  });
  it("summarizes recovery ranges only from enough nights", () => {
    const recovery = byKey(
      facts({
        observations: [
          ...observations(
            "hrv_last_night_ms",
            [60, 62, 64, 66, 68, 70, 72, 74],
          ),
          ...observations("sleep_duration_seconds", Array(8).fill(27_900)),
          ...observations("resting_heart_rate_bpm", [45, 46]),
        ],
      }),
      "recovery",
    );
    expect(recovery?.sentence).toBe(
      "VFC nocturne entre 60 et 74 ms, 7 h 45 de sommeil en moyenne.",
    );
    expect(recovery?.sentence).not.toContain("FC au repos");
  });
  it("formats shares and days in natural French", () => {
    expect(shareLabel(0.66)).toBe("deux tiers");
    expect(shareLabel(0.95)).toBe("presque toute");
    expect(joinDays([2, 3, 6, 0])).toBe("le mardi, le mercredi et le week-end");
    expect(joinDays([4])).toBe("le jeudi");
  });
  it("never produces percentages", () => {
    const all = facts({
      activities: [
        ...weeklyRuns(52),
        ...weeklyRuns(52, { type: "trail_running" }),
      ],
      longest: activity(10, { distanceMeters: 42_195 }),
    });
    for (const fact of all) expect(fact.sentence).not.toContain("%");
  });
});

const sample: InsightFact[] = [
  {
    key: "volume",
    source: "Activités · 12 derniers mois",
    sentence: "Tu t’entraînes environ 5 heures par semaine.",
    values: { heures: "5" },
  },
  {
    key: "longest",
    source: "Courses",
    sentence: "Sortie la plus longue : 63 km en septembre 2026, 1 057 m D+.",
    values: { km: "63" },
  },
];

describe("AI phrasing validation", () => {
  it("accepts rephrasings that keep the same numbers", () => {
    const accepted = acceptPhrasing(
      sample,
      JSON.stringify({
        items: [
          {
            key: "volume",
            text: "Environ 5 heures d’entraînement chaque semaine.",
          },
          {
            key: "longest",
            text: "Ton record : 63 km et 1057 m D+ en septembre 2026.",
          },
        ],
      }),
    );
    expect([...accepted.keys()]).toEqual(["volume", "longest"]);
  });
  it.each([
    [
      "an invented number",
      { key: "volume", text: "Environ 6 heures par semaine, sur 4 jours." },
    ],
    [
      "a percentage",
      { key: "volume", text: "Environ 5 heures, soit 80 % de course." },
    ],
    ["an unknown key", { key: "zones", text: "Tu cours souvent en zone 2." }],
  ])("rejects %s", (_, item) => {
    expect(acceptPhrasing(sample, JSON.stringify({ items: [item] })).size).toBe(
      0,
    );
  });
  it("rejects malformed output", () => {
    expect(acceptPhrasing(sample, "not json").size).toBe(0);
    expect(acceptPhrasing(sample, JSON.stringify({ text: "x" })).size).toBe(0);
  });
});

describe("history insights skill", () => {
  beforeEach(() => {
    resetHistoryInsightsCache();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });
  const reply = (items: { key: string; text: string }[]) =>
    vi.fn(async () => ({
      ok: true as const,
      content: JSON.stringify({ items }),
      usage: { promptTokens: 300, completionTokens: 150 },
    }));
  it("uses deterministic sentences without calling the model while importing", async () => {
    const complete = reply([]);
    const items = await phraseHistoryInsights({
      athlete: "a",
      facts: sample,
      allowAi: false,
      complete,
    });
    expect(complete).not.toHaveBeenCalled();
    expect(items.map((item) => item.origin)).toEqual(["facts", "facts"]);
  });
  it("calls once, mixes accepted AI text with fallbacks and caches the result", async () => {
    const complete = reply([
      {
        key: "volume",
        text: "Environ 5 heures d’entraînement chaque semaine.",
      },
      { key: "longest", text: "Une sortie de 70 km cette année." },
    ]);
    const first = await phraseHistoryInsights({
      athlete: "a",
      facts: sample,
      allowAi: true,
      complete,
    });
    expect(first.map((item) => [item.key, item.origin])).toEqual([
      ["volume", "ai"],
      ["longest", "facts"],
    ]);
    const second = await phraseHistoryInsights({
      athlete: "a",
      facts: sample,
      allowAi: true,
      complete,
    });
    expect(second).toBe(first);
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it("sends only the aggregated facts, without athlete identity", async () => {
    const complete = reply([]);
    await phraseHistoryInsights({
      athlete: "53d17ee9-4940-4be0-8bbe-6c35703a963d",
      facts: sample,
      allowAi: true,
      complete,
    });
    const [request] = complete.mock.calls[0] as unknown as [
      { user: string; system: string; maxTokens: number },
    ];
    expect(request.user).not.toContain("53d17ee9");
    expect(JSON.parse(request.user)).toEqual({
      constats: sample.map((fact) => ({
        key: fact.key,
        constat: fact.sentence,
      })),
    });
    expect(request.maxTokens).toBeLessThanOrEqual(400);
  });
  it("limits model calls per athlete and falls back when the provider fails", async () => {
    const failing = vi.fn(async () => ({
      ok: false as const,
      reason: "failed" as const,
    }));
    const now = 1_000_000;
    const items = await phraseHistoryInsights({
      athlete: "a",
      facts: sample,
      allowAi: true,
      complete: failing,
      now,
    });
    expect(items.every((item) => item.origin === "facts")).toBe(true);
    await phraseHistoryInsights({
      athlete: "a",
      facts: sample,
      allowAi: true,
      complete: failing,
      now: now + aiCooldownMs - 1,
    });
    expect(failing).toHaveBeenCalledTimes(1);
    await phraseHistoryInsights({
      athlete: "a",
      facts: sample,
      allowAi: true,
      complete: failing,
      now: now + aiCooldownMs,
    });
    expect(failing).toHaveBeenCalledTimes(2);
  });
});

describe("AI provider", () => {
  beforeEach(() => vi.unstubAllEnvs());
  it("does nothing without a server key", async () => {
    vi.stubEnv("OPENCODE_API_KEY", "");
    const send = vi.fn();
    expect(
      await completeJson({ system: "s", user: "u", maxTokens: 10, send }),
    ).toEqual({ ok: false, reason: "unconfigured" });
    expect(send).not.toHaveBeenCalled();
  });
  it("requests JSON without reasoning tokens and a random session", async () => {
    vi.stubEnv("OPENCODE_API_KEY", "test-key");
    const send = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"items":[]}' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        ),
    );
    expect(
      await completeJson({ system: "s", user: "u", maxTokens: 50, send }),
    ).toEqual({
      ok: true,
      content: '{"items":[]}',
      usage: { promptTokens: 10, completionTokens: 5 },
    });
    const [, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: "deepseek-v4.1-flash",
      max_tokens: 50,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
    });
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["x-opencode-session"]).toMatch(/^[0-9a-f-]{36}$/);
  });
  it.each([
    [new Response("nope", { status: 429 })],
    [new Response(JSON.stringify({ choices: [] }))],
  ])("reports provider failures without throwing", async (response) => {
    vi.stubEnv("OPENCODE_API_KEY", "test-key");
    expect(
      await completeJson({
        system: "s",
        user: "u",
        maxTokens: 10,
        send: async () => response,
      }),
    ).toEqual({ ok: false, reason: "failed" });
  });
});
