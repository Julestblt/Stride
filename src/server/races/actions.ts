"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  checklistInputSchema,
  checklistLists,
  checklistTemplateFor,
} from "@/features/races/checklists";
import { clockToSql } from "@/features/races/format";
import { planInputSchema } from "@/features/races/race";
import { raceValueSchemas, type RaceKind } from "@/features/onboarding/goals";
import { waypointInputSchema } from "@/features/races/waypoints";
import { saveRace } from "@/server/onboarding/goals";
import { getOnboardingContext } from "@/server/onboarding/context";
import { importActivity } from "./course";

export type ActionResult =
  | { status: "saved" }
  | {
      status:
        | "invalid"
        | "conflict"
        | "missing"
        | "error"
        | "session-expired"
        | "no-track";
    };

const idSchema = z.uuid();

async function context() {
  return getOnboardingContext({ writable: true });
}

function refresh(raceId: string) {
  revalidatePath(`/races/${raceId}`, "layout");
}

export async function saveRacePlan(
  raceId: string,
  revision: number | null,
  input: unknown,
): Promise<ActionResult> {
  const id = idSchema.safeParse(raceId);
  const parsed = planInputSchema.partial().safeParse(input);
  if (!id.success || !parsed.success) return { status: "invalid" };
  const current = await context();
  if (!current) return { status: "session-expired" };
  const values = parsed.data;
  const row = {
    ...(values.startMinutes !== undefined && {
      start_time:
        values.startMinutes === null ? null : clockToSql(values.startMinutes),
    }),
    ...(values.startConfirmed !== undefined && {
      start_time_confirmed: values.startConfirmed,
    }),
    ...(values.ambitiousSeconds !== undefined && {
      ambitious_duration_seconds: values.ambitiousSeconds,
    }),
    ...(values.cautiousSeconds !== undefined && {
      cautious_duration_seconds: values.cautiousSeconds,
    }),
    ...(values.cutoffSeconds !== undefined && {
      cutoff_duration_seconds: values.cutoffSeconds,
    }),
    ...(values.labels !== undefined && { labels: values.labels }),
    ...(values.walkGradePercent !== undefined && {
      walk_grade_percent: values.walkGradePercent,
    }),
    ...(values.walkPaceSecondsPerKm !== undefined && {
      walk_pace_seconds_per_km: values.walkPaceSecondsPerKm,
    }),
    ...(values.aidStopSeconds !== undefined && {
      aid_stop_seconds: values.aidStopSeconds,
    }),
    ...(values.waterStopSeconds !== undefined && {
      water_stop_seconds: values.waterStopSeconds,
    }),
    ...(values.carbsPerHourG !== undefined && {
      carbs_per_hour_g: values.carbsPerHourG,
    }),
    ...(values.waterMlPerHour !== undefined && {
      water_ml_per_hour: values.waterMlPerHour,
    }),
    ...(values.sodiumMgPerHour !== undefined && {
      sodium_mg_per_hour: values.sodiumMgPerHour,
    }),
    ...(values.alarmMinutes !== undefined && {
      nutrition_alarm_minutes: values.alarmMinutes,
    }),
    ...(values.nightCaffeine !== undefined && {
      night_caffeine: values.nightCaffeine,
    }),
  };
  try {
    const response =
      revision === null
        ? await current.client
            .from("race_plans")
            .insert({ race_id: id.data, user_id: current.userId, ...row })
            .select("revision")
            .maybeSingle()
        : await current.client
            .from("race_plans")
            .update(row)
            .eq("user_id", current.userId)
            .eq("race_id", id.data)
            .eq("revision", revision)
            .select("revision")
            .maybeSingle();
    if (response.error)
      return response.error.code === "23505"
        ? { status: "conflict" }
        : { status: "error" };
    if (!response.data) return { status: "conflict" };
    refresh(id.data);
    return { status: "saved" };
  } catch {
    return { status: "error" };
  }
}

export async function saveRaceTarget(
  raceId: string,
  revision: number,
  targetSeconds: number | null,
  kind: RaceKind,
): Promise<ActionResult> {
  const result = await saveRace(
    { context },
    {
      id: raceId,
      revision,
      values: { target_duration_seconds: targetSeconds, race_kind: kind },
    },
  );
  if (result.status === "saved") {
    refresh(raceId);
    revalidatePath("/settings/goals");
    return { status: "saved" };
  }
  return { status: result.status };
}

