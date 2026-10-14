import "server-only";
import { z } from "zod";
import {
  compactPlanSchema,
  compactToPlanState,
} from "@/features/plans/compact/compact";
import { localToday } from "@/features/plans/constraints";
import {
  buildDeterministicPlan,
  validateNewPlan,
} from "@/features/plans/detailing/build";
import { summarizeHistory } from "@/features/plans/history/summary";
import { planStateSchema } from "@/features/plans/model/plan";
import { addDays } from "@/features/plans/model/dates";
import { applyOperations } from "@/features/plans/operations/apply";
import { planOperationSchema } from "@/features/plans/operations/operations";
import type { RuleResult } from "@/features/plans/validation/report";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readPlanningConstraints } from "@/server/plans/constraints";
import { readProfile } from "@/server/onboarding/profile";
import { loadPlanningInput } from "@/server/plans/draft";
import { readSessionMatches } from "@/server/plans/matches";
import { readActivePlan } from "@/server/plans/stored";

export type ToolOutcome = { ok: boolean; content: unknown };

const isoDate = z.iso.date();

const readPlanInput = z.strictObject({ from: isoDate, to: isoDate });
const healthInput = z.strictObject({ days: z.number().int().min(1).max(42) });

const coachOperationSchema = planOperationSchema.refine((operation) =>
  ["skip_session", "move_session", "swap_sessions", "replace_session"].includes(
    operation.op,
  ),
);

const proposalInput = z.strictObject({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(2000),
  origin: z.enum(["training", "recovery", "performance", "schedule", "race"]),
  operations: z.array(coachOperationSchema).min(1).max(20),
  specialist_opinions: z
    .array(
      z.strictObject({
        specialist: z.literal("medical"),
        verdict: z.string().min(1).max(64),
        summary: z.string().min(1).max(1000),
      }),
    )
    .max(4),
});

function invalid(error: z.ZodError): ToolOutcome {
  return {
    ok: false,
    content: { error: "invalid_input", issues: z.flattenError(error) },
  };
}

async function readPlanRange(context: OnboardingContext, input: unknown) {
  const parsed = readPlanInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { from, to } = parsed.data;
  if (from > to || addDays(from, 42) < to)
    return { ok: false, content: { error: "range_too_large" } };
  const stored = await readActivePlan(context);
  if (!stored) return { ok: true, content: { plan: null } };
  const { plan, weeks, sessions } = stored.state;
  return {
    ok: true,
    content: {
      today: localToday(plan.timeZone),
      plan: {
        title: plan.title,
        startsOn: plan.startsOn,
        endsOn: plan.endsOn,
        timeZone: plan.timeZone,
        version: stored.activeVersion,
      },
      weeks: weeks.filter(
        (week) => week.weekStart <= to && addDays(week.weekStart, 6) >= from,
      ),
      sessions: sessions.filter(
        (session) => session.scheduledOn >= from && session.scheduledOn <= to,
      ),
    },
  };
}

async function readHealthReports(context: OnboardingContext, input: unknown) {
  const parsed = healthInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { timeZone } = await readPlanningConstraints(context);
  const today = localToday(timeZone);
  const { data, error } = await context.client
    .from("athlete_wellness_checkins")
    .select("checkin_date, legs, soreness, stress")
    .eq("user_id", context.userId)
    .gte("checkin_date", addDays(today, -parsed.data.days))
    .order("checkin_date", { ascending: false });
  if (error) throw new Error("Unable to read the wellness check-ins");
  return { ok: true, content: { today, checkins: data } };
}

function targetKeys(operations: z.infer<typeof proposalInput>["operations"]) {
  return operations.flatMap((operation) => {
    if (operation.op === "swap_sessions")
      return [operation.firstKey, operation.secondKey];
    if ("sessionKey" in operation) return [operation.sessionKey];
    return [];
  });
}

