import {
  nutritionThresholds as t,
  nutritionThresholdsVersion,
} from "./thresholds";

export type NutritionSex = "male" | "female";

export type NutritionProfile = {
  birthDate?: string | null;
  sex?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
};

export type NutritionSession = {
  sport: string;
  distanceKm?: number;
  durationSeconds?: number;
  elevationGainM?: number;
  kind?: string;
  isKey?: boolean;
};

export type NutritionRace = {
  date: string;
  sport?: "run" | "trail";
  distanceKm?: number;
  expectedDurationSeconds?: number;
  elevationGainM?: number;
};

export type NutritionNeat = { kcalPerDay: number; source: "garmin" };

export type NutritionWeekType = "taper" | "race";

export type NutritionHealthFlag =
  "fatigue" | "illness" | "injury" | "poor_readiness";

export type NutritionDayInput = {
  date: string;
  profile: NutritionProfile;
  sessions: NutritionSession[];
  races?: NutritionRace[];
  neat?: NutritionNeat;
  deficitRequested?: boolean;
  weekType?: NutritionWeekType | null;
  healthFlags?: NutritionHealthFlag[];
};

export type NutritionDayType =
  "rest" | "easy" | "moderate" | "long_or_hard" | "pre_race" | "race";

export type NutritionConfidence = "high" | "medium" | "low";

export type NutritionMissingField =
  "birthDate" | "sex" | "heightCm" | "weightKg";

export type NutritionEstimationCode =
  | "neat_default"
  | "session_distance_from_duration"
  | "session_duration_from_distance"
  | "session_duration_default"
  | "race_duration_from_distance"
  | "race_distance_from_duration";

export type NutritionEstimation = {
  code: NutritionEstimationCode;
  target: "neat" | "race" | number;
  value: number;
};

export type NutritionRange = { min: number; max: number };

export type NutritionFueling = {
  target: "race" | number;
  durationSeconds: number;
  ultra: boolean;
  gramsPerHour: NutritionRange;
  totalGrams: NutritionRange;
};

export type NutritionDeficitRefusal =
  | "long_or_hard_day"
  | "pre_race_day"
  | "race_day"
  | "taper_week"
  | "race_week"
  | "health_flags";

export type NutritionDeficit =
  | { status: "not_requested" }
  | { status: "refused"; reasons: NutritionDeficitRefusal[] }
  | { status: "applied"; kcal: NutritionRange; targetKcal: NutritionRange };

export type NutritionInputsUsed = {
  date: string;
  ageYears: number;
  sex: NutritionSex;
  heightCm: number;
  weightKg: number;
  neat: { kcalPerDay: number; source: "garmin" | "default" };
  sessions: NutritionSession[];
  race: NutritionRace | null;
  nextRace: NutritionRace | null;
  weekType: NutritionWeekType | null;
  healthFlags: NutritionHealthFlag[];
  deficitRequested: boolean;
};

export type NutritionDayResult = {
  ok: true;
  version: string;
  date: string;
  dayType: NutritionDayType;
  energy: {
    restingKcal: number;
    digestionKcal: number;
    neatKcal: number;
    trainingKcal: number;
    targetKcal: number;
    displayKcal: number;
  };
  carbs: { gPerKg: NutritionRange; grams: NutritionRange };
  protein: {
    gPerKg: NutritionRange;
    grams: NutritionRange;
    intakes: NutritionRange;
    gramsPerIntake: NutritionRange;
    recoveryIntakeWithinHours: number | null;
  };
  fat: { grams: number; gPerKg: number; floorApplied: boolean };
  fueling: NutritionFueling[];
  deficit: NutritionDeficit;
  inputsUsed: NutritionInputsUsed;
  estimations: NutritionEstimation[];
  confidence: NutritionConfidence;
};

export type NutritionMissingResult = {
  ok: false;
  version: string;
  date: string;
  missing: NutritionMissingField[];
};

