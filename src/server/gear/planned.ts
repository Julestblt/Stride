import "server-only";
import { cache } from "react";
import { z } from "zod";
import { planShoes, type PlanShoes } from "@/features/gear/planned";
import type { RaceFacts } from "@/features/gear/recommendation";
import type { PlanSession } from "@/features/plans/model/plan";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadPlanOverview } from "@/server/plans/overview";
import { loadIntensityPaces } from "@/server/plans/paces";
import { loadGear } from "./load";

type GearContext = Pick<OnboardingContext, "client" | "userId">;

const choiceSchema = z.object({ session_key: z.string(), shoe_id: z.uuid() });

const raceSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  race_date: z.iso.date().nullable(),
  race_kind: z.enum(["road", "trail"]).catch("road"),
});

export async function readShoeChoices(context: GearContext) {
  const { data, error } = await context.client
    .from("plan_session_shoe_choices")
    .select("session_key, shoe_id")
    .eq("user_id", context.userId);
  if (error) throw new Error("Unable to read shoe choices");
  return new Map(
    data.flatMap((row) => {
      const parsed = choiceSchema.safeParse(row);
      return parsed.success
        ? [[parsed.data.session_key, parsed.data.shoe_id] as const]
        : [];
    }),
  );
}

export async function readRaceFacts(
  context: GearContext,
): Promise<(RaceFacts & { id: string })[]> {
  const { data, error } = await context.client
    .from("athlete_races")
    .select("id, name, race_date, race_kind")
    .eq("user_id", context.userId);
  if (error) return [];
  return data.flatMap((row) => {
    const parsed = raceSchema.safeParse(row);
    return parsed.success && parsed.data.race_date
      ? [
          {
            id: parsed.data.id,
            name: parsed.data.name ?? "sans nom",
            date: parsed.data.race_date,
            terrain: parsed.data.race_kind,
          },
        ]
      : [];
  });
}

export async function buildPlanShoes(
  context: OnboardingContext,
  sessions: PlanSession[],
  today: string,
) {
  const [gear, overrides, races, paces] = await Promise.all([
    loadGear(context),
    readShoeChoices(context),
    readRaceFacts(context),
    loadIntensityPaces(context),
  ]);
  return {
    gear,
    races,
    plan: planShoes({
      sessions,
      shoes: gear.shoes,
      races,
      overrides,
      paces,
      today,
    }),
  };
}

export const loadPlanShoes = cache(
  async (context: OnboardingContext): Promise<PlanShoes | null> => {
    const overview = await loadPlanOverview(context);
    if (!overview) return null;
    try {
      return (
        await buildPlanShoes(
          context,
          overview.plan.state.sessions,
          overview.today,
        )
      ).plan;
    } catch {
      return null;
    }
  },
);