async function createPlanProposal(context: OnboardingContext, input: unknown) {
  const parsed = proposalInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const proposal = parsed.data;
  const stored = await readActivePlan(context);
  if (!stored) return { ok: false, content: { error: "no_active_plan" } };
  const matches = await readSessionMatches(context, stored.planId);
  const result = applyOperations(stored.state, proposal.operations, {
    today: localToday(stored.state.plan.timeZone),
    matchedSessionKeys: new Set(
      matches
        .filter((match) => match.status !== "dismissed")
        .map((match) => match.sessionKey),
    ),
  });
  if (!result.ok)
    return {
      ok: false,
      content: { error: "validation_failed", errors: result.errors },
    };
  const { data, error } = await context.client.rpc("submit_plan_proposal", {
    p_scope: "session",
    p_origin: proposal.origin,
    p_title: proposal.title,
    p_summary: proposal.summary,
    p_rationale: proposal.rationale,
    p_operations: proposal.operations,
    p_preview: result.changeset,
    p_plan_id: stored.planId,
    p_base_version: stored.activeVersion,
    p_specialist_opinions: proposal.specialist_opinions,
    p_target_keys: targetKeys(proposal.operations),
  });
  if (error) return { ok: false, content: { error: error.message } };
  return {
    ok: true,
    content: {
      proposalId: data.id,
      status: data.status,
      note: "The athlete must approve this proposal in the app.",
    },
  };
}

const contextInput = z.strictObject({});
const predictionMetrics = [
  "race_prediction_5k_seconds",
  "race_prediction_10k_seconds",
  "race_prediction_half_marathon_seconds",
  "race_prediction_marathon_seconds",
];
const submitPlanInput = z.strictObject({ plan: z.unknown() });

function ageOn(birthDate: string | null, today: string) {
  if (!birthDate) return null;
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years;
}

async function readAthleteContext(context: OnboardingContext, input: unknown) {
  const parsed = contextInput.safeParse(input ?? {});
  if (!parsed.success) return invalid(parsed.error);
  const [{ today, input: planning }, profile, stored] = await Promise.all([
    loadPlanningInput(context),
    readProfile(context),
    readActivePlan(context),
  ]);
  const { data: checkins } = await context.client
    .from("athlete_wellness_checkins")
    .select("checkin_date, legs, soreness, stress")
    .eq("user_id", context.userId)
    .gte("checkin_date", addDays(today, -14))
    .order("checkin_date", { ascending: false });
  const { data: predictions } = await context.client
    .from("provider_observations")
    .select("metric, observed_on, value_numeric")
    .eq("user_id", context.userId)
    .eq("availability", "available")
    .in("metric", predictionMetrics)
    .order("observed_on", { ascending: false })
    .limit(predictionMetrics.length * 4);
  const reference = buildDeterministicPlan(planning);
  const history = summarizeHistory(planning.activities, today);
  return {
    ok: true,
    content: {
      today,
      timeZone: planning.constraints.timeZone,
      athlete: {
        age: ageOn(profile.values.birth_date, today),
        sex: profile.values.sex,
        heightCm: profile.values.height_cm,
        weightKg: profile.values.weight_kg,
        primaryTerrain: profile.values.primary_terrain,
        trainingAccess: profile.values.training_access,
      },
      availability: {
        availableWeekdays: planning.availability.availableWeekdays,
        longRunDay: planning.availability.longRunDay,
        maxWeekdaySessionMinutes: planning.availability.weekdaySessionMinutes,
        maxWeeklyMinutes: planning.constraints.maxWeeklyMinutes,
        unavailablePeriods: planning.constraints.unavailablePeriods,
      },
      races: planning.races.filter((race) => race.date >= today),
      history: {
        weeks: history.weeks,
        held: history.held,
        heldPaceSecondsPerKm: history.heldPaceSecondsPerKm,
        longestRun30d: history.longestRun30d,
        runsLast30d: history.runsLast30d,
        trailShare: history.trailShare,
        sufficient: history.sufficient,
      },
      targets: reference.targets,
      garmin: {
        vo2Max: planning.targets.vo2Max,
        lactateThreshold: planning.targets.garminLactateThreshold,
        racePredictions: Object.fromEntries(
          predictionMetrics.map((metric) => {
            const latest = (predictions ?? []).find(
              (row) => row.metric === metric && row.value_numeric !== null,
            );
            return [
              metric.replace("race_prediction_", "").replace("_seconds", ""),
              latest
                ? {
                    seconds: Number(latest.value_numeric),
                    asOf: latest.observed_on,
                  }
                : null,
            ];
          }),
        ),
      },
      deterministicReference: {
        objectiveRaceId: reference.objective.race?.id ?? null,
        feasibility: reference.feasibility,
      },
      wellnessCheckins: checkins ?? [],
      activePlan: stored
        ? {
            title: stored.state.plan.title,
            startsOn: stored.state.plan.startsOn,
            endsOn: stored.state.plan.endsOn,
            version: stored.activeVersion,
          }
        : null,
    },
  };
}

