export const runningActivityTypes = [
  "running",
  "treadmill_running",
  "track_running",
  "trail_running",
  "ultra_run",
];
export type RunningMaximumActivity = {
  provider: string;
  activityType: string;
  startedAt: string;
  maximum: number | null;
};
export function eligibleRunningMaximum(
  activity: RunningMaximumActivity,
  now: Date,
) {
  const startedAt = Date.parse(activity.startedAt);
  return (
    activity.provider === "garmin" &&
    runningActivityTypes.includes(activity.activityType) &&
    Number.isFinite(startedAt) &&
    startedAt <= now.getTime() &&
    startedAt >= now.getTime() - 365 * 86_400_000 &&
    activity.maximum !== null &&
    Number.isInteger(activity.maximum) &&
    activity.maximum >= 100 &&
    activity.maximum <= 230
  );
}
export function effectiveRunningMaximum(
  override: number | null,
  observed: number | null,
) {
  return override ?? observed;
}
