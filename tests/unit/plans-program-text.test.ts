import { describe, expect, it } from "vitest";
import type {
  PlanSession,
  PlanState,
  PlanWeek,
} from "@/features/plans/model/plan";
import {
  formatFrenchDate,
  formatHoursText,
  programText,
} from "@/features/plans/view/program-text";

const week = (
  weekKey: string,
  weekStart: string,
  weekType: PlanWeek["weekType"],
  durationSeconds: number,
): PlanWeek => ({
  weekKey,
  weekStart,
  blockKey: "base",
  weekType,
  targets: {
    durationSeconds,
    distanceMeters: null,
    elevationGainMeters: 600,
    qualitySessions: weekType === "recovery" ? 0 : 1,
    longRunSeconds: 7_200,
    intensitySplit: { easyPct: 80, moderatePct: 10, hardPct: 10 },
  },
  notes: weekType === "recovery" ? "Semaine plus légère pour assimiler." : null,
});

const session = (
  values: Partial<PlanSession> &
    Pick<PlanSession, "sessionKey" | "scheduledOn">,
): PlanSession => ({
  sport: "run",
  kind: "easy",
  title: "Footing",
  purpose: "Endurance fondamentale, en aisance respiratoire.",
  isKey: false,
  priority: "normal",
  targets: {
    durationSeconds: 2_700,
    distanceMeters: null,
    elevationGainMeters: null,
  },
  structure: [
    {
      type: "work",
      end: { kind: "time", seconds: 2_700 },
      target: { kind: "heart_rate_range", minBpm: 114, maxBpm: 132 },
      intensity: "easy",
    },
  ],
  terrain: "road",
  origin: "template",
  contingencies: [],
  ...values,
});

const state: PlanState = {
  plan: {
    id: "plan",
    title: "Préparation EcoTrail 120K",
    startsOn: "2026-10-19",
    endsOn: "2026-11-01",
    timeZone: "Europe/Paris",
    primaryRaceId: "ecotrail",
    raceRoles: [
      { raceId: "ecotrail", role: "primary" },
      { raceId: "dix", role: "preparation" },
    ],
    confidence: { level: "low", reasons: ["Peu d’historique en trail."] },
  },
  blocks: [
    {
      blockKey: "base",
      kind: "base",
      name: "Base aérobie",
      startsOn: "2026-10-19",
      endsOn: "2026-11-01",
      objective: "Construire le volume en endurance.",
      raceId: null,
    },
  ],
  weeks: [
    week("w2", "2026-10-26", "recovery", 14_400),
    week("w1", "2026-10-19", "build", 21_600),
  ],
  sessions: [
    session({
      sessionKey: "long",
      scheduledOn: "2026-10-25",
      kind: "long",
      sport: "trail",
      terrain: "trail",
      title: "Sortie longue trail · 2h30",
      isKey: true,
      priority: "high",
      targets: {
        durationSeconds: 9_000,
        distanceMeters: 22_000,
        elevationGainMeters: 900,
      },
      structure: [
        {
          type: "work",
          end: { kind: "time", seconds: 9_000 },
          target: { kind: "rpe", min: 3, max: 4 },
          intensity: "easy",
          cue: "Marche active dans les fortes pentes",
        },
      ],
      contingencies: ["Fatigue marquée : raccourcis à 1h45."],
    }),
    session({
      sessionKey: "threshold",
      scheduledOn: "2026-10-21",
      kind: "threshold",
      title: "Seuil · 4 × 6’",
      purpose: "Repousser le seuil.",
      isKey: true,
      targets: {
        durationSeconds: 3_570,
        distanceMeters: null,
        elevationGainMeters: null,
      },
      structure: [
        {
          type: "warmup",
          end: { kind: "time", seconds: 900 },
          target: { kind: "none" },
          intensity: "easy",
        },
        {
          type: "repeat",
          count: 4,
          steps: [
            {
              type: "work",
              end: { kind: "time", seconds: 360 },
              target: {
                kind: "pace_range",
                fastSecondsPerKm: 265,
                slowSecondsPerKm: 278,
              },
              intensity: "threshold",
            },
            {
              type: "recovery",
              end: { kind: "time", seconds: 90 },
              target: { kind: "none" },
              intensity: "recovery",
            },
          ],
        },
        {
          type: "cooldown",
          end: { kind: "distance", meters: 2_000 },
          target: { kind: "none" },
          intensity: "easy",
        },
      ],
    }),
    session({ sessionKey: "easy", scheduledOn: "2026-10-27" }),
    session({
      sessionKey: "rest",
      scheduledOn: "2026-10-28",
      sport: "rest",
      kind: "rest",
      title: "Repos",
      purpose: "Repos complet.",
      targets: {
        durationSeconds: 0,
        distanceMeters: null,
        elevationGainMeters: null,
      },
      structure: [],
      terrain: null,
    }),
  ],
};

