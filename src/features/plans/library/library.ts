import type { SessionContent } from "../model/plan";
import {
  structureTotals,
  type Intensity,
  type SimpleStep,
  type StructureStep,
} from "../model/structure";
import type { TrainingTargets } from "../targets/targets";

export type Terrain = "road" | "trail" | "treadmill";

export type LibraryContext = {
  targets: TrainingTargets;
  terrain: Terrain;
};

const minutes = (value: number) => Math.round(value * 60);

export function formatMinutes(seconds: number) {
  const whole = Math.round(seconds / 60);
  return whole >= 60 && whole % 60 === 0
    ? `${whole / 60} h`
    : whole >= 60
      ? `${Math.floor(whole / 60)} h ${String(whole % 60).padStart(2, "0")}`
      : `${whole}’`;
}

function heartRateCue(context: LibraryContext, intensity: Intensity) {
  const range = context.targets.intensities[intensity].heartRateRange;
  return range ? `FC ${range.minBpm}–${range.maxBpm}` : null;
}

export function stepTarget(
  context: LibraryContext,
  intensity: Intensity,
): SimpleStep["target"] {
  const target = context.targets.intensities[intensity];
  if (context.terrain === "road" && target.paceRange)
    return {
      kind: "pace_range",
      fastSecondsPerKm: target.paceRange.fastSecondsPerKm,
      slowSecondsPerKm: target.paceRange.slowSecondsPerKm,
    };
  if (target.heartRateRange)
    return {
      kind: "heart_rate_range",
      minBpm: target.heartRateRange.minBpm,
      maxBpm: target.heartRateRange.maxBpm,
    };
  return { kind: "rpe", min: target.rpe.min, max: target.rpe.max };
}

function step(
  context: LibraryContext,
  type: SimpleStep["type"],
  seconds: number,
  intensity: Intensity,
  cue?: string,
): SimpleStep {
  const target = stepTarget(context, intensity);
  const fallbackCue =
    target.kind === "pace_range"
      ? heartRateCue(context, intensity)
      : target.kind === "rpe"
        ? context.targets.intensities[intensity].talkTest
        : null;
  const text = cue ?? fallbackCue;
  return {
    type,
    end: { kind: "time", seconds: Math.max(1, Math.round(seconds)) },
    target,
    intensity,
    ...(text ? { cue: text.slice(0, 80) } : {}),
  };
}

function repeat(count: number, steps: SimpleStep[]): StructureStep {
  return { type: "repeat", count, steps };
}

const sportFor = (terrain: Terrain): SessionContent["sport"] =>
  terrain === "trail" ? "trail" : "run";

function content(
  context: LibraryContext,
  fields: Pick<SessionContent, "kind" | "title" | "purpose" | "structure"> &
    Partial<Pick<SessionContent, "isKey" | "priority" | "contingencies">>,
): SessionContent {
  const totals = structureTotals(fields.structure);
  return {
    sport: sportFor(context.terrain),
    isKey: false,
    priority: "normal",
    contingencies: [],
    ...fields,
    targets: {
      durationSeconds: totals.durationSeconds ?? 0,
      distanceMeters: null,
      elevationGainMeters: null,
    },
    terrain: context.terrain,
    origin: "template",
  };
}

export type QualityKind =
  | "tempo"
  | "threshold"
  | "vo2"
  | "short_hills"
  | "long_hills"
  | "treadmill_incline"
  | "marathon_pace"
  | "half_pace"
  | "ten_k_pace";

export const maxLevel: Record<QualityKind, number> = {
  tempo: 5,
  threshold: 3,
  vo2: 4,
  short_hills: 4,
  long_hills: 3,
  treadmill_incline: 3,
  marathon_pace: 6,
  half_pace: 2,
  ten_k_pace: 3,
};

type Warm = { warmupSeconds: number; cooldownSeconds: number };
const standardWarm: Warm = { warmupSeconds: 900, cooldownSeconds: 600 };
const shortWarm: Warm = { warmupSeconds: 600, cooldownSeconds: 300 };

