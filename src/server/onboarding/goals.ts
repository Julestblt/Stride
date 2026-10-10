import "server-only";
import {
  goalRowSchema,
  goalSaveSchema,
  maxRaces,
  raceIdsSchema,
  raceRowSchema,
  raceSaveSchema,
  raceSnapshot,
  type GoalValues,
  type GoalsSnapshot,
  type RaceSnapshot,
  type RaceValues,
  type RowSaveResult,
  type RowSnapshot,
} from "@/features/onboarding/goals";
import type { OnboardingContext } from "./context";

export type GoalsDependencies = {
  context: () => Promise<OnboardingContext | null>;
};
type Failure = { status: "invalid" | "error" | "session-expired" | "missing" };

async function readGoal(
  context: OnboardingContext,
): Promise<RowSnapshot<GoalValues> & { updatedAt: string | null }> {
  const { data, error } = await context.client
    .from("athlete_goals")
    .select("user_id, focus, revision, updated_at")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Unable to read goal");
  if (!data)
    return { values: { focus: null }, revision: null, updatedAt: null };
  const row = goalRowSchema.parse(data);
  return {
    values: { focus: row.focus },
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

async function readRace(
  context: OnboardingContext,
  id: string,
): Promise<RaceSnapshot | null> {
  const { data, error } = await context.client
    .from("athlete_races")
    .select("*")
    .eq("user_id", context.userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to read race");
  return data ? raceSnapshot(raceRowSchema.parse(data)) : null;
}

export async function readGoals(
  context: OnboardingContext,
): Promise<GoalsSnapshot> {
  const [goal, races] = await Promise.all([
    readGoal(context),
    context.client
      .from("athlete_races")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true }),
  ]);
  if (races.error) throw new Error("Unable to read races");
  return {
    goal,
    races: (races.data ?? []).map((row) =>
      raceSnapshot(raceRowSchema.parse(row)),
    ),
  };
}

function failure(code: string | undefined): Failure {
  return code === "23514" || code === "22P02" || code === "22007"
    ? { status: "invalid" }
    : { status: "error" };
}

export async function saveGoal(
  dependencies: GoalsDependencies,
  input: unknown,
): Promise<RowSaveResult<GoalValues>> {
  const parsed = goalSaveSchema.safeParse(input);
  if (!parsed.success || !parsed.data.values.focus)
    return { status: "invalid" };
  try {
    const context = await dependencies.context();
    if (!context) return { status: "session-expired" };
    const current = await readGoal(context);
    if (current.revision !== parsed.data.revision)
      return {
        status: "conflict",
        snapshot: { values: current.values, revision: current.revision },
      };
    const focus = parsed.data.values.focus;
    const response =
      current.revision === null
        ? await context.client
            .from("athlete_goals")
            .insert({ user_id: context.userId, focus })
            .select("user_id, focus, revision, updated_at")
            .maybeSingle()
        : await context.client
            .from("athlete_goals")
            .update({ focus })
            .eq("user_id", context.userId)
            .eq("revision", current.revision)
            .select("user_id, focus, revision, updated_at")
            .maybeSingle();
    if (response.error)
      return response.error.code === "23505"
        ? { status: "conflict", snapshot: await goalSnapshot(context) }
        : failure(response.error.code);
    if (!response.data)
      return { status: "conflict", snapshot: await goalSnapshot(context) };
    const row = goalRowSchema.parse(response.data);
    return {
      status: "saved",
      snapshot: { values: { focus: row.focus }, revision: row.revision },
    };
  } catch {
    return { status: "error" };
  }
}

export async function saveRace(
  dependencies: GoalsDependencies,
  input: unknown,
): Promise<RowSaveResult<RaceValues>> {
  const parsed = raceSaveSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  try {
    const context = await dependencies.context();
    if (!context) return { status: "session-expired" };
    const response = await context.client
      .from("athlete_races")
      .update(parsed.data.values)
      .eq("user_id", context.userId)
      .eq("id", parsed.data.id)
      .eq("revision", parsed.data.revision)
      .select("*")
      .maybeSingle();
    if (response.error) return failure(response.error.code);
    if (response.data) {
      const { values, revision } = raceSnapshot(
        raceRowSchema.parse(response.data),
      );
      return { status: "saved", snapshot: { values, revision } };
    }
    const latest = await readRace(context, parsed.data.id);
    return latest
      ? {
          status: "conflict",
          snapshot: { values: latest.values, revision: latest.revision },
        }
      : { status: "missing" };
  } catch {
    return { status: "error" };
  }
}

export async function createRace(
  dependencies: GoalsDependencies,
): Promise<{ status: "created"; race: RaceSnapshot } | Failure> {
  try {
    const context = await dependencies.context();
    if (!context) return { status: "session-expired" };
    const { count, error } = await context.client
      .from("athlete_races")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    if (error) return { status: "error" };
    if ((count ?? 0) >= maxRaces) return { status: "invalid" };
    const response = await context.client
      .from("athlete_races")
      .insert({ user_id: context.userId })
      .select("*")
      .single();
    if (response.error) return failure(response.error.code);
    return {
      status: "created",
      race: raceSnapshot(raceRowSchema.parse(response.data)),
    };
  } catch {
    return { status: "error" };
  }
}

export async function deleteRaces(
  dependencies: GoalsDependencies,
  input: unknown,
): Promise<{ status: "deleted" } | Failure> {
  const parsed = raceIdsSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  try {
    const context = await dependencies.context();
    if (!context) return { status: "session-expired" };
    const { error } = await context.client
      .from("athlete_races")
      .delete()
      .eq("user_id", context.userId)
      .in("id", parsed.data.ids);
    return error ? { status: "error" } : { status: "deleted" };
  } catch {
    return { status: "error" };
  }
}

async function goalSnapshot(
  context: OnboardingContext,
): Promise<RowSnapshot<GoalValues>> {
  const { values, revision } = await readGoal(context);
  return { values, revision };
}
