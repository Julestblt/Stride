import "server-only";
import type {
  InsightActivity,
  InsightObservation,
} from "@/features/insights/facts";
import type { OnboardingContext } from "@/server/onboarding/context";

const runningTypes = [
  "running",
  "treadmill_running",
  "track_running",
  "trail_running",
  "ultra_run",
];
const recoveryMetrics = [
  "hrv_last_night_ms",
  "resting_heart_rate_bpm",
  "sleep_duration_seconds",
];
const activityColumns =
  "started_at, local_started_at, activity_type, distance_meters, duration_seconds, elevation_gain_meters";
const activityPageSize = 1000;
type ActivityRow = {
  started_at: string | null;
  local_started_at: string | null;
  activity_type: string | null;
  distance_meters: number | string | null;
  duration_seconds: number | string | null;
  elevation_gain_meters: number | string | null;
};

function number(value: number | string | null) {
  const parsed = value === null ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function activity(row: ActivityRow): InsightActivity | null {
  if (!row.started_at || !row.activity_type) return null;
  return {
    startedAt: row.started_at,
    localStartedAt: row.local_started_at,
    type: row.activity_type,
    distanceMeters: number(row.distance_meters),
    durationSeconds: number(row.duration_seconds),
    elevationGainMeters: number(row.elevation_gain_meters),
  };
}

async function loadActivities(context: OnboardingContext, year: string) {
  const rows: ActivityRow[] = [];
  for (let offset = 0; ; offset += activityPageSize) {
    const page = await context.client
      .from("provider_activities")
      .select(activityColumns)
      .eq("user_id", context.userId)
      .gte("started_at", year)
      .order("started_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + activityPageSize - 1);
    if (page.error) throw new Error("Unable to read imported history");
    const data = page.data ?? [];
    rows.push(...data);
    if (data.length < activityPageSize) return rows;
  }
}

export async function loadHistoryContext(
  context: OnboardingContext,
  today: Date,
) {
  const year = new Date(today.getTime() - 365 * 86_400_000).toISOString();
  const month = new Date(today.getTime() - 28 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [activities, longest, observations] = await Promise.all([
    loadActivities(context, year),
    context.client
      .from("provider_activities")
      .select(activityColumns)
      .eq("user_id", context.userId)
      .in("activity_type", runningTypes)
      .not("distance_meters", "is", null)
      .order("distance_meters", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.client
      .from("provider_observations")
      .select("metric, observed_on, value_numeric")
      .eq("user_id", context.userId)
      .eq("availability", "available")
      .in("metric", recoveryMetrics)
      .gte("observed_on", month)
      .limit(500),
  ]);
  if (longest.error || observations.error)
    throw new Error("Unable to read imported history");
  return {
    activities: activities
      .map(activity)
      .filter((item): item is InsightActivity => item !== null),
    longest: longest.data ? activity(longest.data) : null,
    observations: (observations.data ?? []).flatMap(
      (row): InsightObservation[] => {
        const value = number(row.value_numeric);
        return row.metric && row.observed_on && value !== null
          ? [{ metric: row.metric, observedOn: row.observed_on, value }]
          : [];
      },
    ),
  };
}
