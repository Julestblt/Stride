import "server-only";
import { z } from "zod";
import {
  buildDeterministicPlan,
  type DeterministicPlanInput,
} from "@/features/plans/detailing/build";
import { summarizeHistory } from "@/features/plans/history/summary";
import { addDays } from "@/features/plans/model/dates";
import type { StoredPlan } from "@/server/plans/stored";
import type { ProfileValues } from "@/features/onboarding/profile";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readProfile } from "@/server/onboarding/profile";
import { loadPlanningInput } from "@/server/plans/draft";
import { readActivePlan } from "@/server/plans/stored";
import { defineTool } from "./define";
import { checkinSchema, readCheckins, type Checkin } from "./health-reports";

export const contextHistoryWeeks = 8;
export const contextCheckinDays = 7;
export const contextPacketBudgetBytes = 4_096;

const predictionMetrics = {
  race_prediction_5k_seconds: "5k",
  race_prediction_10k_seconds: "10k",
  race_prediction_half_marathon_seconds: "half_marathon",
  race_prediction_marathon_seconds: "marathon",
} as const;

export type PredictionRow = {
  metric: string;
  observed_on: string | null;
  value_numeric: number | string | null;
};

const asOf = z.iso.date();
const range = z.tuple([z.number(), z.number()]);
const garminValue = <T extends z.ZodRawShape>(shape: T) =>
  z.strictObject({ ...shape, source: z.literal("garmin"), asOf });
const targetSourceSchema = z.strictObject({
  kind: z.string(),
  asOf,
  confidence: z.string(),
});

export const athleteContextSchema = z.strictObject({
  today: asOf,
  timeZone: z.string(),
  athlete: z.strictObject({
    age: z.int().positive().optional(),
    sex: z.string().optional(),
    heightCm: z.number().positive().optional(),
    weightKg: z.number().positive().optional(),
    primaryTerrain: z.string().optional(),
    trainingAccess: z.array(z.string()).optional(),
  }),
  availability: z.strictObject({
    weekdays: z.array(z.int()).optional(),
    longRunDay: z.string().optional(),
    weekdaySessionMinutes: z.int().positive().optional(),
    maxWeeklyMinutes: z.int().positive().optional(),
    unavailable: z
      .array(
        z.strictObject({
          from: asOf,
          to: asOf,
          kind: z.string(),
          reason: z.string().optional(),
        }),
      )
      .optional(),
  }),
  races: z
    .array(
      z.strictObject({
        id: z.string(),
        name: z.string(),
        date: asOf,
        distanceKm: z.number().positive().optional(),
        elevationGainM: z.number().positive().optional(),
        kind: z.string(),
        priority: z.string(),
        targetSeconds: z.int().positive().optional(),
      }),
    )
    .optional(),
  history: z.strictObject({
    weeks: z.array(
      z.strictObject({
        weekStart: asOf,
        runs: z.int().nonnegative(),
        minutes: z.int().nonnegative(),
        km: z.number().nonnegative(),
        gainM: z.int().nonnegative(),
      }),
    ),
    weeksWithRuns16: z.int().nonnegative(),
    heldWeekly: z.strictObject({
      minutes: z.int().nonnegative(),
      km: z.number().nonnegative(),
      gainM: z.int().nonnegative(),
    }),
    provenWeeklyMinutes: z.int().nonnegative(),
    heldPaceSecondsPerKm: z.int().positive().optional(),
    longestRun30d: z
      .strictObject({ km: z.number(), minutes: z.int() })
      .optional(),
    longestEffort90d: z
      .strictObject({ date: asOf, km: z.number(), minutes: z.int() })
      .optional(),
    runsLast30d: z.int().nonnegative(),
    trailShare: z.number().min(0).max(1),
    sufficient: z.boolean(),
  }),
  targets: z.strictObject({
    intensities: z.record(
      z.string(),
      z.strictObject({
        paceSecondsPerKm: range.optional(),
        heartRateBpm: range.optional(),
        rpe: range,
      }),
    ),
    paceSource: targetSourceSchema.optional(),
    heartRateSource: targetSourceSchema.optional(),
    trail: z.record(
      z.string(),
      z.strictObject({ heartRateBpm: range.optional(), rpe: range }),
    ),
    calibrationGaps: z.array(z.string()).optional(),
  }),
  garmin: z
    .strictObject({
      vo2Max: garminValue({ value: z.number().positive() }).optional(),
      lactateThreshold: garminValue({
        speedMps: z.number().positive().optional(),
        heartRateBpm: z.int().positive().optional(),
      }).optional(),
      racePredictions: z
        .record(z.string(), garminValue({ seconds: z.int().positive() }))
        .optional(),
    })
    .optional(),
  feasibility: z.strictObject({
    objectiveRaceId: z.string().optional(),
    verdict: z.string(),
    reasons: z.array(z.string()),
    options: z.array(z.unknown()).optional(),
    demands: z
      .array(
        z.strictObject({
          key: z.string(),
          planned: z.int().optional(),
          target: z.int(),
          status: z.string(),
        }),
      )
      .optional(),
  }),
  checkins: z.array(checkinSchema).optional(),
  activePlan: z
    .strictObject({
      title: z.string(),
      startsOn: asOf,
      endsOn: asOf,
      version: z.int().positive(),
    })
    .optional(),
});

