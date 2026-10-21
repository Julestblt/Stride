"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localToday } from "@/features/app-shell/shell";
import {
  garminGearName,
  importShoesSchema,
  newShoeSchema,
  shoeSpecSchema,
  suggestedFieldsSchema,
  type GarminDefault,
} from "@/features/gear/model";
import {
  garminLimitMeters,
  startingDistanceFor,
} from "@/features/gear/mileage";
import type { GarminFailure } from "@/features/garmin/connection";
import { getGarminClient } from "@/server/garmin/session";
import { getOnboardingContext } from "@/server/onboarding/context";
import { suggestShoeFromName } from "@/server/ai/skills/shoe-suggestion";
import type { ShoeSuggestion } from "@/features/gear/suggestion";
import { loadPlanShoes } from "./planned";
import { readGarminGear, readShoe, shoeColumns } from "./shoes";

export type GearActionResult =
  | { status: "saved"; id?: string; count?: number }
  | {
      status:
        | "invalid"
        | "session-expired"
        | "reconnect"
        | "garmin-unavailable"
        | "not-found"
        | "error";
    };

const defaultActivities: Record<
  GarminDefault,
  ("running" | "trail_running" | "treadmill_running")[]
> = {
  none: [],
  running: ["running", "treadmill_running"],
  trail_running: ["trail_running"],
};

function garminFailure(failure: GarminFailure): GearActionResult {
  if (failure.code === "unauthorized") return { status: "session-expired" };
  if (failure.code === "reconnect_required" || failure.code === "disconnected")
    return { status: "reconnect" };
  if (failure.code === "gear_not_found") return { status: "not-found" };
  return { status: "garmin-unavailable" };
}

function refresh(id?: string) {
  revalidatePath("/gear");
  if (id) revalidatePath(`/gear/${id}`);
}

async function context() {
  return getOnboardingContext({ writable: true });
}

export async function createShoe(input: unknown): Promise<GearActionResult> {
  const parsed = newShoeSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const athlete = await context();
  if (!athlete) return { status: "session-expired" };
  const { spec, currentKm, firstUseDate, garminDefault, suggested } =
    parsed.data;
  const startingDistanceM = startingDistanceFor(currentKm, 0);
  const created = await getGarminClient()
    .createGear(
      { accessToken: athlete.accessToken },
      {
        brand: spec.brand,
        model: [spec.model, spec.version].filter(Boolean).join(" "),
        name: garminGearName(spec),
        first_use_date: firstUseDate,
        max_distance_meters: garminLimitMeters(
          spec.lifespanKm,
          startingDistanceM,
        ),
        default_activity_types: defaultActivities[garminDefault],
      },
    )
    .catch(() => null);
  if (!created) return { status: "garmin-unavailable" };
  if (!created.ok) return garminFailure(created.failure);
  const { data, error } = await athlete.client
    .from("athlete_shoes")
    .insert({
      user_id: athlete.userId,
      garmin_gear_uuid: created.value.gearUuid,
      ...shoeColumns(spec),
      starting_distance_m: startingDistanceM,
      first_use_date: firstUseDate,
      suggested_fields: suggested,
    })
    .select("id")
    .single();
  if (error) return { status: "error" };
  refresh();
  return { status: "saved", id: data.id };
}

export async function importShoes(input: unknown): Promise<GearActionResult> {
  const parsed = importShoesSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const athlete = await context();
  if (!athlete) return { status: "session-expired" };
  const gear = new Map(
    (await readGarminGear(athlete)).map((row) => [row.gear_uuid, row]),
  );
  const today = localToday(new Date());
  const garmin = getGarminClient();
  let count = 0;
  for (const pair of parsed.data) {
    const row = gear.get(pair.garminGearUuid);
    if (!row) return { status: "not-found" };
    const startingDistanceM = startingDistanceFor(
      pair.currentKm,
      row.total_distance_meters,
    );
    const updated = await garmin
      .updateGear({ accessToken: athlete.accessToken }, pair.garminGearUuid, {
        max_distance_meters: garminLimitMeters(
          pair.lifespanKm,
          startingDistanceM,
        ),
      })
      .catch(() => null);
    if (!updated) return { status: "garmin-unavailable" };
    if (!updated.ok) return garminFailure(updated.failure);
    const { error } = await athlete.client.from("athlete_shoes").insert({
      user_id: athlete.userId,
      garmin_gear_uuid: pair.garminGearUuid,
      brand: pair.brand,
      model: pair.model,
      category: pair.category,
      terrain: pair.terrain,
      lifespan_km: pair.lifespanKm,
      starting_distance_m: startingDistanceM,
      first_use_date: row.first_use_date ?? today,
      retired_on: row.status === "retired" ? today : null,
    });
    if (error) return { status: "error" };
    count += 1;
  }
  refresh();
  return { status: "saved", count };
}

const updateSchema = z.strictObject({
  id: z.uuid(),
  spec: shoeSpecSchema,
  suggested: suggestedFieldsSchema,
});

