import "server-only";
import {
  loadPoints,
  observationSchema,
  progressActivityColumns,
  progressActivitySchema,
  progressLapColumns,
  progressLapSchema,
  type ProgressHistory,
  type ProgressLap,
  type ProgressRace,
} from "@/features/progress/history";
import { addDays } from "@/features/progress/period";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readGoals } from "@/server/onboarding/goals";

const pageSize = 1000;
const fitnessMetrics = [
  "training_load_acute",
  "training_load_chronic",
  "vo2_max",
];

async function readAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await page(offset, offset + pageSize - 1);
    if (error) throw new Error("Unable to read progress history");
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) return rows;
  }
}

async function readRaces(context: OnboardingContext): Promise<ProgressRace[]> {
  const goals = await readGoals(context).catch(() => null);
  return (goals?.races ?? []).flatMap(({ id, values }) =>
    values.race_date
      ? [
          {
            id,
            name: values.name ?? "Course sans nom",
            day: values.race_date,
            kind: values.race_kind,
            distanceKm: values.distance_km,
            priority: values.priority,
          },
        ]
      : [],
  );
}

export async function loadProgressHistory(
  context: OnboardingContext,
  today: string,
): Promise<ProgressHistory> {
  const since = addDays(today, -400);
  const [activityRows, lapRows, observationRows, races] = await Promise.all([
    readAll((from, to) =>
      context.client
        .from("provider_activities")
        .select(progressActivityColumns)
        .eq("user_id", context.userId)
        .not("started_at", "is", null)
        .order("started_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    readAll((from, to) =>
      context.client
        .from("provider_activity_segments")
        .select(progressLapColumns)
        .eq("user_id", context.userId)
        .eq("segment_type", "lap")
        .order("activity_id", { ascending: true })
        .order("segment_index", { ascending: true })
        .range(from, to),
    ),
    readAll((from, to) =>
      context.client
        .from("provider_observations")
        .select("metric, observed_on, value_numeric")
        .eq("user_id", context.userId)
        .in("metric", fitnessMetrics)
        .in("availability", ["available", "partial"])
        .gte("observed_on", since)
        .order("observed_on", { ascending: true })
        .order("metric", { ascending: true })
        .range(from, to),
    ),
    readRaces(context),
  ]);
  const observations = observationRows.flatMap((row) => {
    const parsed = observationSchema.safeParse(row);
    return parsed.success && parsed.data ? [parsed.data] : [];
  });
  return {
    activities: activityRows.flatMap((row) => {
      const parsed = progressActivitySchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    }),
    laps: lapRows.flatMap((row): ProgressLap[] => {
      const parsed = progressLapSchema.safeParse(row);
      return parsed.success && parsed.data ? [parsed.data] : [];
    }),
    load: loadPoints(observations),
    vo2: observations
      .filter((item) => item.metric === "vo2_max")
      .map(({ day, value }) => ({ day, value })),
    races,
  };
}
