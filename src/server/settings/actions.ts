"use server";

import { persistSettingsProfile } from "@/server/settings/profile";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  profileSaveSchema,
  type ProfilePatch,
} from "@/features/onboarding/profile";
import { changedProfileSources } from "@/features/settings/profile";
import {
  goalFocuses,
  maxRaces,
  parseDuration,
  raceSaveSchema,
} from "@/features/onboarding/goals";
import { getOnboardingContext } from "@/server/onboarding/context";
import { deleteRaces, saveGoal, saveRace } from "@/server/onboarding/goals";
import { readProfile, saveProfile } from "@/server/onboarding/profile";

const revisionSchema = z.coerce.number().int().positive();
const nullableText = (value: FormDataEntryValue | null) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const nullableNumber = (value: FormDataEntryValue | null) => {
  const text = nullableText(value);
  return text === null ? null : Number(text);
};

const clockPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function planValues(data: FormData) {
  const start = nullableText(data.get("start_time"));
  const cutoff = parseDuration(nullableText(data.get("cutoff_duration")) ?? "");
  return {
    start: start !== null && clockPattern.test(start) ? `${start}:00` : null,
    cutoff: cutoff ?? null,
  };
}

async function savePlanValues(
  current: NonNullable<Awaited<ReturnType<typeof context>>>,
  raceId: string,
  plan: ReturnType<typeof planValues>,
) {
  const { error } = await current.client.from("race_plans").upsert(
    {
      race_id: raceId,
      user_id: current.userId,
      start_time: plan.start,
      start_time_confirmed: plan.start !== null,
      cutoff_duration_seconds: plan.cutoff,
    },
    { onConflict: "race_id" },
  );
  return !error;
}

async function context() {
  return getOnboardingContext({ writable: true });
}

function resultPath(path: string, status: string) {
  return `${path}?status=${encodeURIComponent(status)}`;
}

export async function saveSettingsProfile(data: FormData) {
  const values: ProfilePatch = {
    first_name: nullableText(data.get("first_name")),
    birth_date: nullableText(data.get("birth_date")),
    sex: nullableText(data.get("sex")) as ProfilePatch["sex"],
    height_cm: nullableNumber(data.get("height_cm")),
    weight_kg: nullableNumber(data.get("weight_kg")),
  };
  if (Object.values(values).some((value) => value === null))
    redirect(resultPath("/settings/profile", "invalid"));
  await commitProfile(data, values, "/settings/profile");
}

export async function saveSettingsTraining(data: FormData) {
  const values: ProfilePatch = {
    primary_terrain: nullableText(
      data.get("primary_terrain"),
    ) as ProfilePatch["primary_terrain"],
    available_weekdays: data.getAll("available_weekdays").map(Number),
    long_run_day: nullableText(
      data.get("long_run_day"),
    ) as ProfilePatch["long_run_day"],
    weekday_session_minutes: nullableNumber(
      data.get("weekday_session_minutes"),
    ) as ProfilePatch["weekday_session_minutes"],
    training_access: data
      .getAll("training_access")
      .map(String) as ProfilePatch["training_access"],
  };
  if (
    !values.primary_terrain ||
    !values.long_run_day ||
    !values.weekday_session_minutes ||
    !values.available_weekdays?.length ||
    values.available_weekdays.length > 5
  )
    redirect(resultPath("/settings/training", "invalid"));
  await commitProfile(data, values, "/settings/training");
}

async function commitProfile(
  data: FormData,
  values: ProfilePatch,
  path: string,
) {
  const revision = revisionSchema.safeParse(data.get("revision"));
  const currentContext = await context();
  if (!currentContext) redirect(resultPath(path, "session-expired"));
  const current = await readProfile(currentContext).catch(() => null);
  if (!current) redirect(resultPath(path, "error"));
  if (current.revision !== (revision.success ? revision.data : null))
    redirect(resultPath(path, "conflict"));
  const parsed = profileSaveSchema.safeParse({
    values,
    revision: revision.success ? revision.data : null,
    sources: changedProfileSources(values, current.values),
  });
  if (!parsed.success) redirect(resultPath(path, "invalid"));
  const result = await saveProfile({ context }, parsed.data);
  if (result.status === "saved") revalidatePath(path);
  redirect(resultPath(path, result.status));
}

