import "server-only";
import { cache } from "react";
import type { IntensityPaces } from "@/features/plans/model/structure";
import {
  intensityPaces,
  trainingTargets,
} from "@/features/plans/targets/targets";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadPlanningInput } from "./draft";

export const loadIntensityPaces = cache(
  async (context: OnboardingContext): Promise<IntensityPaces | null> => {
    try {
      const { today, input } = await loadPlanningInput(context);
      return intensityPaces(trainingTargets({ ...input.targets, today }));
    } catch {
      return null;
    }
  },
);