function waypointRow(input: z.infer<typeof waypointInputSchema>) {
  return {
    kind: input.kind,
    name: input.name,
    distance_m: Math.round(input.distanceM * 10) / 10,
    cutoff_time:
      input.cutoffMinutes === null ? null : clockToSql(input.cutoffMinutes),
    services: input.services,
    watch_label: input.watchLabel,
    alert_distance_m: input.alertDistanceM,
    voice_note: input.voiceNote || null,
    todo: input.todo || null,
    nutrition_note: input.nutritionNote || null,
    needs_review: false,
  };
}

export async function saveWaypoint(
  raceId: string,
  waypointId: string | null,
  input: unknown,
): Promise<ActionResult & { id?: string }> {
  const race = idSchema.safeParse(raceId);
  const parsed = waypointInputSchema.safeParse(input);
  if (!race.success || !parsed.success) return { status: "invalid" };
  const current = await context();
  if (!current) return { status: "session-expired" };
  try {
    if (waypointId === null) {
      const response = await current.client
        .from("race_waypoints")
        .insert({
          race_id: race.data,
          user_id: current.userId,
          source: "athlete",
          ...waypointRow(parsed.data),
        })
        .select("id")
        .single();
      if (response.error) return { status: "error" };
      refresh(race.data);
      return { status: "saved", id: response.data.id };
    }
    const id = idSchema.safeParse(waypointId);
    if (!id.success) return { status: "invalid" };
    const response = await current.client
      .from("race_waypoints")
      .update(waypointRow(parsed.data))
      .eq("user_id", current.userId)
      .eq("race_id", race.data)
      .eq("id", id.data)
      .select("id")
      .maybeSingle();
    if (response.error) return { status: "error" };
    if (!response.data) return { status: "missing" };
    refresh(race.data);
    return { status: "saved", id: response.data.id };
  } catch {
    return { status: "error" };
  }
}

export async function saveWaypointNote(
  raceId: string,
  waypointId: string,
  field: "todo" | "nutritionNote",
  value: string,
): Promise<ActionResult> {
  const race = idSchema.safeParse(raceId);
  const id = idSchema.safeParse(waypointId);
  const text = z
    .string()
    .trim()
    .max(field === "todo" ? 400 : 280)
    .safeParse(value);
  if (!race.success || !id.success || !text.success)
    return { status: "invalid" };
  const current = await context();
  if (!current) return { status: "session-expired" };
  const response = await current.client
    .from("race_waypoints")
    .update(
      field === "todo"
        ? { todo: text.data || null }
        : { nutrition_note: text.data || null },
    )
    .eq("user_id", current.userId)
    .eq("race_id", race.data)
    .eq("id", id.data)
    .select("id")
    .maybeSingle();
  if (response.error) return { status: "error" };
  if (!response.data) return { status: "missing" };
  refresh(race.data);
  return { status: "saved" };
}

export async function deleteWaypoint(
  raceId: string,
  waypointId: string,
): Promise<ActionResult> {
  const race = idSchema.safeParse(raceId);
  const id = idSchema.safeParse(waypointId);
  if (!race.success || !id.success) return { status: "invalid" };
  const current = await context();
  if (!current) return { status: "session-expired" };
  const { error } = await current.client
    .from("race_waypoints")
    .delete()
    .eq("user_id", current.userId)
    .eq("race_id", race.data)
    .eq("id", id.data)
    .in("kind", ["aid", "water", "base", "summit", "caution", "instruction"]);
  if (error) return { status: "error" };
  refresh(race.data);
  return { status: "saved" };
}

const listSchema = z.enum(checklistLists);

export async function addChecklistItem(
  raceId: string,
  list: string,
  input: unknown,
): Promise<ActionResult> {
  const race = idSchema.safeParse(raceId);
  const parsedList = listSchema.safeParse(list);
  const parsed = checklistInputSchema.safeParse(input);
  if (!race.success || !parsedList.success || !parsed.success)
    return { status: "invalid" };
  const current = await context();
  if (!current) return { status: "session-expired" };
  const count = await current.client
    .from("race_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", current.userId)
    .eq("race_id", race.data)
    .eq("list", parsedList.data);
  if (count.error) return { status: "error" };
  if ((count.count ?? 0) >= 60) return { status: "invalid" };
  const { error } = await current.client.from("race_checklist_items").insert({
    race_id: race.data,
    user_id: current.userId,
    list: parsedList.data,
    label: parsed.data.label,
    detail: parsed.data.detail || null,
    status: parsed.data.status,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    position: count.count ?? 0,
    checked: parsed.data.status === "ready",
  });
  if (error) return { status: error.code === "23514" ? "invalid" : "error" };
  refresh(race.data);
  return { status: "saved" };
}

