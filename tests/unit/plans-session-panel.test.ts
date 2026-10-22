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
            id: "10000000-0000-4000-8000-000000000001",
            title: "Raccourcir la séance",
            summary: "4 × 6’ au lieu de 5 × 6’, même allure.",
            targetKeys: ["session:s-2026-10-22-1"],
            createdAt: "2026-10-22T05:30:00Z",
          },
        ],
      }),
    )!;
    expect(panel.proposal).toEqual({
      id: "10000000-0000-4000-8000-000000000001",
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
    expect(panel.completion!.debrief).toMatchObject({
      aligned: false,
      note: null,
      verdict: { tone: "success", title: "Séance réussie" },
      feeling: null,
      coachHref: "/coach/nouvelle?seance=s-2026-10-20-1",
    });
  });

  it("debriefs an aligned structured run step by step", () => {
    const lap = (
      index: number,
      durationSeconds: number,
      secondsPerKm: number,
      averageHeartRate: number | null = null,
    ) => ({
      index,
      durationSeconds,
      distanceMeters: (durationSeconds / secondsPerKm) * 1000,
      averageHeartRate,
    });
    const panel = buildSessionPanel(
      input({
        sessionKey: "s-2026-10-15-1",
        matches: [
          {
            sessionKey: "s-2026-10-15-1",
            activityId: "activity-2",
            status: "completed",
            compliance: { duration: 0.92, distance: null, intensity: 0.97 },
          },
        ],
        activity: {
          id: "activity-2",
          startedAt: "2026-10-15T16:40:00Z",
          date: "2026-10-15",
          localTime: "18:40",
          durationSeconds: 2_760,
          distanceMeters: 9_800,
          averageHeartRate: 158,
          detailImportedAt: null,
          perceivedEffort: 80,
          feel: 25,
        },
        laps: [
          lap(0, 904, 320),
          lap(1, 360, 262, 167),
          lap(2, 90, 400),
          lap(3, 360, 271, 169),
          lap(4, 90, 400),
          lap(5, 360, 280, 170),
          lap(6, 90, 400),
          lap(7, 310, 281, 174),
          lap(8, 90, 400),
          lap(9, 570, 330),
        ],
      }),
    )!;
    const debrief = panel.completion!.debrief!;
    expect(debrief.alignment).toBe("10 tours alignés sur les 10 étapes");
    expect(debrief.verdict).toEqual({
      tone: "warning",
      title: "Séance écourtée",
      body: "La fraction 4 s’est arrêtée à 5:10 sur 6:00. 1 fraction sur 3 plus vite que la cible.",
    });
    expect(
      debrief.steps
        .filter((step) => !step.compact)
        .map((step) => [
          step.name,
          step.detail,
          step.target,
          step.actual,
          step.status?.label,
        ]),
    ).toEqual([
      ["Échauffement", null, "15’", "15:04", "Fait"],
      ["Seuil 1", "6:00 · FC 167", "4:30–4:40", "4:22", "Trop vite"],
      ["Seuil 2", "6:00 · FC 169", "4:30–4:40", "4:31", "Dans la cible"],
      ["Seuil 3", "6:00 · FC 170", "4:30–4:40", "4:40", "Dans la cible"],
      ["Seuil 4", "5:10 sur 6:00 · FC 174", "4:30–4:40", "4:41", "Écourtée"],
      ["Retour au calme", null, "10’", "9:30", "Fait"],
    ]);
    expect(debrief.feeling).toEqual({
      source: "garmin",
      sourceLabel: "Saisi sur ta montre",
      effort: "8 / 10",
      effortLabel: "Effort perçu · difficile",
      feel: "Mal",
      value: { effort: 8, feel: 25 },
    });
  });

  it("does not debrief a substituted session", () => {
    const panel = buildSessionPanel(
      input({
        sessionKey: "s-2026-10-20-1",
        matches: [
          {
            sessionKey: "s-2026-10-20-1",
            activityId: "activity-1",
            status: "substituted",
            compliance: { duration: 1, distance: null },
          },
        ],
        activity: {
          id: "activity-1",
          startedAt: "2026-10-20T17:12:00Z",
          date: "2026-10-20",
          localTime: "19:12",
          durationSeconds: 3012,
          distanceMeters: null,
          averageHeartRate: null,
          detailImportedAt: null,
        },
      }),
    )!;
    expect(panel.completion!.debrief).toBeNull();
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