export type AthleteContext = z.infer<typeof athleteContextSchema>;

function ageOn(birthDate: string | null, today: string) {
  if (!birthDate) return null;
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years;
}

function present<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) =>
        entry !== null &&
        entry !== undefined &&
        !(Array.isArray(entry) && entry.length === 0),
    ),
  ) as { [K in keyof T]?: Exclude<T[K], null> };
}

const km = (meters: number) => Math.round(meters / 100) / 10;
const minutes = (seconds: number) => Math.round(seconds / 60);
const positive = (value: number | null | undefined) =>
  value !== null && value !== undefined && value > 0 ? value : null;

function predictions(rows: PredictionRow[]) {
  const entries = Object.entries(predictionMetrics).flatMap(([metric, key]) => {
    const latest = rows.find(
      (row) =>
        row.metric === metric &&
        row.observed_on !== null &&
        Number(row.value_numeric) > 0,
    );
    return latest?.observed_on
      ? [
          [
            key,
            {
              seconds: Math.round(Number(latest.value_numeric)),
              source: "garmin" as const,
              asOf: latest.observed_on,
            },
          ] as const,
        ]
      : [];
  });
  return entries.length ? Object.fromEntries(entries) : null;
}

export function buildAthleteContext({
  today,
  planning,
  profile,
  stored,
  checkins,
  predictionRows,
}: {
  today: string;
  planning: DeterministicPlanInput;
  profile: ProfileValues;
  stored: StoredPlan | null;
  checkins: Checkin[];
  predictionRows: PredictionRow[];
}): AthleteContext {
  const reference = buildDeterministicPlan(planning);
  const history = summarizeHistory(planning.activities, today);
  const { targets, feasibility } = reference;
  const intensities = Object.entries(targets.intensities);
  const lactate = planning.targets.garminLactateThreshold;
  const vo2 = planning.targets.vo2Max;
  const garmin = present({
    vo2Max: vo2
      ? { value: vo2.value, source: "garmin" as const, asOf: vo2.asOf }
      : null,
    lactateThreshold:
      lactate && (lactate.speedMps || lactate.heartRateBpm)
        ? {
            ...present({
              speedMps: positive(lactate.speedMps),
              heartRateBpm: positive(lactate.heartRateBpm),
            }),
            source: "garmin" as const,
            asOf: lactate.asOf,
          }
        : null,
    racePredictions: predictions(predictionRows),
  });
  const longest = history.longestRun30d;
  return present({
    today,
    timeZone: planning.constraints.timeZone,
    athlete: present({
      age: positive(ageOn(profile.birth_date, today)),
      sex: profile.sex,
      heightCm: positive(profile.height_cm),
      weightKg: positive(profile.weight_kg),
      primaryTerrain: profile.primary_terrain,
      trainingAccess: profile.training_access,
    }),
    availability: present({
      weekdays: planning.availability.availableWeekdays,
      longRunDay: planning.availability.longRunDay,
      weekdaySessionMinutes: positive(
        planning.availability.weekdaySessionMinutes,
      ),
      maxWeeklyMinutes: positive(planning.constraints.maxWeeklyMinutes),
      unavailable: planning.constraints.unavailablePeriods
        .filter((period) => period.endsOn >= today)
        .map((period) =>
          present({
            from: period.startsOn,
            to: period.endsOn,
            kind: period.kind,
            reason: period.reason,
          }),
        ),
    }),
    races: planning.races
      .filter((race) => race.date >= today)
      .map((race) =>
        present({
          id: race.id,
          name: race.name,
          date: race.date,
          distanceKm: positive(race.distanceKm),
          elevationGainM: positive(race.elevationGainM),
          kind: race.kind,
          priority: race.priority,
          targetSeconds: positive(race.targetSeconds),
        }),
      ),
    history: present({
      weeks: history.weeks.slice(-contextHistoryWeeks).map((week) => ({
        weekStart: week.weekStart,
        runs: week.runs,
        minutes: minutes(week.durationSeconds),
        km: km(week.distanceMeters),
        gainM: Math.round(week.elevationGainMeters),
      })),
      weeksWithRuns16: history.weeksWithRuns,
      heldWeekly: {
        minutes: minutes(history.held.durationSeconds),
        km: km(history.held.distanceMeters),
        gainM: Math.round(history.held.elevationGainMeters),
      },
      provenWeeklyMinutes: minutes(history.provenDurationSeconds),
      heldPaceSecondsPerKm: history.heldPaceSecondsPerKm
        ? Math.round(history.heldPaceSecondsPerKm)
        : null,
      longestRun30d: longest
        ? {
            km: km(longest.distanceMeters),
            minutes: minutes(longest.durationSeconds),
          }
        : null,
      longestEffort90d: history.longestEffort90d
        ? {
            date: history.longestEffort90d.date,
            km: km(history.longestEffort90d.distanceMeters),
            minutes: minutes(history.longestEffort90d.durationSeconds),
          }
        : null,
      runsLast30d: history.runsLast30d,
      trailShare: Math.round(history.trailShare * 100) / 100,
      sufficient: history.sufficient,
    }),
    targets: present({
      intensities: Object.fromEntries(
        intensities.map(([intensity, target]) => [
          intensity,
          present({
            paceSecondsPerKm: target.paceRange
              ? ([
                  target.paceRange.fastSecondsPerKm,
                  target.paceRange.slowSecondsPerKm,
                ] as [number, number])
              : null,
            heartRateBpm: target.heartRateRange
              ? ([
                  target.heartRateRange.minBpm,
                  target.heartRateRange.maxBpm,
                ] as [number, number])
              : null,
            rpe: [target.rpe.min, target.rpe.max] as [number, number],
          }),
        ]),
      ),
      paceSource:
        intensities.find(([, target]) => target.paceSource)?.[1].paceSource ??
        null,
      heartRateSource:
        intensities.find(([, target]) => target.heartRateSource)?.[1]
          .heartRateSource ?? null,
      trail: Object.fromEntries(
        Object.entries(targets.trail).map(([slope, guidance]) => [
          slope,
          present({
            heartRateBpm: guidance.heartRateRange
              ? ([
                  guidance.heartRateRange.minBpm,
                  guidance.heartRateRange.maxBpm,
                ] as [number, number])
              : null,
            rpe: [guidance.rpe.min, guidance.rpe.max] as [number, number],
          }),
        ]),
      ),
      calibrationGaps: targets.calibrationGaps,
    }),
    garmin: Object.keys(garmin).length ? garmin : null,
    feasibility: present({
      objectiveRaceId: reference.objective.race?.id ?? null,
      verdict: feasibility.verdict,
      reasons: feasibility.reasons,
      options: feasibility.options,
      demands: feasibility.demands.map((demand) =>
        present({
          key: demand.key,
          planned: demand.planned === null ? null : Math.round(demand.planned),
          target: Math.round(demand.target),
          status: demand.status,
        }),
      ),
    }),
    checkins: checkins.filter(
      (checkin) => checkin.date > addDays(today, -contextCheckinDays),
    ),
    activePlan: stored
      ? {
          title: stored.state.plan.title,
          startsOn: stored.state.plan.startsOn,
          endsOn: stored.state.plan.endsOn,
          version: stored.activeVersion,
        }
      : null,
  }) as AthleteContext;
}