function intervals(
  context: LibraryContext,
  warm: Warm,
  reps: number,
  workSeconds: number,
  workIntensity: Intensity,
  recoverySeconds: number,
  workCue?: string,
  recoveryCue?: string,
): StructureStep[] {
  return [
    step(context, "warmup", warm.warmupSeconds, "easy"),
    repeat(reps, [
      step(context, "work", workSeconds, workIntensity, workCue),
      step(context, "recovery", recoverySeconds, "recovery", recoveryCue),
    ]),
    step(context, "cooldown", warm.cooldownSeconds, "easy"),
  ];
}

const qualityContingencies = (
  context: LibraryContext,
  intensity: Intensity,
) => [
  ...(context.targets.intensities[intensity].heartRateRange
    ? [
        "Si la FC dépasse la plage dès la 2e répétition, termine la répétition en cours puis rentre en footing.",
      ]
    : [
        "Si l’effort te paraît plus dur que prévu dès la 2e répétition, termine la répétition en cours puis rentre en footing.",
      ]),
  "Jambes lourdes ou nuit courte : remplace par un footing facile de la même durée.",
];

export function qualitySession(
  context: LibraryContext,
  kind: QualityKind,
  requestedLevel: number,
  warm: Warm = standardWarm,
): SessionContent {
  const level = Math.max(0, Math.min(requestedLevel, maxLevel[kind]));
  const key = { isKey: true, priority: "high" as const };
  switch (kind) {
    case "tempo": {
      const work = minutes(15 + 5 * level);
      return content(context, {
        ...key,
        kind: "tempo",
        title: `Allure soutenue · ${formatMinutes(work)}`,
        purpose:
          "Tenir une allure soutenue et régulière, proche de l’allure marathon.",
        structure: [
          step(context, "warmup", warm.warmupSeconds, "easy"),
          step(context, "work", work, "marathon"),
          step(context, "cooldown", warm.cooldownSeconds, "easy"),
        ],
        contingencies: qualityContingencies(context, "marathon"),
      });
    }
    case "threshold": {
      const reps = 3 + level;
      return content(context, {
        ...key,
        kind: "threshold",
        title: `Seuil · ${reps} × 6’`,
        purpose:
          "Développer l’allure seuil, la vitesse que tu tiens environ une heure.",
        structure: intervals(context, warm, reps, 360, "threshold", 90),
        contingencies: qualityContingencies(context, "threshold"),
      });
    }
    case "vo2": {
      const reps = 4 + level;
      return content(context, {
        ...key,
        kind: "intervals",
        title: `Fractionné · ${reps} × 3’`,
        purpose:
          "Travailler la VO₂max avec des répétitions courtes et intenses.",
        structure: intervals(context, warm, reps, 180, "interval", 120),
        contingencies: qualityContingencies(context, "interval"),
      });
    }
    case "short_hills": {
      const reps = 8 + level;
      return content(context, {
        ...key,
        kind: "hills",
        title: `Côtes courtes · ${reps} × 1’`,
        purpose: "Renforcer la puissance en montée avec des efforts courts.",
        structure: intervals(
          context,
          warm,
          reps,
          60,
          "interval",
          120,
          "Montée dynamique, appuis courts",
          "Redescente en trottinant",
        ),
        contingencies: qualityContingencies(context, "interval"),
      });
    }
    case "long_hills":
    case "treadmill_incline": {
      const reps = 4 + level;
      const treadmill = kind === "treadmill_incline";
      return content(context, {
        ...key,
        kind: "hills",
        title: treadmill
          ? `Tapis incliné · ${reps} × 4’`
          : `Côtes longues · ${reps} × 4’`,
        purpose:
          "Développer l’endurance en montée à une intensité proche du seuil.",
        structure: intervals(
          context,
          warm,
          reps,
          240,
          "threshold",
          180,
          treadmill
            ? "Pente 8 à 10 %, effort régulier"
            : "Effort régulier, marche si la pente l’exige",
          treadmill ? "Pente à 1 %, trottine" : "Redescente souple",
        ),
        contingencies: qualityContingencies(context, "threshold"),
      });
    }
    case "marathon_pace": {
      const work = minutes(30 + 5 * level);
      return content(context, {
        ...key,
        kind: "race_specific",
        title: `Allure marathon · ${formatMinutes(work)}`,
        purpose: "Ancrer l’allure du marathon sur une longue portion continue.",
        structure: [
          step(context, "warmup", warm.warmupSeconds, "easy"),
          step(
            context,
            "work",
            work,
            "marathon",
            "Allure de course, ravitaillement à l’entraînement",
          ),
          step(context, "cooldown", warm.cooldownSeconds, "easy"),
        ],
        contingencies: qualityContingencies(context, "marathon"),
      });
    }
    case "half_pace": {
      const reps = 2 + level;
      return content(context, {
        ...key,
        kind: "race_specific",
        title: `Allure semi · ${reps} × 10’`,
        purpose: "Répéter l’allure du semi-marathon sur des blocs longs.",
        structure: intervals(context, warm, reps, 600, "threshold", 120),
        contingencies: qualityContingencies(context, "threshold"),
      });
    }
    case "ten_k_pace": {
      const reps = 4 + level;
      return content(context, {
        ...key,
        kind: "race_specific",
        title: `Allure 10 km · ${reps} × 4’`,
        purpose: "Répéter l’allure du 10 km avec une récupération courte.",
        structure: intervals(context, warm, reps, 240, "interval", 90),
        contingencies: qualityContingencies(context, "interval"),
      });
    }
  }
}

