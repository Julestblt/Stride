import "server-only";
import { z } from "zod";
import { addDays, mondayOf } from "@/features/plans/model/dates";
import type { PlanState } from "@/features/plans/model/plan";
import {
  nutritionForDay,
  type NutritionHealthFlag,
  type NutritionProfile,
  type NutritionRace,
  type NutritionResult,
  type NutritionSession,
} from "@/features/nutrition/calculator";
import type { PlanningHealth } from "@/features/plans/health/health";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readPlanningHealth } from "@/server/plans/health";
import { readActivePlan } from "@/server/plans/stored";

const raceRowSchema = z.object({
  race_date: z.string().nullable(),
  distance_km: z.number().nullable(),
  elevation_gain_m: z.number().nullable(),
  race_kind: z.enum(["road", "trail"]),
  target_duration_seconds: z.number().nullable(),
});

export type NutritionInputs = {
  profile: NutritionProfile;
  plan: PlanState | null;
  races: NutritionRace[];
  health: PlanningHealth;
};

export function healthFlagsOf(health: PlanningHealth): NutritionHealthFlag[] {
  const flags = new Set<NutritionHealthFlag>();
  for (const condition of health.conditions) {
    if (condition.status === "resolved") continue;
    if (condition.kind === "illness") flags.add("illness");
    if (condition.kind === "fatigue") flags.add("fatigue");
    if (condition.kind === "pain" && condition.severity >= 4)
      flags.add("injury");
  }
  if (health.readiness.some((day) => day.level === "red"))
    flags.add("poor_readiness");
  return [...flags];
}

function sessionsOn(plan: PlanState | null, date: string): NutritionSession[] {
  return (plan?.sessions ?? [])
    .filter(
      (session) =>
        session.scheduledOn === date &&
        session.sport !== "rest" &&
        session.kind !== "rest",
    )
    .map((session) => ({
      sport: session.sport,
      kind: session.kind,
      isKey: session.isKey,
      durationSeconds: session.targets.durationSeconds || undefined,
      distanceKm:
        session.targets.distanceMeters === null
          ? undefined
          : session.targets.distanceMeters / 1000,
      elevationGainM: session.targets.elevationGainMeters ?? undefined,
    }));
}

function weekTypeOn(plan: PlanState | null, date: string) {
  const week = plan?.weeks.find((item) => item.weekStart === mondayOf(date));
  return week?.weekType === "taper" || week?.weekType === "race"
    ? week.weekType
    : null;
}

export function nutritionDays(
  inputs: NutritionInputs,
  from: string,
  days: number,
  deficitRequested: boolean,
): NutritionResult[] {
  const healthFlags = healthFlagsOf(inputs.health);
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(from, index);
    return nutritionForDay({
      date,
      profile: inputs.profile,
      sessions: sessionsOn(inputs.plan, date),
      races: inputs.races,
      deficitRequested,
      weekType: weekTypeOn(inputs.plan, date),
      healthFlags,
    });
  });
}

export async function readNutritionInputs(
  context: OnboardingContext,
  today: string,
): Promise<NutritionInputs> {
  const [profile, races, stored, health] = await Promise.all([
    context.client
      .from("athlete_profiles")
      .select("birth_date, sex, height_cm, weight_kg")
      .eq("user_id", context.userId)
      .maybeSingle(),
    context.client
      .from("athlete_races")
      .select(
        "race_date, distance_km, elevation_gain_m, race_kind, target_duration_seconds",
      )
      .eq("user_id", context.userId)
      .gte("race_date", addDays(today, -1)),
    readActivePlan(context),
    readPlanningHealth(context, today),
  ]);
  if (profile.error || races.error)
    throw new Error("Unable to read the nutrition inputs");
  return {
    profile: {
      birthDate: profile.data?.birth_date ?? null,
      sex: profile.data?.sex ?? null,
      heightCm: profile.data?.height_cm ?? null,
      weightKg: profile.data?.weight_kg ?? null,
    },
    plan: stored?.state ?? null,
    races: z
      .array(raceRowSchema)
      .parse(races.data)
      .flatMap((race) =>
        race.race_date
          ? [
              {
                date: race.race_date,
                sport: race.race_kind === "road" ? "run" : "trail",
                distanceKm: race.distance_km ?? undefined,
                elevationGainM: race.elevation_gain_m ?? undefined,
                expectedDurationSeconds:
                  race.target_duration_seconds ?? undefined,
              } satisfies NutritionRace,
            ]
          : [],
      ),
    health,
  };
}

export const nutritionPageDays = 7;

export async function loadNutrition(context: OnboardingContext, today: string) {
  const inputs = await readNutritionInputs(context, today);
  const last = addDays(today, nutritionPageDays - 1);
  return {
    results: nutritionDays(inputs, today, nutritionPageDays, false),
    sessions: (inputs.plan?.sessions ?? [])
      .filter(
        (session) =>
          session.scheduledOn >= today &&
          session.scheduledOn <= last &&
          session.sport !== "rest" &&
          session.kind !== "rest",
      )
      .map((session) => ({
        date: session.scheduledOn,
        title: session.title,
        durationSeconds: session.targets.durationSeconds,
      })),
  };
}