async function readPredictions(
  context: OnboardingContext,
): Promise<PredictionRow[]> {
  const metrics = Object.keys(predictionMetrics);
  const { data, error } = await context.client
    .from("provider_observations")
    .select("metric, observed_on, value_numeric")
    .eq("user_id", context.userId)
    .eq("availability", "available")
    .in("metric", metrics)
    .order("observed_on", { ascending: false })
    .limit(metrics.length * 4);
  if (error) throw new Error("Unable to read the race predictions");
  return data ?? [];
}

export const readAthleteContextTool = defineTool({
  name: "read_athlete_context",
  description:
    "Read the athlete's compact context computed by Stride: today's date and time zone, profile, availability and upcoming unavailability, upcoming races with their ids, dates, priorities and targets, the last weeks of running (weekly runs, minutes, km, elevation) with the held and proven weekly volume and the longest effort of the last 90 days, training intensities with pace, heart-rate and RPE ranges and their sources, Garmin VO2max, lactate threshold and race predictions with source and date, a deterministic feasibility reference, the last week's wellness check-ins, and the active plan header. Absent values are omitted. Call it first in every conversation.",
  class: "read",
  dataClasses: ["training", "health"],
  input: z.strictObject({}),
  output: athleteContextSchema,
  run: async (context) => {
    const [{ today, input: planning }, profile, stored] = await Promise.all([
      loadPlanningInput(context),
      readProfile(context),
      readActivePlan(context),
    ]);
    const [checkins, predictionRows] = await Promise.all([
      readCheckins(context, addDays(today, -contextCheckinDays)),
      readPredictions(context),
    ]);
    return buildAthleteContext({
      today,
      planning,
      profile: profile.values,
      stored,
      checkins,
      predictionRows,
    });
  },
});