export async function saveSettingsGoal(data: FormData) {
  const parsed = z
    .object({ focus: z.enum(goalFocuses), revision: revisionSchema })
    .safeParse({ focus: data.get("focus"), revision: data.get("revision") });
  if (!parsed.success) redirect(resultPath("/settings/goals", "invalid"));
  const result = await saveGoal(
    { context },
    { values: { focus: parsed.data.focus }, revision: parsed.data.revision },
  );
  if (result.status === "saved") revalidatePath("/settings/goals");
  redirect(resultPath("/settings/goals", result.status));
}

export type RaceSubmitResult =
  | { status: "saved"; id: string }
  | {
      status: "invalid" | "conflict" | "missing" | "error" | "session-expired";
    };

function raceFormValues(data: FormData) {
  return {
    race_kind: data.get("race_kind"),
    name: nullableText(data.get("name")),
    race_date: nullableText(data.get("race_date")),
    distance_km: nullableNumber(data.get("distance_km")),
    elevation_gain_m: nullableNumber(data.get("elevation_gain_m")),
    priority: data.get("priority"),
    target_duration_seconds: parseDuration(
      nullableText(data.get("target_duration")) ?? "",
    ),
  };
}

export async function submitSettingsRace(
  data: FormData,
): Promise<RaceSubmitResult> {
  const values = raceFormValues(data);
  const id = nullableText(data.get("id"));
  const check = raceSaveSchema.safeParse({
    id: id ?? "00000000-0000-4000-8000-000000000000",
    revision: id ? Number(data.get("revision")) : 1,
    values,
  });
  if (
    !check.success ||
    !values.name ||
    !values.race_date ||
    !values.distance_km
  )
    return { status: "invalid" };
  const current = await context();
  if (!current) return { status: "session-expired" };
  const plan = planValues(data);
  if (id) {
    const result = await saveRace({ context }, check.data);
    if (result.status !== "saved") return { status: result.status };
    if (!(await savePlanValues(current, id, plan))) return { status: "error" };
    revalidatePath("/settings/goals");
    return { status: "saved", id };
  }
  const { count, error: countError } = await current.client
    .from("athlete_races")
    .select("id", { count: "exact", head: true })
    .eq("user_id", current.userId);
  if (countError) return { status: "error" };
  if ((count ?? 0) >= maxRaces) return { status: "invalid" };
  const { data: created, error } = await current.client
    .from("athlete_races")
    .insert({ user_id: current.userId, ...check.data.values })
    .select("id")
    .single();
  if (error) return { status: "error" };
  if (
    (plan.start !== null || plan.cutoff !== null) &&
    !(await savePlanValues(current, created.id, plan))
  )
    return { status: "error" };
  revalidatePath("/settings/goals");
  return { status: "saved", id: created.id };
}

export async function removeSettingsRace(data: FormData) {
  const id = z.uuid().safeParse(data.get("id"));
  if (!id.success) redirect(resultPath("/settings/goals", "invalid"));
  const result = await deleteRaces({ context }, { ids: [id.data] });
  if (result.status === "deleted") revalidatePath("/settings/goals");
  redirect(resultPath("/settings/goals", result.status));
}

export async function updateSettingsProfile(data: FormData) {
  const current = await context();
  if (!current)
    return {
      status: "session-expired" as const,
      message: "Ta session a expiré. Reconnecte-toi.",
    };
  try {
    const input: unknown = JSON.parse(String(data.get("profile")));
    const file = data.get("photo");
    const result = await persistSettingsProfile(
      current,
      input,
      file instanceof File && file.size > 0 ? file : null,
    );
    if (result.status === "saved") {
      revalidatePath("/settings/profile");
      revalidatePath("/activities");
      revalidatePath("/onboarding");
    }
    return result;
  } catch {
    return {
      status: "error" as const,
      message: "Impossible d’enregistrer ton profil. Réessaie.",
    };
  }
}