export function fitQualitySession(
  context: LibraryContext,
  kind: QualityKind,
  level: number,
  capSeconds: number | null,
): SessionContent | null {
  for (const warm of [standardWarm, shortWarm])
    for (
      let current = Math.min(level, maxLevel[kind]);
      current >= 0;
      current -= 1
    ) {
      const session = qualitySession(context, kind, current, warm);
      if (capSeconds === null || session.targets.durationSeconds <= capSeconds)
        return session;
    }
  return null;
}

export function easyRun(
  context: LibraryContext,
  seconds: number,
  withStrides = false,
): SessionContent {
  const strides = withStrides && seconds >= minutes(30);
  const stridesSeconds = 6 * 80;
  return content(context, {
    kind: "easy",
    title: strides ? "Footing + lignes droites" : "Footing",
    purpose: strides
      ? "Endurance fondamentale, puis quelques accélérations courtes et relâchées."
      : "Endurance fondamentale, en aisance respiratoire.",
    structure: strides
      ? [
          step(context, "work", seconds - stridesSeconds, "easy"),
          repeat(6, [
            {
              type: "work",
              end: { kind: "time", seconds: 20 },
              target: { kind: "rpe", min: 8, max: 9 },
              intensity: "repetition",
              cue: "Accélération progressive, relâché",
            },
            step(context, "recovery", 60, "recovery", "Marche ou trottine"),
          ]),
        ]
      : [step(context, "work", seconds, "easy")],
  });
}

export function recoveryRun(context: LibraryContext, seconds: number) {
  return content(context, {
    kind: "recovery",
    title: "Footing de récupération",
    purpose: "Récupérer activement, très facile.",
    structure: [step(context, "work", seconds, "recovery")],
  });
}

export function longRun(
  context: LibraryContext,
  seconds: number,
): SessionContent {
  const trail = context.terrain === "trail";
  return content(context, {
    kind: "long",
    isKey: true,
    priority: "high",
    title: `${trail ? "Sortie longue trail" : "Sortie longue"} · ${formatMinutes(seconds)}`,
    purpose: trail
      ? "Endurance sur terrain varié, montées et descentes à l’effort."
      : "Endurance longue à allure facile et régulière.",
    structure: [
      step(
        context,
        "work",
        seconds,
        "easy",
        trail ? "Marche active dans les fortes pentes" : undefined,
      ),
    ],
    contingencies: [
      "Si tu dois ralentir fortement dès la première heure, raccourcis la sortie d’un tiers.",
      ...(seconds >= minutes(90)
        ? ["Bois et mange régulièrement à partir de la première heure."]
        : []),
    ],
  });
}
