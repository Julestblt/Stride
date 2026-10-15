import "server-only";
import { cache } from "react";
import { resolveRaceSnapshots } from "@/features/onboarding/goals";
import { localToday } from "@/features/plans/constraints";
import {
  buildDeterministicPlan,
  type DeterministicPlan,
  type DeterministicPlanInput,
} from "@/features/plans/detailing/build";
import { addDays } from "@/features/plans/model/dates";
import { summarizeHistory } from "@/features/plans/history/summary";
import {
  resolveObjective,
  type ObjectiveRace,
} from "@/features/plans/skeleton/objective";
import { fitnessMeasures } from "@/features/progress/measures";
import {
  maximumVo2AgeDays,
  predictSeconds,
} from "@/features/progress/predictions";
import { fitnessRecords } from "@/features/progress/records";
import { loadHeartRateZones } from "@/server/activities/activities";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readGoals } from "@/server/onboarding/goals";
import { readProfile } from "@/server/onboarding/profile";
import { loadProgressHistory } from "@/server/progress/history";
import { readRaceCourses } from "@/server/races/courses";
import { readPlanningConstraints } from "./constraints";

export type PlanDraft = { today: string; plan: DeterministicPlan };

export type PlanningInput = {
  today: string;
  input: DeterministicPlanInput;
};

const thresholdMetrics = [
  "lactate_threshold_speed_mps",
  "lactate_threshold_heart_rate_bpm",
];

async function readGarminThreshold(context: OnboardingContext) {
  const { data, error } = await context.client
    .from("provider_observations")
    .select("metric, observed_on, value_numeric")
    .eq("user_id", context.userId)
    .eq("availability", "available")
    .in("metric", thresholdMetrics)
    .order("observed_on", { ascending: false })
    .limit(20);
  if (error) return null;
  const latest = (metric: string) =>
    (data ?? []).find(
      (row) =>
        row.metric === metric &&
        row.observed_on !== null &&
        row.value_numeric !== null &&
        Number(row.value_numeric) > 0,
    ) ?? null;
  const speed = latest("lactate_threshold_speed_mps");
  const heartRate = latest("lactate_threshold_heart_rate_bpm");
  const asOf = [speed?.observed_on, heartRate?.observed_on]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  if (!asOf) return null;
  const speedValue = speed ? Number(speed.value_numeric) : null;
  const heartRateValue = heartRate ? Number(heartRate.value_numeric) : null;
  return {
    speedMps:
      speedValue !== null && speedValue > 1 && speedValue < 8
        ? speedValue
        : null,
    heartRateBpm:
      heartRateValue !== null && heartRateValue >= 100 && heartRateValue <= 230
        ? Math.round(heartRateValue)
        : null,
    asOf,
  };
}

export const loadPlanningInput = cache(
  async (context: OnboardingContext): Promise<PlanningInput> => {
    const now = new Date();
    const { timeZone, maxWeeklyMinutes, unavailablePeriods } =
      await readPlanningConstraints(context);
    const constraints = { timeZone, maxWeeklyMinutes, unavailablePeriods };
    const today = localToday(constraints.timeZone, now);
    const [profile, goals, courses, history, zones, garmin] = await Promise.all(
      [
        readProfile(context),
        readGoals(context),
        readRaceCourses(context),
        loadProgressHistory(context, today),
        loadHeartRateZones(context, now),
        readGarminThreshold(context),
      ],
    );
    const races: ObjectiveRace[] = resolveRaceSnapshots(
      goals.races,
      courses,
    ).flatMap(({ id, values }) =>
      values.race_date && values.distance_km
        ? [
            {
              id,
              name: values.name ?? "Course sans nom",
              date: values.race_date,
              distanceKm: values.distance_km,
              elevationGainM: values.elevation_gain_m,
              kind: values.race_kind,
              priority: values.priority,
              targetSeconds: values.target_duration_seconds,
            },
          ]
        : [],
    );
    const measures = fitnessMeasures({
      activities: history.activities,
      laps: history.laps,
      vo2: history.vo2,
      zones,
      start: addDays(today, -90),
      today,
    });
    const recentStart = addDays(today, -180);
    const records = fitnessRecords(
      history.activities.filter((activity) => activity.day >= recentStart),
      history.laps,
    );
    const vo2 = [...history.vo2]
      .filter((item) => item.day <= today)
      .sort((first, second) => first.day.localeCompare(second.day))
      .at(-1);
    const primary = resolveObjective({
      races,
      today,
      history: summarizeHistory(history.activities, today),
    }).race;
    const freshVo2 =
      vo2 && vo2.day >= addDays(today, -maximumVo2AgeDays) ? vo2 : null;
    const optimisticSeconds =
      primary?.kind === "road" && freshVo2
        ? predictSeconds(freshVo2.value, primary.distanceKm * 1000)
        : null;
    const input: DeterministicPlanInput = {
      today,
      races,
      activities: history.activities,
      availability: {
        availableWeekdays: profile.values.available_weekdays,
        weekdaySessionMinutes: profile.values.weekday_session_minutes,
        longRunDay: profile.values.long_run_day,
        trainingAccess: profile.values.training_access ?? [],
      },
      constraints,
      targets: {
        flatLapThresholdPace:
          measures.threshold.value !== null
            ? { secondsPerKm: measures.threshold.value, asOf: today }
            : null,
        garminLactateThreshold: garmin,
        bestEfforts: records.efforts.map((effort) => ({
          meters: effort.key === "10k" ? 10_000 : 21_097.5,
          seconds: effort.seconds,
          asOf: effort.day,
        })),
        vo2Max: vo2 ? { value: vo2.value, asOf: vo2.day } : null,
        garminZones: null,
        strideZones: zones ? { zones: zones.zones, asOf: today } : null,
      },
      optimisticSeconds,
    };
    return { today, input };
  },
);

export const loadPlanDraft = cache(
  async (context: OnboardingContext): Promise<PlanDraft> => {
    const { today, input } = await loadPlanningInput(context);
    return { today, plan: buildDeterministicPlan(input) };
  },
);