export type NutritionResult = NutritionDayResult | NutritionMissingResult;

type Profile = {
  ageYears: number;
  sex: NutritionSex;
  heightCm: number;
  weightKg: number;
};

type Effort = {
  target: "race" | number;
  sport: string;
  kind?: string;
  isKey?: boolean;
  distanceKm: number | null;
  durationSeconds: number;
  elevationGainM: number;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const hardKinds = new Set([
  "intervals",
  "interval",
  "threshold",
  "race_specific",
  "race",
  "long",
]);
const moderateKinds = new Set(["tempo", "hills"]);
const runningSports = new Set(["run", "trail"]);

function parseDay(value: string) {
  if (!isoDatePattern.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(time) ? null : new Date(time);
}

export function addDays(date: string, days: number) {
  const day = parseDay(date);
  if (!day) throw new Error(`Invalid date: ${date}`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

export function ageOn(birthDate: string, date: string) {
  const birth = parseDay(birthDate);
  const day = parseDay(date);
  if (!birth || !day || birth > day) return null;
  const years = day.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    day.getUTCMonth() < birth.getUTCMonth() ||
    (day.getUTCMonth() === birth.getUTCMonth() &&
      day.getUTCDate() < birth.getUTCDate());
  return beforeBirthday ? years - 1 : years;
}

const positive = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function readProfile(profile: NutritionProfile, date: string) {
  const missing: NutritionMissingField[] = [];
  const ageYears = profile.birthDate ? ageOn(profile.birthDate, date) : null;
  if (ageYears === null) missing.push("birthDate");
  const sex =
    profile.sex === "male" || profile.sex === "female" ? profile.sex : null;
  if (!sex) missing.push("sex");
  if (!positive(profile.heightCm)) missing.push("heightCm");
  if (!positive(profile.weightKg)) missing.push("weightKg");
  if (missing.length > 0 || ageYears === null || !sex) return { missing };
  return {
    missing,
    profile: {
      ageYears,
      sex,
      heightCm: profile.heightCm as number,
      weightKg: profile.weightKg as number,
    } satisfies Profile,
  };
}

export function restingEnergy(profile: Profile) {
  const base =
    t.mifflinWeightFactor * profile.weightKg +
    t.mifflinHeightFactor * profile.heightCm -
    t.mifflinAgeFactor * profile.ageYears;
  return (
    base +
    (profile.sex === "male" ? t.mifflinMaleOffset : t.mifflinFemaleOffset)
  );
}

const defaultPace = (sport: string) =>
  sport === "trail"
    ? t.defaultTrailPaceSecondsPerKm
    : t.defaultRunPaceSecondsPerKm;

function sessionEffort(
  session: NutritionSession,
  index: number,
  estimations: NutritionEstimation[],
): Effort {
  const running = runningSports.has(session.sport);
  let distanceKm = positive(session.distanceKm) ? session.distanceKm : null;
  let durationSeconds = positive(session.durationSeconds)
    ? session.durationSeconds
    : null;
  if (running && durationSeconds === null && distanceKm !== null) {
    durationSeconds = distanceKm * defaultPace(session.sport);
    estimations.push({
      code: "session_duration_from_distance",
      target: index,
      value: durationSeconds,
    });
  }
  if (durationSeconds === null) {
    durationSeconds = t.defaultSessionSeconds;
    estimations.push({
      code: "session_duration_default",
      target: index,
      value: durationSeconds,
    });
  }
  if (running && distanceKm === null) {
    distanceKm = durationSeconds / defaultPace(session.sport);
    estimations.push({
      code: "session_distance_from_duration",
      target: index,
      value: distanceKm,
    });
  }
  return {
    target: index,
    sport: session.sport,
    kind: session.kind,
    isKey: session.isKey,
    distanceKm,
    durationSeconds,
    elevationGainM: positive(session.elevationGainM)
      ? session.elevationGainM
      : 0,
  };
}

function raceDurationSeconds(race: NutritionRace) {
  if (positive(race.expectedDurationSeconds))
    return { seconds: race.expectedDurationSeconds, estimated: false };
  if (positive(race.distanceKm))
    return {
      seconds: race.distanceKm * defaultPace(race.sport ?? "run"),
      estimated: true,
    };
  return null;
}

function raceEffort(
  race: NutritionRace,
  estimations: NutritionEstimation[],
): Effort {
  const sport = race.sport ?? "run";
  const duration = raceDurationSeconds(race);
  const durationSeconds = duration?.seconds ?? t.defaultSessionSeconds;
  if (!duration || duration.estimated) {
    estimations.push({
      code: "race_duration_from_distance",
      target: "race",
      value: durationSeconds,
    });
  }
  let distanceKm = positive(race.distanceKm) ? race.distanceKm : null;
  if (distanceKm === null) {
    distanceKm = durationSeconds / defaultPace(sport);
    estimations.push({
      code: "race_distance_from_duration",
      target: "race",
      value: distanceKm,
    });
  }
  return {
    target: "race",
    sport,
    kind: "race",
    distanceKm,
    durationSeconds,
    elevationGainM: positive(race.elevationGainM) ? race.elevationGainM : 0,
  };
}

export function trainingEnergy(effort: Effort, weightKg: number) {
  if (runningSports.has(effort.sport)) {
    return (
      weightKg * (effort.distanceKm ?? 0) * t.runKcalPerKgPerKm +
      weightKg * effort.elevationGainM * t.climbKcalPerKgPerMetre
    );
  }
  const minutes = effort.durationSeconds / 60;
  if (effort.sport === "strength") return minutes * t.strengthKcalPerMinute;
  if (effort.sport === "mobility") return minutes * t.mobilityKcalPerMinute;
  return minutes * t.otherKcalPerMinute;
}

const isLongRace = (race: NutritionRace | null) =>
  race !== null &&
  (raceDurationSeconds(race)?.seconds ?? 0) > t.preRaceMinimumSeconds;

function effortLevel(effort: Effort): "easy" | "moderate" | "long_or_hard" {
  const running = runningSports.has(effort.sport);
  if (effort.isKey || (effort.kind && hardKinds.has(effort.kind)))
    return "long_or_hard";
  if (running && effort.durationSeconds >= t.longSessionSeconds)
    return "long_or_hard";
  if (effort.kind && moderateKinds.has(effort.kind)) return "moderate";
  if (running && effort.durationSeconds >= t.moderateSessionSeconds)
    return "moderate";
  return "easy";
}

const levelRank = { easy: 0, moderate: 1, long_or_hard: 2 } as const;

export function dayType(
  efforts: Effort[],
  race: NutritionRace | null,
  nextRace: NutritionRace | null,
): NutritionDayType {
  if (race) return "race";
  if (isLongRace(nextRace)) return "pre_race";
  if (efforts.length === 0) return "rest";
  return efforts
    .map(effortLevel)
    .reduce<"easy" | "moderate" | "long_or_hard">(
      (best, level) => (levelRank[level] > levelRank[best] ? level : best),
      "easy",
    );
}

function carbsRange(type: NutritionDayType, race: NutritionRace | null) {
  if (type === "race")
    return isLongRace(race)
      ? t.carbsGPerKg.pre_race
      : t.carbsGPerKg.long_or_hard;
  return t.carbsGPerKg[type];
}

const scale = (range: NutritionRange, factor: number) => ({
  min: Math.round(range.min * factor),
  max: Math.round(range.max * factor),
});

const midpoint = (range: NutritionRange) => (range.min + range.max) / 2;

function isUltra(effort: Effort) {
  if (effort.durationSeconds > t.ultraSeconds) return true;
  return (
    effort.target === "race" &&
    effort.sport === "trail" &&
    (effort.distanceKm ?? 0) >= t.ultraTrailKm
  );
}

function fuelingFor(effort: Effort): NutritionFueling | null {
  const ultra = isUltra(effort);
  if (!ultra && effort.durationSeconds <= t.fuelingMinimumSeconds) return null;
  const gramsPerHour = ultra ? t.ultraFuelingGPerHour : t.fuelingGPerHour;
  return {
    target: effort.target,
    durationSeconds: Math.round(effort.durationSeconds),
    ultra,
    gramsPerHour: { ...gramsPerHour },
    totalGrams: scale(gramsPerHour, effort.durationSeconds / 3_600),
  };
}

function fatFor(
  targetKcal: number,
  carbs: NutritionRange,
  protein: NutritionRange,
  weightKg: number,
) {
  const remainder =
    (targetKcal -
      midpoint(carbs) * t.kcalPerGramCarbs -
      midpoint(protein) * t.kcalPerGramProtein) /
    t.kcalPerGramFat;
  const floor = weightKg * t.fatMinimumGPerKg;
  const grams = Math.round(Math.max(remainder, floor));
  return {
    grams,
    gPerKg: Math.round((grams / weightKg) * 100) / 100,
    floorApplied: remainder < floor,
  };
}

function deficitRefusals(
  type: NutritionDayType,
  weekType: NutritionWeekType | null,
  healthFlags: NutritionHealthFlag[],
) {
  const reasons: NutritionDeficitRefusal[] = [];
  if (type === "long_or_hard") reasons.push("long_or_hard_day");
  if (type === "pre_race") reasons.push("pre_race_day");
  if (type === "race") reasons.push("race_day");
  if (weekType === "taper") reasons.push("taper_week");
  if (weekType === "race") reasons.push("race_week");
  if (healthFlags.length > 0) reasons.push("health_flags");
  return reasons;
}

const clampDeficit = (kcal: number) =>
  Math.round(Math.min(t.deficitKcal.max, Math.max(t.deficitKcal.min, kcal)));

function deficitFor(
  requested: boolean,
  targetKcal: number,
  reasons: NutritionDeficitRefusal[],
): NutritionDeficit {
  if (!requested) return { status: "not_requested" };
  if (reasons.length > 0) return { status: "refused", reasons };
  const kcal = {
    min: clampDeficit(targetKcal * t.deficitShare.min),
    max: clampDeficit(targetKcal * t.deficitShare.max),
  };
  return {
    status: "applied",
    kcal,
    targetKcal: {
      min: Math.round(targetKcal - kcal.max),
      max: Math.round(targetKcal - kcal.min),
    },
  };
}

function confidenceFor(
  neatSource: "garmin" | "default",
  estimations: NutritionEstimation[],
) {
  if (neatSource === "default") return "low";
  return estimations.length > 0 ? "medium" : "high";
}

const roundDisplay = (kcal: number) =>
  Math.round(kcal / t.displayRoundingKcal) * t.displayRoundingKcal;

function computeDay(
  input: NutritionDayInput,
  profile: Profile,
): NutritionDayResult {
  const estimations: NutritionEstimation[] = [];
  const races = input.races ?? [];
  const race = races.find((item) => item.date === input.date) ?? null;
  const nextRace =
    races.find((item) => item.date === addDays(input.date, 1)) ?? null;
  const sessions = race
    ? input.sessions.filter((session) => session.kind !== "race")
    : input.sessions;
  const efforts = sessions.map((session, index) =>
    sessionEffort(session, index, estimations),
  );
  if (race) efforts.push(raceEffort(race, estimations));

  const restingKcal = restingEnergy(profile);
  const neat = input.neat
    ? { kcalPerDay: input.neat.kcalPerDay, source: "garmin" as const }
    : {
        kcalPerDay: restingKcal * t.defaultNeatShare,
        source: "default" as const,
      };
  if (!input.neat)
    estimations.unshift({
      code: "neat_default",
      target: "neat",
      value: Math.round(neat.kcalPerDay),
    });
  const trainingKcal = efforts.reduce(
    (sum, effort) => sum + trainingEnergy(effort, profile.weightKg),
    0,
  );
  const targetKcal =
    restingKcal * t.digestionFactor + neat.kcalPerDay + trainingKcal;

  const type = dayType(efforts, race, nextRace);
  const carbsGPerKg = carbsRange(type, race);
  const carbs = scale(carbsGPerKg, profile.weightKg);
  const protein = scale(t.proteinGPerKg, profile.weightKg);
  const weekType = input.weekType ?? null;
  const healthFlags = input.healthFlags ?? [];
  const recovery = type === "long_or_hard" || type === "race";

  return {
    ok: true,
    version: nutritionThresholdsVersion,
    date: input.date,
    dayType: type,
    energy: {
      restingKcal: Math.round(restingKcal),
      digestionKcal: Math.round(restingKcal * (t.digestionFactor - 1)),
      neatKcal: Math.round(neat.kcalPerDay),
      trainingKcal: Math.round(trainingKcal),
      targetKcal: Math.round(targetKcal),
      displayKcal: roundDisplay(targetKcal),
    },
    carbs: { gPerKg: { ...carbsGPerKg }, grams: carbs },
    protein: {
      gPerKg: { ...t.proteinGPerKg },
      grams: protein,
      intakes: { ...t.proteinIntakes },
      gramsPerIntake: scale(t.proteinIntakeGPerKg, profile.weightKg),
      recoveryIntakeWithinHours: recovery ? t.proteinRecoveryWindowHours : null,
    },
    fat: fatFor(targetKcal, carbs, protein, profile.weightKg),
    fueling: efforts
      .map(fuelingFor)
      .filter((item): item is NutritionFueling => item !== null),
    deficit: deficitFor(
      input.deficitRequested === true,
      targetKcal,
      deficitRefusals(type, weekType, healthFlags),
    ),
    inputsUsed: {
      date: input.date,
      ...profile,
      neat: { kcalPerDay: Math.round(neat.kcalPerDay), source: neat.source },
      sessions,
      race,
      nextRace,
      weekType,
      healthFlags,
      deficitRequested: input.deficitRequested === true,
    },
    estimations,
    confidence: confidenceFor(neat.source, estimations),
  };
}

export function nutritionForDay(input: NutritionDayInput): NutritionResult {
  if (!parseDay(input.date)) throw new Error(`Invalid date: ${input.date}`);
  const read = readProfile(input.profile, input.date);
  if (!read.profile) {
    return {
      ok: false,
      version: nutritionThresholdsVersion,
      date: input.date,
      missing: read.missing,
    };
  }
  return computeDay(input, read.profile);
}

export type NutritionDatedSession = NutritionSession & { date: string };

export type NutritionRangeInput = Omit<
  NutritionDayInput,
  "date" | "sessions" | "neat"
> & {
  from: string;
  to: string;
  sessions: NutritionDatedSession[];
  neat?: NutritionNeat;
  neatByDate?: Record<string, NutritionNeat>;
};

export const nutritionMaxRangeDays = 62;

function withoutDate(session: NutritionDatedSession): NutritionSession {
  const copy: Partial<NutritionDatedSession> = { ...session };
  delete copy.date;
  return copy as NutritionSession;
}

export function nutritionForDays(
  input: NutritionRangeInput,
): NutritionResult[] {
  const { from, to, sessions, neatByDate, ...shared } = input;
  const dates: string[] = [];
  for (
    let date = from;
    date <= to && dates.length < nutritionMaxRangeDays;
    date = addDays(date, 1)
  ) {
    dates.push(date);
  }
  return dates.map((date) =>
    nutritionForDay({
      ...shared,
      date,
      neat: neatByDate?.[date] ?? input.neat,
      sessions: sessions
        .filter((session) => session.date === date)
        .map(withoutDate),
    }),
  );
}