const text = programText({
  state,
  version: 3,
  summary: "Plan prudent qui monte le volume progressivement.",
  today: "2026-10-22",
  paces: { recovery: 400, easy: 340, threshold: 271 },
  races: [
    {
      id: "ecotrail",
      name: "EcoTrail Paris 120K",
      date: "2027-03-20",
      priority: "A",
      targetSeconds: 64_800,
      distanceKm: 120,
      elevationGainM: 1_450,
    },
    {
      id: "dix",
      name: "10 km de Boulogne",
      date: "2026-11-15",
      priority: "C",
      targetSeconds: null,
      distanceKm: 10,
      elevationGainM: null,
    },
    {
      id: "other",
      name: "Course hors plan",
      date: "2026-12-01",
      priority: "B",
      targetSeconds: null,
      distanceKm: 21.1,
      elevationGainM: null,
    },
  ],
});

describe("program text", () => {
  it("formats French dates and durations", () => {
    expect(formatFrenchDate("2027-03-20")).toBe("20/03/2027");
    expect(formatHoursText(2_700)).toBe("45 min");
    expect(formatHoursText(64_800)).toBe("18 h 00");
  });

  it("describes the plan races, dates and version", () => {
    expect(text).toContain(
      "- **10 km de Boulogne** · course de préparation · 15/11/2026 · 10,0 km · sans objectif de temps",
    );
    expect(text).toContain(
      "- **EcoTrail Paris 120K** · objectif principal · 20/03/2027 · 120,0 km · 1 450 m D+ · 12 m D+/km · objectif 18 h 00",
    );
    expect(text.indexOf("10 km de Boulogne")).toBeLessThan(
      text.indexOf("EcoTrail Paris 120K"),
    );
    expect(text).not.toContain("Course hors plan");
    expect(text).toContain(
      "- Du 19/10/2026 au 01/11/2026 · 2 semaines · version 3",
    );
    expect(text).toContain(
      "- Confiance du plan : faible (Peu d’historique en trail.)",
    );
    expect(text).toContain(
      "## Logique du plan\nPlan prudent qui monte le volume progressivement.",
    );
    expect(text).toContain("- Endurance (zone 2) : 5:40/km");
    expect(text).toContain(
      "- **Base aérobie** (Foncier) · 19/10/2026 → 01/11/2026 · 2 semaines · Construire le volume en endurance.",
    );
  });

  it("lists weeks in order with their targets and deload marker", () => {
    const first = text.indexOf("### Semaine 1 · 19/10/2026 → 25/10/2026");
    const second = text.indexOf(
      "### Semaine 2 · 26/10/2026 → 01/11/2026 · Allégée · semaine allégée (décharge)",
    );
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
    expect(text).toContain(
      "### Semaine 1 · 19/10/2026 → 25/10/2026 · Construction · en cours",
    );
    expect(text).toContain(
      "- Cible : 6 h 00 · 600 m D+ · 1 séance de qualité · sortie longue 2 h 00",
    );
    expect(text).toContain(
      "- Répartition visée : 80 % facile · 10 % modéré · 10 % intense",
    );
    expect(text).toContain("- Note : Semaine plus légère pour assimiler.");
    expect(text).toContain("0 séance de qualité");
    expect(text).not.toContain("0 séances");
  });

  it("details every session with its structure", () => {
    expect(text.indexOf("mer. 21/10/2026")).toBeLessThan(
      text.indexOf("dim. 25/10/2026"),
    );
    expect(text).toContain(
      [
        "#### mer. 21/10/2026 · Seuil · Seuil · 4 × 6’",
        "- Course à pied · Route · séance clé",
        "- Volume : durée 1 h 00 · ≈ 10,9 km",
        "- But : Repousser le seuil.",
        "- Déroulé :",
        "  - Échauffement 15 min · zone 2 · Libre",
        "  - 4 × :",
        "    - Seuil 6 min · zone 4 · 4:25–4:38/km",
        "    - Récupération 1 min 30 · zone 1 · Libre",
        "  - Retour au calme 2,0 km · zone 2 · Libre",
      ].join("\n"),
    );
    expect(text).toContain(
      [
        "#### dim. 25/10/2026 · Sortie longue trail · Sortie longue trail · 2h30",
        "- Trail · Trail · séance clé · priorité haute",
        "- Volume : durée 2 h 30 · 22,0 km · 900 m D+",
      ].join("\n"),
    );
    expect(text).toContain(
      "  - Endurance 2 h 30 · zone 2 · Effort 3–4/10 (Marche active dans les fortes pentes)",
    );
    expect(text).toContain(
      "- Adaptations prévues : Fatigue marquée : raccourcis à 1h45.",
    );
    expect(text).toContain(
      "#### mer. 28/10/2026 · Repos · Repos\n- Repos complet.",
    );
  });
});
