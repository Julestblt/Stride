import { describe, expect, it } from "vitest";
import {
  buildSessionPanel,
  paceByMinute,
  type SessionPanelInput,
} from "@/features/plans/view/session-panel";
import { planState } from "./plan-fixture";

function input(overrides: Partial<SessionPanelInput> = {}): SessionPanelInput {
  return {
    state: planState(),
    today: "2026-10-22",
    sessionKey: "s-2026-10-22-1",
    matches: [],
    proposals: [],
    activity: null,
    laps: [],
    series: null,
    ...overrides,
  };
}

describe("session panel", () => {
  it("places the session in its week with neighbours", () => {
    const panel = buildSessionPanel(input())!;
    expect(panel).toMatchObject({
      heading: "jeu. 22 oct. · S2",
      position: { index: 2, count: 3 },
      previousKey: "s-2026-10-20-1",
      nextKey: "s-2026-10-25-1",
      family: "threshold",
      status: "today",
      title: "Seuil · 4 × 6'",
      completion: null,
    });
    expect(panel.stats.map((stat) => [stat.label, stat.value])).toEqual([
      ["Durée", "50 min"],
      ["Au seuil", "24 min"],
      ["Allure /km", "4:30–4:40"],
      ["Terrain", "Route"],
    ]);
    expect(panel.steps.map((step) => step.name)).toEqual([
      "Échauffement",
      "4 × seuil",
      "Récupération × 4",
      "Retour au calme",
    ]);
    expect(panel.contingencies).toHaveLength(1);
  });

  it("shows expected paces and estimates distance from their midpoints", () => {
    const panel = buildSessionPanel(
      input({
        paceRanges: {
          easy: { fastSecondsPerKm: 300, slowSecondsPerKm: 330 },
          recovery: { fastSecondsPerKm: 340, slowSecondsPerKm: 370 },
        },
      }),
    )!;
    expect(panel.steps.map((step) => [step.target, step.pace])).toEqual([
      ["Effort 2–3/10", "≈ 5:00–5:30/km"],
      ["4:30–4:40/km", null],
      ["Effort 2–3/10", "≈ 5:40–6:10/km"],
      ["Libre", "≈ 5:00–5:30/km"],
    ]);
    expect(panel.stats.find((stat) => stat.key === "distance")?.value).toBe(
      "≈ 11,0 km",
    );
  });

  it("returns null for an unknown session", () => {
    expect(buildSessionPanel(input({ sessionKey: "s-unknown" }))).toBeNull();
  });

  it("shows a ready proposal targeting the session", () => {
    const panel = buildSessionPanel(
      input({
        proposals: [
          {
            title: "Raccourcir la séance",
            summary: "4 × 6’ au lieu de 5 × 6’, même allure.",
            targetKeys: ["session:s-2026-10-22-1"],
            createdAt: "2026-10-22T05:30:00Z",
          },
        ],
      }),
    )!;
    expect(panel.proposal).toEqual({
      when: "ce matin",
      text: "4 × 6’ au lieu de 5 × 6’, même allure.",
    });
  });

  it("compares planned and completed values from the matched activity", () => {
    const panel = buildSessionPanel(
      input({
        sessionKey: "s-2026-10-20-1",
        matches: [
          {
            sessionKey: "s-2026-10-20-1",
            activityId: "activity-1",
            status: "completed",
            compliance: { duration: 0.98, distance: null },
          },
        ],
        activity: {
          id: "activity-1",
          startedAt: "2026-10-20T17:12:00Z",
          date: "2026-10-20",
          localTime: "19:12",
          durationSeconds: 3012,
          distanceMeters: 8320,
          averageHeartRate: 142,
          detailImportedAt: "2026-10-20T18:05:12Z",
        },
      }),
    )!;
    expect(panel.status).toBe("done");
    expect(panel.completion).toMatchObject({
      activityId: "activity-1",
      pct: 98,
      headline: "Fait · 98 % conforme",
      detail: "mar. 20 oct. · 19:12 · importé de Garmin 3 min après l’arrêt",
    });
    expect(
      panel.completion!.rows.map((row) => [
        row.label,
        row.planned,
        row.actual,
        row.tone,
      ]),
    ).toEqual([
      ["Durée", "50’", "50:12", "success"],
      ["Distance", "–", "8,32 km", "muted"],
      ["Allure", "–", "6:02 /km", "muted"],
      ["FC moyenne", "–", "142 bpm", "muted"],
    ]);
  });
});

describe("pace by minute", () => {
  it("interpolates distance per minute from the track", () => {
    expect(
      paceByMinute({
        elapsed_s: [0, 30, 60, 120, 150],
        distance_m: [0, 100, 200, 350, null],
      }),
    ).toEqual([300, 400]);
  });

  it("is empty without distance", () => {
    expect(paceByMinute({ elapsed_s: [0, 60] })).toEqual([]);
  });
});
