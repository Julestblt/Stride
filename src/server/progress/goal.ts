import "server-only";
import { pickGoalRace } from "@/features/progress/goal";
import {
  preparationProgress,
  preparationRows,
} from "@/features/races/overview";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadPlanOverview } from "@/server/plans/overview";
import { listRaces, readWorkspace } from "@/server/races/races";

export async function loadGoalInputs(
  context: OnboardingContext,
  today: string,
) {
  const overviewRead = loadPlanOverview(context).catch(() => null);
  const racesRead = listRaces(context).catch(() => []);
  const [overview, races, workspace] = await Promise.all([
    overviewRead,
    racesRead,
    Promise.all([racesRead, overviewRead]).then(([races, overview]) => {
      const goal = pickGoalRace(
        races,
        overview?.plan.state.plan.primaryRaceId ?? null,
        today,
      );
      return goal ? readWorkspace(context, goal.id).catch(() => null) : null;
    }),
  ]);
  return {
    overview,
    races,
    primaryRaceId: overview?.plan.state.plan.primaryRaceId ?? null,
    preparation: workspace
      ? preparationProgress(preparationRows(workspace))
      : null,
  };
}
