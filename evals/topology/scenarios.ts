import { addDays } from "../../src/features/plans/model/dates";
import type { RaceRole } from "../../src/features/plans/model/plan";
import type {
  AthleteRace,
  ConditionReport,
  ValidationInput,
} from "../../src/features/plans/validation/input";

export const today = "2026-10-14";
export const planStart = "2026-10-19";

type HistoryShape = {
  weeks: number;
  minutesPerWeek: number;
  runsPerWeek: number;
  paceSecondsPerKm: number;
  elevationPerWeek: number | null;
  longestShare: number;
};

type ScenarioRace = AthleteRace & {
  name: string;
  role: RaceRole;
  elevationGainMeters: number | null;
  target: string | null;
};

export type Scenario = {
  id: string;
  label: string;
  endsOn: string;
  races: ScenarioRace[];
  profile: Record<string, unknown>;
  athlete: ValidationInput["athlete"];
  history: ValidationInput["history"];
  health: { conditions: (ConditionReport & { note: string })[] } | null;
};

const runOffsets: Record<number, number[]> = {
  3: [1, 3, 6],
  4: [1, 3, 5, 6],
  5: [0, 1, 3, 5, 6],
};

function buildHistory(shape: HistoryShape): ValidationInput["history"] {
  const lastWeek = "2026-10-05";
  const weeks: ValidationInput["history"]["weeks"] = [];
  const runs: ValidationInput["history"]["runs"] = [];
  for (let index = shape.weeks - 1; index >= 0; index -= 1) {
    const weekStart = addDays(lastWeek, -7 * index);
    const wave =
      index % 4 === 0 ? 0.85 : 1 + ((shape.weeks - index) % 3) * 0.03;
    const seconds = Math.round(shape.minutesPerWeek * 60 * wave);
    weeks.push({
      weekStart,
      durationSeconds: seconds,
      elevationGainMeters:
        shape.elevationPerWeek === null
          ? null
          : Math.round(shape.elevationPerWeek * wave),
    });
    const longSeconds = Math.round(seconds * shape.longestShare);
    const otherSeconds = Math.round(
      (seconds - longSeconds) / (shape.runsPerWeek - 1),
    );
    runOffsets[shape.runsPerWeek].forEach((offset, position, offsets) => {
      const durationSeconds =
        position === offsets.length - 1 ? longSeconds : otherSeconds;
      runs.push({
        date: addDays(weekStart, offset),
        durationSeconds,
        distanceMeters: Math.round(
          (durationSeconds / shape.paceSecondsPerKm) * 1000,
        ),
      });
    });
  }
  return { weeks, runs };
}

function summarize(history: ValidationInput["history"]) {
  const recent = history.weeks.slice(-4);
  const longest = history.runs
    .filter((run) => run.date >= addDays(today, -30))
    .reduce((max, run) => Math.max(max, run.durationSeconds), 0);
  return {
    weeksOfHistory: history.weeks.length,
    weeklyMinutes: history.weeks.map((week) => ({
      weekStart: week.weekStart,
      minutes: Math.round(week.durationSeconds / 60),
      elevationGainMeters: week.elevationGainMeters,
    })),
    averageMinutesLastFourWeeks: Math.round(
      recent.reduce((total, week) => total + week.durationSeconds, 0) /
        recent.length /
        60,
    ),
    longestRunLast30DaysMinutes: Math.round(longest / 60),
    runsPerWeek: Math.round(
      history.runs.length / Math.max(history.weeks.length, 1),
    ),
  };
}

function race(
  id: string,
  name: string,
  date: string,
  distanceKm: number,
  options: Partial<ScenarioRace> = {},
): ScenarioRace {
  return {
    id,
    name,
    date,
    distanceKm,
    priority: "A",
    role: "primary",
    elevationGainMeters: null,
    target: null,
    ...options,
  };
}

function athlete(
  availableWeekdays: number[],
  weekdaySessionMinutes: number | null,
  maxWeeklyMinutes: number | null,
  unavailablePeriods: { startsOn: string; endsOn: string }[] = [],
): ValidationInput["athlete"] {
  return {
    availableWeekdays,
    weekdaySessionMinutes,
    maxWeeklyMinutes,
    unavailablePeriods,
  };
}

