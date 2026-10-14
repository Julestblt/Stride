import type {
  PlanSession,
  PlanState,
  SessionContent,
} from "@/features/plans/model/plan";

export const easyRun = (minutes: number): SessionContent => ({
  sport: "run",
  kind: "easy",
  title: "Footing",
  purpose: "Endurance fondamentale",
  isKey: false,
  priority: "normal",
  targets: {
    durationSeconds: minutes * 60,
    distanceMeters: null,
    elevationGainMeters: null,
  },
  structure: [
    {
      type: "work",
      end: { kind: "time", seconds: minutes * 60 },
      target: { kind: "rpe", min: 3, max: 4 },
      intensity: "easy",
    },
  ],
  terrain: "road",
  origin: "template",
  contingencies: [],
});

export const thresholdSession = (): SessionContent => ({
  sport: "run",
  kind: "threshold",
  title: "Seuil · 4 × 6'",
  purpose: "Développer l'allure seuil",
  isKey: true,
  priority: "high",
  targets: {
    durationSeconds: 3_000,
    distanceMeters: null,
    elevationGainMeters: null,
  },
  structure: [
    {
      type: "warmup",
      end: { kind: "time", seconds: 900 },
      target: { kind: "rpe", min: 2, max: 3 },
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
            fastSecondsPerKm: 270,
            slowSecondsPerKm: 280,
          },
          intensity: "threshold",
          cue: "Respiration contrôlée",
        },
        {
          type: "recovery",
          end: { kind: "time", seconds: 90 },
          target: { kind: "rpe", min: 2, max: 3 },
          intensity: "recovery",
        },
      ],
    },
    {
      type: "cooldown",
      end: { kind: "time", seconds: 600 },
      target: { kind: "none" },
      intensity: "easy",
    },
  ],
  terrain: "road",
  origin: "template",
  contingencies: ["Arrête après la 3e répétition si la FC dépasse la plage"],
});

const placed = (
  sessionKey: string,
  scheduledOn: string,
  content: SessionContent,
): PlanSession => ({ ...content, sessionKey, scheduledOn });

export const planState = (): PlanState => ({
  plan: {
    id: "plan-1",
    title: "Marathon de Paris",
    startsOn: "2026-10-12",
    endsOn: "2026-11-08",
    timeZone: "Europe/Paris",
    primaryRaceId: "race-a",
    raceRoles: [{ raceId: "race-a", role: "primary" }],
    confidence: { level: "normal", reasons: [] },
  },
  blocks: [
    {
      blockKey: "b-base-1",
      kind: "base",
      name: "Base",
      startsOn: "2026-10-12",
      endsOn: "2026-11-08",
      objective: "Construire l'endurance",
      raceId: null,
    },
  ],
  weeks: ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"].map(
    (weekStart) => ({
      weekKey: `w-${weekStart}`,
      weekStart,
      blockKey: "b-base-1",
      weekType: "build" as const,
      targets: {
        durationSeconds: 14_400,
        distanceMeters: null,
        elevationGainMeters: null,
        qualitySessions: 1,
        longRunSeconds: 5_400,
        intensitySplit: { easyPct: 85, moderatePct: 5, hardPct: 10 },
      },
      notes: null,
    }),
  ),
  sessions: [
    placed("s-2026-10-13-1", "2026-10-13", easyRun(45)),
    placed("s-2026-10-15-1", "2026-10-15", thresholdSession()),
    placed("s-2026-10-20-1", "2026-10-20", easyRun(50)),
    placed("s-2026-10-22-1", "2026-10-22", thresholdSession()),
    placed("s-2026-10-25-1", "2026-10-25", easyRun(90)),
  ],
});

export const context = (matched: string[] = []) => ({
  today: "2026-10-14",
  matchedSessionKeys: new Set(matched),
});
