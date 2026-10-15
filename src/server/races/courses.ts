import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { RaceCourseValues } from "@/features/onboarding/goals";
import type { OnboardingContext } from "@/server/onboarding/context";

const courseSummarySchema = z.object({
  race_id: z.string(),
  distance_m: z.coerce.number().positive(),
  elevation_gain_m: z.number().int().nullable(),
});

export const readRaceCourses = cache(
  async (
    context: OnboardingContext,
  ): Promise<Map<string, RaceCourseValues>> => {
    try {
      const { data, error } = await context.client
        .from("race_courses")
        .select("race_id, distance_m, elevation_gain_m")
        .eq("user_id", context.userId);
      if (error) return new Map();
      return new Map(
        (data ?? []).flatMap((row) => {
          const parsed = courseSummarySchema.safeParse(row);
          return parsed.success
            ? [
                [
                  parsed.data.race_id,
                  {
                    distanceM: parsed.data.distance_m,
                    elevationGainM: parsed.data.elevation_gain_m,
                  },
                ] as const,
              ]
            : [];
        }),
      );
    } catch {
      return new Map();
    }
  },
);
