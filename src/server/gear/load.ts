import "server-only";
import { localToday } from "@/features/app-shell/shell";
import type { ShoeInput } from "@/features/gear/view";
import type { OnboardingContext } from "@/server/onboarding/context";
import {
  readGarminGear,
  readShoeActivities,
  readShoes,
  type GarminGearRow,
  type StoredShoe,
} from "./shoes";

type GearContext = Pick<OnboardingContext, "client" | "userId">;

const historyDays = 365;

function since(today: string) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - historyDays);
  return date.toISOString();
}

function shoeInput(
  shoe: StoredShoe,
  activities: ShoeInput["activities"],
): ShoeInput {
  return {
    id: shoe.id,
    spec: shoe.spec,
    suggested: shoe.suggested,
    startingDistanceM: shoe.startingDistanceM,
    firstUseDate: shoe.firstUseDate,
    retiredOn: shoe.retiredOn,
    garmin: shoe.garmin
      ? {
          totalDistanceM: shoe.garmin.total_distance_meters,
          totalActivities: shoe.garmin.total_activities,
        }
      : null,
    activities,
  };
}

export async function loadGear(context: GearContext, now = new Date()) {
  const today = localToday(now);
  const shoes = await readShoes(context);
  const uuids = shoes.flatMap((shoe) =>
    shoe.garminGearUuid ? [shoe.garminGearUuid] : [],
  );
  const activities = await readShoeActivities(context, uuids, since(today));
  return {
    today,
    shoes: shoes.map((shoe) =>
      shoeInput(
        shoe,
        shoe.garminGearUuid ? (activities.get(shoe.garminGearUuid) ?? []) : [],
      ),
    ),
    stored: shoes,
  };
}

export async function loadImportable(
  context: GearContext,
): Promise<GarminGearRow[]> {
  const [gear, shoes] = await Promise.all([
    readGarminGear(context),
    readShoes(context),
  ]);
  const linked = new Set(shoes.map((shoe) => shoe.garminGearUuid));
  return gear
    .filter((row) => !linked.has(row.gear_uuid))
    .sort((a, b) =>
      a.status === b.status
        ? b.total_distance_meters - a.total_distance_meters
        : a.status === "active"
          ? -1
          : 1,
    );
}

export async function countActiveShoes(context: GearContext) {
  const { count, error } = await context.client
    .from("athlete_shoes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId)
    .is("retired_on", null);
  if (error) throw new Error("Unable to count shoes");
  return count ?? 0;
}