export async function updateShoe(input: unknown): Promise<GearActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const athlete = await context();
  if (!athlete) return { status: "session-expired" };
  const shoe = await readShoe(athlete, parsed.data.id);
  if (!shoe) return { status: "not-found" };
  const { spec, suggested } = parsed.data;
  if (shoe.garminGearUuid) {
    const updated = await getGarminClient()
      .updateGear({ accessToken: athlete.accessToken }, shoe.garminGearUuid, {
        name: garminGearName(spec),
        max_distance_meters: garminLimitMeters(
          spec.lifespanKm,
          shoe.startingDistanceM,
        ),
      })
      .catch(() => null);
    if (!updated) return { status: "garmin-unavailable" };
    if (!updated.ok) return garminFailure(updated.failure);
  }
  const { error } = await athlete.client
    .from("athlete_shoes")
    .update({ ...shoeColumns(spec), suggested_fields: suggested })
    .eq("id", shoe.id);
  if (error) return { status: "error" };
  refresh(shoe.id);
  return { status: "saved", id: shoe.id };
}

const startingSchema = z.strictObject({
  id: z.uuid(),
  currentKm: z.number().min(0).max(5000),
});

export async function setCurrentKm(input: unknown): Promise<GearActionResult> {
  const parsed = startingSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const athlete = await context();
  if (!athlete) return { status: "session-expired" };
  const shoe = await readShoe(athlete, parsed.data.id);
  if (!shoe) return { status: "not-found" };
  const startingDistanceM = startingDistanceFor(
    parsed.data.currentKm,
    shoe.garmin?.total_distance_meters ?? 0,
  );
  if (shoe.garminGearUuid) {
    const updated = await getGarminClient()
      .updateGear({ accessToken: athlete.accessToken }, shoe.garminGearUuid, {
        max_distance_meters: garminLimitMeters(
          shoe.spec.lifespanKm,
          startingDistanceM,
        ),
      })
      .catch(() => null);
    if (!updated) return { status: "garmin-unavailable" };
    if (!updated.ok) return garminFailure(updated.failure);
  }
  const { error } = await athlete.client
    .from("athlete_shoes")
    .update({ starting_distance_m: startingDistanceM })
    .eq("id", shoe.id);
  if (error) return { status: "error" };
  refresh(shoe.id);
  return { status: "saved", id: shoe.id };
}

const retireSchema = z.strictObject({ id: z.uuid(), retired: z.boolean() });

export async function setShoeRetired(
  input: unknown,
): Promise<GearActionResult> {
  const parsed = retireSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const athlete = await context();
  if (!athlete) return { status: "session-expired" };
  const shoe = await readShoe(athlete, parsed.data.id);
  if (!shoe) return { status: "not-found" };
  const { retired } = parsed.data;
  if (shoe.garminGearUuid) {
    const updated = await getGarminClient()
      .updateGear({ accessToken: athlete.accessToken }, shoe.garminGearUuid, {
        status: retired ? "retired" : "active",
      })
      .catch(() => null);
    if (!updated) return { status: "garmin-unavailable" };
    if (!updated.ok) return garminFailure(updated.failure);
  }
  const today = localToday(new Date());
  const { error } = await athlete.client
    .from("athlete_shoes")
    .update({
      retired_on: retired
        ? today < shoe.firstUseDate
          ? shoe.firstUseDate
          : today
        : null,
    })
    .eq("id", shoe.id);
  if (error) return { status: "error" };
  refresh(shoe.id);
  return { status: "saved", id: shoe.id };
}

export type SuggestionOutcome =
  | { status: "suggested"; suggestion: ShoeSuggestion }
  | { status: "unknown" | "unavailable" | "invalid" | "session-expired" };

const nameSchema = z.strictObject({ name: z.string().trim().min(3).max(120) });

export async function suggestShoe(input: unknown): Promise<SuggestionOutcome> {
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const athlete = await context();
  if (!athlete) return { status: "session-expired" };
  return suggestShoeFromName(parsed.data.name);
}

const sessionShoeSchema = z.strictObject({
  sessionKey: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  shoeId: z.uuid(),
});

export async function chooseSessionShoe(
  input: unknown,
): Promise<GearActionResult> {
  const parsed = sessionShoeSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" };
  const athlete = await context();
  if (!athlete) return { status: "session-expired" };
  const { sessionKey, shoeId } = parsed.data;
  const plan = await loadPlanShoes(athlete);
  const result = plan?.results.get(sessionKey);
  if (!plan || !result || !plan.pairs.has(shoeId)) return { status: "invalid" };
  const choices = athlete.client.from("plan_session_shoe_choices");
  const { error } =
    result.recommendation.pairId === shoeId
      ? await choices
          .delete()
          .eq("user_id", athlete.userId)
          .eq("session_key", sessionKey)
      : await choices.upsert(
          {
            user_id: athlete.userId,
            session_key: sessionKey,
            shoe_id: shoeId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,session_key" },
        );
  if (error) return { status: "error" };
  revalidatePath("/plan");
  revalidatePath("/today");
  refresh();
  return { status: "saved" };
}
