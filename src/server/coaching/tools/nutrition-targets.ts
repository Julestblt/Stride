import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import { addDays } from "@/features/plans/model/dates";
import { nutritionThresholdsVersion } from "@/features/nutrition/thresholds";
import { nutritionDays, readNutritionInputs } from "@/server/nutrition/targets";
import { defineTool } from "./define";
import { toolError } from "./errors";

export const nutritionMaxDays = 14;

export const readNutritionTargetsTool = defineTool({
  name: "read_nutrition_targets",
  description: `Read Stride's computed nutrition targets for a date range of at most ${nutritionMaxDays} days: for each day the day type from the planned sessions and races, the energy target (resting energy, digestion, NEAT, training energy, rounded display value), carbohydrate, protein and fat targets in g/kg and grams, the protein intakes and recovery window, in-session fueling for sessions over 90 minutes, and the light-deficit verdict when requested (refused on long, hard, pre-race and race days, taper and race weeks, and with open health signals). Each day lists its inputs, estimations and confidence. Returns missing profile fields instead of numbers when the profile is incomplete. Never compute a number yourself: quote this result.`,
  class: "compute",
  dataClasses: ["training", "plan", "health"],
  input: z
    .strictObject({
      from: z.iso.date().describe("First date (YYYY-MM-DD)."),
      days: z
        .number()
        .int()
        .min(1)
        .max(nutritionMaxDays)
        .describe("Number of days to compute, starting at from."),
      deficitRequested: z
        .boolean()
        .describe("True only when the athlete asked for a light deficit."),
    })
    .refine(({ from }) => from >= addDays(localToday("Europe/Paris"), -7), {
      message: "range_too_large",
    }),
  output: z.strictObject({
    today: z.iso.date(),
    version: z.string(),
    defaultNeat: z.boolean(),
    days: z.array(z.unknown()),
  }),
  run: async (context, { from, days, deficitRequested }) => {
    const today = localToday("Europe/Paris");
    const inputs = await readNutritionInputs(context, today).catch(() => {
      throw toolError("tool_unavailable");
    });
    return {
      today,
      version: nutritionThresholdsVersion,
      defaultNeat: true,
      days: nutritionDays(inputs, from, days, deficitRequested),
    };
  },
});