function describeRule(result: RuleResult) {
  return {
    rule: result.ruleId,
    strong: result.strong,
    issues: result.issues,
    keys: result.keys.slice(0, 8),
    observed: result.observed,
    threshold: result.threshold,
  };
}

async function submitPlan(context: OnboardingContext, input: unknown) {
  const wrapper = submitPlanInput.safeParse(input);
  if (!wrapper.success) return invalid(wrapper.error);
  const parsed = compactPlanSchema.safeParse(wrapper.data.plan);
  if (!parsed.success)
    return {
      ok: false,
      content: {
        error: "invalid_plan",
        issues: parsed.error.issues.slice(0, 20).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  const compact = parsed.data;
  const { today, input: planning } = await loadPlanningInput(context);
  const state = compactToPlanState(compact, planning.constraints.timeZone);
  const shape = planStateSchema.safeParse(state);
  if (!shape.success)
    return {
      ok: false,
      content: {
        error: "invalid_plan",
        issues: shape.error.issues.slice(0, 20).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  const report = validateNewPlan(planning, shape.data);
  const failed = report.results.filter((result) => result.outcome === "fail");
  const blocking = failed.filter((result) => result.severity === "block");
  const warnings = failed
    .filter((result) => result.severity === "warn")
    .map(describeRule);
  if (blocking.length)
    return {
      ok: false,
      content: {
        error: "validation_failed",
        blocking: blocking.map(describeRule),
        warnings,
      },
    };
  const operations = [{ op: "create_plan" as const, state: shape.data }];
  const result = applyOperations(null, operations, {
    today,
    matchedSessionKeys: new Set(),
  });
  if (!result.ok)
    return {
      ok: false,
      content: { error: "validation_failed", errors: result.errors },
    };
  const { data, error } = await context.client.rpc("submit_plan_proposal", {
    p_scope: "new_plan",
    p_origin: "training",
    p_title: compact.title,
    p_summary: compact.summary.slice(0, 500),
    p_rationale: compact.summary,
    p_operations: operations,
    p_preview: result.changeset,
    p_target_keys: ["plan"],
  });
  if (error) return { ok: false, content: { error: error.message } };
  return {
    ok: true,
    content: {
      proposalId: data.id,
      weeks: shape.data.weeks.length,
      sessions: shape.data.sessions.length,
      warnings,
      note: "The athlete must approve this plan in the app before it is saved.",
    },
  };
}

const handlers: Record<
  string,
  (context: OnboardingContext, input: unknown) => Promise<ToolOutcome>
> = {
  read_athlete_context: readAthleteContext,
  submit_plan: submitPlan,
  read_active_plan: readPlanRange,
  read_health_reports: readHealthReports,
  create_plan_proposal: createPlanProposal,
};

export async function runCustomTool(
  context: OnboardingContext,
  name: string,
  input: unknown,
): Promise<ToolOutcome> {
  const handler = handlers[name];
  if (!handler) return { ok: false, content: { error: "unknown_tool", name } };
  try {
    return await handler(context, input);
  } catch {
    return { ok: false, content: { error: "tool_unavailable" } };
  }
}
