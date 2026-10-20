import "server-only";
import { z } from "zod";
import {
  shoeCategories,
  shoeTerrains,
  suggestedFields,
  type ShoeSpec,
  type SuggestedField,
} from "@/features/gear/model";
import type { DatedDistance } from "@/features/gear/mileage";
import type { OnboardingContext } from "@/server/onboarding/context";

type GearContext = Pick<OnboardingContext, "client" | "userId">;

const numeric = z.coerce.number().nullable();

const shoeRowSchema = z.object({
  id: z.uuid(),
  garmin_gear_uuid: z.string().nullable(),
  brand: z.string(),
  model: z.string(),
  version: z.string().nullable(),
  category: z.enum(shoeCategories),
  terrain: z.enum(shoeTerrains),
  description: z.string().nullable(),
  suggested_fields: z.array(z.enum(suggestedFields)),
  size_eu: numeric,
  lifespan_km: z.number().int(),
  starting_distance_m: z.number().int(),
  first_use_date: z.iso.date(),
  retired_on: z.iso.date().nullable(),
  created_at: z.string(),
});

const gearRowSchema = z.object({
  gear_uuid: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  display_name: z.string().nullable(),
  status: z.enum(["active", "retired"]),
  first_use_date: z.iso.date().nullable(),
  maximum_meters: z.number().nullable(),
  total_distance_meters: z.number(),
  total_activities: z.number().int(),
});

export type GarminGearRow = z.output<typeof gearRowSchema>;

export type StoredShoe = {
  id: string;
  garminGearUuid: string | null;
  spec: ShoeSpec;
  suggested: SuggestedField[];
  startingDistanceM: number;
  firstUseDate: string;
  retiredOn: string | null;
  createdAt: string;
  garmin: GarminGearRow | null;
};

export type ShoeActivity = DatedDistance & {
  activityId: string;
  name: string | null;
  activityType: string | null;
};

function storedShoe(
  row: z.output<typeof shoeRowSchema>,
  garmin: GarminGearRow | null,
): StoredShoe {
  return {
    id: row.id,
    garminGearUuid: row.garmin_gear_uuid,
    spec: {
      brand: row.brand,
      model: row.model,
      version: row.version,
      category: row.category,
      terrain: row.terrain,
      description: row.description,
      sizeEu: row.size_eu,
      lifespanKm: row.lifespan_km,
    },
    suggested: row.suggested_fields,
    startingDistanceM: row.starting_distance_m,
    firstUseDate: row.first_use_date,
    retiredOn: row.retired_on,
    createdAt: row.created_at,
    garmin,
  };
}

export function shoeColumns(spec: ShoeSpec) {
  return {
    brand: spec.brand,
    model: spec.model,
    version: spec.version,
    category: spec.category,
    terrain: spec.terrain,
    description: spec.description,
    size_eu: spec.sizeEu,
    lifespan_km: spec.lifespanKm,
  };
}

export async function readGarminGear(
  context: GearContext,
): Promise<GarminGearRow[]> {
  const { data, error } = await context.client
    .from("provider_gear")
    .select(
      "gear_uuid, brand, model, display_name, status, first_use_date, maximum_meters, total_distance_meters, total_activities",
    )
    .eq("user_id", context.userId)
    .eq("provider", "garmin");
  if (error) throw new Error("Unable to read Garmin gear");
  return data.flatMap((row) => {
    const parsed = gearRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function readShoes(context: GearContext): Promise<StoredShoe[]> {
  const [{ data, error }, gear] = await Promise.all([
    context.client
      .from("athlete_shoes")
      .select("*")
      .eq("user_id", context.userId)
      .order("first_use_date", { ascending: false }),
    readGarminGear(context),
  ]);
  if (error) throw new Error("Unable to read shoes");
  const byUuid = new Map(gear.map((row) => [row.gear_uuid, row]));
  return data.flatMap((row) => {
    const parsed = shoeRowSchema.safeParse(row);
    if (!parsed.success) return [];
    return [
      storedShoe(
        parsed.data,
        parsed.data.garmin_gear_uuid
          ? (byUuid.get(parsed.data.garmin_gear_uuid) ?? null)
          : null,
      ),
    ];
  });
}

export async function readShoe(
  context: GearContext,
  id: string,
): Promise<StoredShoe | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const shoes = await readShoes(context);
  return shoes.find((shoe) => shoe.id === id) ?? null;
}

const linkSchema = z.object({
  provider_activity_id: z.string(),
  gear_uuid: z.string(),
});

const activitySchema = z.object({
  provider_activity_id: z.string(),
  activity_name: z.string().nullable(),
  activity_type: z.string().nullable(),
  local_started_at: z.string().nullable(),
  started_at: z.string(),
  distance_meters: z.coerce.number().nullable(),
});

export async function readShoeActivities(
  context: GearContext,
  gearUuids: string[],
  since: string,
): Promise<Map<string, ShoeActivity[]>> {
  const result = new Map<string, ShoeActivity[]>();
  if (gearUuids.length === 0) return result;
  const { data: links, error } = await context.client
    .from("provider_activity_gear")
    .select("provider_activity_id, gear_uuid")
    .eq("user_id", context.userId)
    .in("gear_uuid", gearUuids);
  if (error) throw new Error("Unable to read shoe activities");
  const gearOf = new Map<string, string>();
  for (const link of links) {
    const parsed = linkSchema.safeParse(link);
    if (parsed.success)
      gearOf.set(parsed.data.provider_activity_id, parsed.data.gear_uuid);
  }
  if (gearOf.size === 0) return result;
  const { data: activities, error: activityError } = await context.client
    .from("provider_activities")
    .select(
      "provider_activity_id, activity_name, activity_type, local_started_at, started_at, distance_meters",
    )
    .eq("user_id", context.userId)
    .gte("started_at", since)
    .order("started_at", { ascending: false });
  if (activityError) throw new Error("Unable to read shoe activities");
  for (const activity of activities) {
    const parsed = activitySchema.safeParse(activity);
    if (!parsed.success) continue;
    const gear = gearOf.get(parsed.data.provider_activity_id);
    if (!gear) continue;
    const list = result.get(gear) ?? [];
    list.push({
      activityId: parsed.data.provider_activity_id,
      name: parsed.data.activity_name,
      activityType: parsed.data.activity_type,
      day: (parsed.data.local_started_at ?? parsed.data.started_at).slice(
        0,
        10,
      ),
      distanceM: parsed.data.distance_meters ?? 0,
    });
    result.set(gear, list);
  }
  return result;
}