export const scenarios: Scenario[] = [
  {
    id: "S0",
    label: "Regular 10 km runner (tuning)",
    endsOn: "2026-12-20",
    races: [
      race("r-10k", "10 km de Vincennes", "2026-12-20", 10, {
        target: "44:00",
      }),
    ],
    profile: {
      age: 34,
      sex: "M",
      yearsRunning: 4,
      recentResults: ["10 km en 46:10 (juin 2026)"],
      thresholdPaceSecondsPerKm: 275,
      lactateThresholdHeartRate: 172,
      maxHeartRate: 192,
    },
    athlete: athlete([2, 4, 6, 7], 60, null),
    history: buildHistory({
      weeks: 12,
      minutesPerWeek: 200,
      runsPerWeek: 4,
      paceSecondsPerKm: 320,
      elevationPerWeek: null,
      longestShare: 0.32,
    }),
    health: null,
  },
  {
    id: "S1",
    label: "Novice, 10 km in 10 weeks, three days a week",
    endsOn: "2026-12-27",
    races: [race("r-10k", "10 km de Noël", "2026-12-27", 10)],
    profile: {
      age: 29,
      sex: "F",
      yearsRunning: 0.3,
      recentResults: [],
      thresholdPaceSecondsPerKm: null,
      lactateThresholdHeartRate: null,
      maxHeartRate: 190,
      note: "Court depuis quatre mois, objectif : finir son premier 10 km.",
    },
    athlete: athlete([1, 3, 6], 45, null),
    history: buildHistory({
      weeks: 12,
      minutesPerWeek: 90,
      runsPerWeek: 3,
      paceSecondsPerKm: 405,
      elevationPerWeek: null,
      longestShare: 0.42,
    }),
    health: null,
  },
  {
    id: "S2",
    label: "Regular runner, half marathon in 1 h 45 in 12 weeks",
    endsOn: "2027-01-10",
    races: [
      race("r-half", "Semi-marathon de Boulogne", "2027-01-10", 21.1, {
        target: "1:45:00",
      }),
    ],
    profile: {
      age: 41,
      sex: "F",
      yearsRunning: 6,
      recentResults: [
        "Semi en 1:52:30 (avril 2026)",
        "10 km en 49:30 (septembre 2026)",
      ],
      thresholdPaceSecondsPerKm: 295,
      lactateThresholdHeartRate: 170,
      maxHeartRate: 188,
    },
    athlete: athlete([2, 4, 6, 7], 75, null),
    history: buildHistory({
      weeks: 12,
      minutesPerWeek: 240,
      runsPerWeek: 4,
      paceSecondsPerKm: 330,
      elevationPerWeek: null,
      longestShare: 0.33,
    }),
    health: null,
  },
  {
    id: "S3",
    label: "Experienced runner, marathon in 3 h 30 in 14 weeks",
    endsOn: "2027-01-24",
    races: [
      race("r-marathon", "Marathon de Séville", "2027-01-24", 42.2, {
        target: "3:30:00",
      }),
    ],
    profile: {
      age: 38,
      sex: "M",
      yearsRunning: 9,
      recentResults: [
        "Marathon en 3:41:00 (avril 2026)",
        "Semi en 1:39:00 (septembre 2026)",
      ],
      thresholdPaceSecondsPerKm: 280,
      lactateThresholdHeartRate: 168,
      maxHeartRate: 185,
    },
    athlete: athlete([1, 2, 4, 6, 7], 80, null),
    history: buildHistory({
      weeks: 12,
      minutesPerWeek: 330,
      runsPerWeek: 5,
      paceSecondsPerKm: 315,
      elevationPerWeek: null,
      longestShare: 0.3,
    }),
    health: null,
  },
  {
    id: "S4",
    label: "Trail 32 km with 1,600 m of climbing in 10 weeks",
    endsOn: "2026-12-27",
    races: [
      race("r-trail", "Trail des Coteaux 32 km", "2026-12-27", 32, {
        elevationGainMeters: 1600,
        target: "4:15:00",
      }),
    ],
    profile: {
      age: 36,
      sex: "M",
      yearsRunning: 5,
      recentResults: [
        "Trail 23 km 900 m D+ en 2:48:00 (juin 2026)",
        "10 km en 45:20 (mars 2026)",
      ],
      thresholdPaceSecondsPerKm: 270,
      lactateThresholdHeartRate: 171,
      maxHeartRate: 191,
      terrain: "Collines à 15 minutes, dénivelé de 150 m par montée",
    },
    athlete: athlete([2, 4, 6, 7], 70, null),
    history: buildHistory({
      weeks: 12,
      minutesPerWeek: 270,
      runsPerWeek: 4,
      paceSecondsPerKm: 360,
      elevationPerWeek: 900,
      longestShare: 0.4,
    }),
    health: null,
  },
  {
    id: "S5",
    label: "Ultra 80 km in 14 weeks (EcoTrail-like)",
    endsOn: "2027-01-24",
    races: [
      race("r-ultra", "Ultra des Forêts 80 km", "2027-01-24", 80, {
        elevationGainMeters: 1500,
        target: "10:30:00",
      }),
    ],
    profile: {
      age: 33,
      sex: "M",
      yearsRunning: 7,
      recentResults: [
        "Trail 50 km 1 800 m D+ en 6:55:00 (mai 2026)",
        "Marathon en 3:24:00 (2025)",
      ],
      thresholdPaceSecondsPerKm: 268,
      lactateThresholdHeartRate: 169,
      maxHeartRate: 189,
    },
    athlete: athlete([2, 3, 4, 6, 7], 75, null),
    history: buildHistory({
      weeks: 12,
      minutesPerWeek: 420,
      runsPerWeek: 5,
      paceSecondsPerKm: 370,
      elevationPerWeek: 1200,
      longestShare: 0.45,
    }),
    health: null,
  },
  {
    id: "S6",
    label: "Half marathon with active, worsening knee pain",
    endsOn: "2026-12-13",
    races: [
      race("r-half", "Semi-marathon de Lyon", "2026-12-13", 21.1, {
        target: "1:40:00",
      }),
    ],
    profile: {
      age: 45,
      sex: "M",
      yearsRunning: 10,
      recentResults: ["Semi en 1:43:00 (mars 2026)"],
      thresholdPaceSecondsPerKm: 285,
      lactateThresholdHeartRate: 166,
      maxHeartRate: 180,
    },
    athlete: athlete([2, 4, 6, 7], 70, null),
    history: buildHistory({
      weeks: 12,
      minutesPerWeek: 220,
      runsPerWeek: 4,
      paceSecondsPerKm: 325,
      elevationPerWeek: null,
      longestShare: 0.33,
    }),
    health: {
      conditions: [
        {
          kind: "pain",
          severity: 7,
          status: "active",
          worsening: true,
          systemicSymptoms: false,
          redFlag: false,
          note: "Douleur à l'extérieur du genou droit depuis le 2026-10-08, plus forte en descente, en hausse depuis trois jours.",
        },
      ],
    },
  },
  {
    id: "S7",
    label: "Unrealistic marathon target, short history",
    endsOn: "2026-12-13",
    races: [
      race("r-marathon", "Marathon de La Rochelle", "2026-12-13", 42.2, {
        target: "3:00:00",
      }),
    ],
    profile: {
      age: 31,
      sex: "M",
      yearsRunning: 3,
      recentResults: ["Marathon en 4:10:00 (2024)"],
      thresholdPaceSecondsPerKm: null,
      lactateThresholdHeartRate: null,
      maxHeartRate: 193,
      note: "Reprise après un an sans courir.",
    },
    athlete: athlete([2, 4, 7], 60, null),
    history: buildHistory({
      weeks: 4,
      minutesPerWeek: 150,
      runsPerWeek: 3,
      paceSecondsPerKm: 375,
      elevationPerWeek: null,
      longestShare: 0.4,
    }),
    health: null,
  },
  {
    id: "S8",
    label: "Preparation 10 km before an A half, tight availability",
    endsOn: "2027-01-10",
    races: [
      race("r-half", "Semi-marathon de Paris Est", "2027-01-10", 21.1, {
        target: "1:35:00",
      }),
      race("r-10k", "10 km de la Corrida", "2026-12-20", 10, {
        priority: "B",
        role: "preparation",
        target: "43:00",
      }),
    ],
    profile: {
      age: 27,
      sex: "F",
      yearsRunning: 5,
      recentResults: [
        "Semi en 1:38:40 (mai 2026)",
        "10 km en 44:10 (septembre 2026)",
      ],
      thresholdPaceSecondsPerKm: 265,
      lactateThresholdHeartRate: 174,
      maxHeartRate: 196,
    },
    athlete: athlete([3, 6, 7], 50, 300, [
      { startsOn: "2026-11-23", endsOn: "2026-11-29" },
    ]),
    history: buildHistory({
      weeks: 12,
      minutesPerWeek: 200,
      runsPerWeek: 3,
      paceSecondsPerKm: 315,
      elevationPerWeek: null,
      longestShare: 0.42,
    }),
    health: null,
  },
];

const weekdayNames = [
  "",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

export function athleteFacts(scenario: Scenario) {
  return {
    today,
    planStartsOn: planStart,
    planEndsOn: scenario.endsOn,
    profile: scenario.profile,
    availability: {
      availableDays: scenario.athlete.availableWeekdays?.map(
        (day) => weekdayNames[day],
      ),
      maxWeekdaySessionMinutes: scenario.athlete.weekdaySessionMinutes,
      maxWeeklyMinutes: scenario.athlete.maxWeeklyMinutes,
      unavailablePeriods: scenario.athlete.unavailablePeriods,
    },
    races: scenario.races.map((entry) => ({
      id: entry.id,
      name: entry.name,
      date: entry.date,
      distanceKm: entry.distanceKm,
      elevationGainMeters: entry.elevationGainMeters,
      priority: entry.priority,
      target: entry.target,
    })),
    history: summarize(scenario.history),
    health: scenario.health ?? { conditions: [] },
  };
}

export function scenarioById(id: string) {
  const scenario = scenarios.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Unknown scenario ${id}`);
  return scenario;
}
