import "server-only";
import { cache } from "react";
import {
  elevationSamples,
  preparationProgress,
  preparationRows,
  splitRaces,
} from "@/features/races/overview";
import { isStation } from "@/features/races/waypoints";
import type { OnboardingContext } from "@/server/onboarding/context";
import { listRaces, readWorkspace } from "./races";
import { planFor } from "./views";

export const readRacesOverview = cache(
  async (context: OnboardingContext, today: string) => {
    const races = await listRaces(context);
    const split = splitRaces(races, today);
    const data = split.featured
      ? await readWorkspace(context, split.featured.id)
      : null;
    if (!data) return { ...split, featured: null, workspace: null };
    const rows = preparationRows(data);
    const views = planFor(data);
    return {
      ...split,
      featured: data.race,
      workspace: {
        plan: data.plan,
        course: data.course,
        rows,
        progress: preparationProgress(rows),
        elevation: data.course ? elevationSamples(data.course) : null,
        nightRanges: views?.planned?.nightKm ?? [],
        nightSeconds: views?.planned?.night?.totalSeconds ?? null,
        stationDistances: data.waypoints
          .filter((waypoint) => isStation(waypoint.kind))
          .map((waypoint) => waypoint.distanceM),
      },
    };
  },
);

export type RacesOverview = Awaited<ReturnType<typeof readRacesOverview>>;
