import "server-only";
import {
  conditionReports,
  planningHealth,
  readinessDays,
  type PlanningHealth,
  type StoredCondition,
} from "@/features/plans/health/health";
import { addDays } from "@/features/plans/model/dates";
import type { OnboardingContext } from "@/server/onboarding/context";

export const conditionColumns =
  "id, kind, body_area, severity, started_on, status, resolved_on, worsening, systemic_symptoms, red_flag, note";

export async function readConditionReports(
  context: OnboardingContext,
  resolvedSince: string | null,
): Promise<StoredCondition[]> {
  const query = context.client
    .from("athlete_condition_reports")
    .select(conditionColumns)
    .eq("user_id", context.userId);
  const { data, error } = await (
    resolvedSince
      ? query.or(`status.neq.resolved,resolved_on.gte.${resolvedSince}`)
      : query.neq("status", "resolved")
  )
    .order("started_on", { ascending: false })
    .limit(50);
  if (error) throw new Error("Unable to read the condition reports");
  return conditionReports(data ?? []);
}

async function readReadinessScores(context: OnboardingContext, today: string) {
  const { data, error } = await context.client
    .from("provider_observations")
    .select("observed_on, value_numeric")
    .eq("user_id", context.userId)
    .eq("metric", "training_readiness")
    .in("availability", ["available", "partial"])
    .gte("observed_on", addDays(today, -1))
    .lte("observed_on", today);
  if (error) return [];
  return (data ?? []).flatMap((row) => {
    const value = row.value_numeric === null ? NaN : Number(row.value_numeric);
    return row.observed_on && Number.isFinite(value)
      ? [{ day: row.observed_on, value }]
      : [];
  });
}

export async function readPlanningHealth(
  context: OnboardingContext,
  today: string,
): Promise<PlanningHealth> {
  const [conditions, scores] = await Promise.all([
    readConditionReports(context, null),
    readReadinessScores(context, today),
  ]);
  return planningHealth(conditions, readinessDays(scores, today));
}
