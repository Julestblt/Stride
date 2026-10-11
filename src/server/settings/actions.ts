"use server";

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
    !values.available_weekdays?.length
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

export async function saveSettingsRace(data: FormData) {
  const raw = {
    id: data.get("id"),
    revision: Number(data.get("revision")),
    values: {
      name: nullableText(data.get("name")),
      race_date: nullableText(data.get("race_date")),
      distance_km: nullableNumber(data.get("distance_km")),
      elevation_gain_m: nullableNumber(data.get("elevation_gain_m")),
      priority: data.get("priority"),
      target_duration_seconds: parseDuration(
        nullableText(data.get("target_duration")) ?? "",
      ),
    },
  };
  const parsed = raceSaveSchema.safeParse(raw);
  if (
    !parsed.success ||
    !raw.values.name ||
    !raw.values.race_date ||
    !raw.values.distance_km
  )
    redirect(resultPath("/settings/goals", "invalid"));
  const result = await saveRace({ context }, parsed.data);
  if (result.status === "saved") revalidatePath("/settings/goals");
  redirect(resultPath("/settings/goals", result.status));
}

export async function addSettingsRace(data: FormData) {
  const values = {
    name: nullableText(data.get("name")),
    race_date: nullableText(data.get("race_date")),
    distance_km: nullableNumber(data.get("distance_km")),
    elevation_gain_m: nullableNumber(data.get("elevation_gain_m")),
    priority: data.get("priority"),
    target_duration_seconds: parseDuration(
      nullableText(data.get("target_duration")) ?? "",
    ),
  };
  const check = raceSaveSchema.safeParse({
    id: "00000000-0000-4000-8000-000000000000",
    revision: 1,
    values,
  });
  if (
    !check.success ||
    !values.name ||
    !values.race_date ||
    !values.distance_km
  )
    redirect(resultPath("/settings/goals", "invalid"));
  const current = await context();
  if (!current) redirect(resultPath("/settings/goals", "session-expired"));
  const { count, error: countError } = await current.client
    .from("athlete_races")
    .select("id", { count: "exact", head: true })
    .eq("user_id", current.userId);
  if (countError) redirect(resultPath("/settings/goals", "error"));
  if ((count ?? 0) >= maxRaces)
    redirect(resultPath("/settings/goals", "invalid"));
  const { error } = await current.client
    .from("athlete_races")
    .insert({ user_id: current.userId, ...check.data.values });
  if (error) redirect(resultPath("/settings/goals", "error"));
  revalidatePath("/settings/goals");
  redirect(resultPath("/settings/goals", "saved"));
}

export async function removeSettingsRace(data: FormData) {
  const id = z.uuid().safeParse(data.get("id"));
  if (!id.success) redirect(resultPath("/settings/goals", "invalid"));
  const result = await deleteRaces({ context }, { ids: [id.data] });
  if (result.status === "deleted") revalidatePath("/settings/goals");
  redirect(resultPath("/settings/goals", result.status));
}