export async function updateChecklistItem(
  raceId: string,
  itemId: string,
  input: unknown,
): Promise<ActionResult> {
  const race = idSchema.safeParse(raceId);
  const id = idSchema.safeParse(itemId);
  const parsed = checklistInputSchema
    .extend({ checked: z.boolean(), shoeId: z.uuid().nullable() })
    .partial()
    .safeParse(input);
  if (!race.success || !id.success || !parsed.success)
    return { status: "invalid" };
  const current = await context();
  if (!current) return { status: "session-expired" };
  const values = parsed.data;
  const { data, error } = await current.client
    .from("race_checklist_items")
    .update({
      ...(values.label !== undefined && { label: values.label }),
      ...(values.detail !== undefined && { detail: values.detail || null }),
      ...(values.status !== undefined && { status: values.status }),
      ...(values.startDate !== undefined && { start_date: values.startDate }),
      ...(values.endDate !== undefined && { end_date: values.endDate }),
      ...(values.checked !== undefined && { checked: values.checked }),
      ...(values.shoeId !== undefined && { shoe_id: values.shoeId }),
      ...(values.checked === true &&
        values.status === undefined && { status: "ready" as const }),
    })
    .eq("user_id", current.userId)
    .eq("race_id", race.data)
    .eq("id", id.data)
    .select("id")
    .maybeSingle();
  if (error)
    return {
      status: ["23514", "23503"].includes(error.code) ? "invalid" : "error",
    };
  if (!data) return { status: "missing" };
  refresh(race.data);
  return { status: "saved" };
}

export async function deleteChecklistItem(
  raceId: string,
  itemId: string,
): Promise<ActionResult> {
  const race = idSchema.safeParse(raceId);
  const id = idSchema.safeParse(itemId);
  if (!race.success || !id.success) return { status: "invalid" };
  const current = await context();
  if (!current) return { status: "session-expired" };
  const { error } = await current.client
    .from("race_checklist_items")
    .delete()
    .eq("user_id", current.userId)
    .eq("race_id", race.data)
    .eq("id", id.data);
  if (error) return { status: "error" };
  refresh(race.data);
  return { status: "saved" };
}

export async function applyChecklistTemplate(
  raceId: string,
  list: string,
): Promise<ActionResult> {
  const race = idSchema.safeParse(raceId);
  const parsedList = listSchema.safeParse(list);
  if (!race.success || !parsedList.success) return { status: "invalid" };
  const current = await context();
  if (!current) return { status: "session-expired" };
  const owner = await current.client
    .from("athlete_races")
    .select("race_kind")
    .eq("id", race.data)
    .eq("user_id", current.userId)
    .maybeSingle();
  if (owner.error) return { status: "error" };
  if (!owner.data) return { status: "missing" };
  const kind = raceValueSchemas.race_kind.safeParse(owner.data.race_kind);
  if (!kind.success) return { status: "error" };
  const template = checklistTemplateFor(kind.data, parsedList.data);
  if (!template) return { status: "invalid" };
  const existing = await current.client
    .from("race_checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", current.userId)
    .eq("race_id", race.data)
    .eq("list", parsedList.data);
  if (existing.error) return { status: "error" };
  if ((existing.count ?? 0) > 0) return { status: "conflict" };
  const { error } = await current.client.from("race_checklist_items").insert(
    template.map((item, position) => ({
      race_id: race.data,
      user_id: current.userId,
      list: parsedList.data,
      label: item.label,
      detail: item.detail ?? null,
      status: item.status ?? null,
      position,
    })),
  );
  if (error) return { status: "error" };
  refresh(race.data);
  return { status: "saved" };
}

export async function importCourseFromActivity(
  raceId: string,
  activityId: string,
): Promise<ActionResult> {
  const race = idSchema.safeParse(raceId);
  const activity = z.string().min(1).max(200).safeParse(activityId);
  if (!race.success || !activity.success) return { status: "invalid" };
  const current = await context();
  if (!current) return { status: "session-expired" };
  const result = await importActivity(current, race.data, activity.data);
  if (result.status === "saved") {
    refresh(race.data);
    return { status: "saved" };
  }
  if (result.status === "no-track" || result.status === "missing")
    return { status: result.status };
  return { status: "error" };
}
