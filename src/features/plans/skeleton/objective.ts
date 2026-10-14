import type { HistorySummary } from "../history/summary";
import type { RaceRole } from "../model/plan";
import {
  matchTemplate,
  planTemplates,
  type PlanTemplate,
} from "../templates/templates";

export type ObjectiveRace = {
  id: string;
  name: string;
  date: string;
  distanceKm: number;
  elevationGainM: number | null;
  kind: "road" | "trail";
  priority: "A" | "B" | "C";
  targetSeconds: number | null;
};

export type Objective = {
  race: ObjectiveRace | null;
  template: PlanTemplate;
  otherRaces: (ObjectiveRace & { role: Exclude<RaceRole, "primary"> })[];
  confidenceReasons: string[];
};

export const lowConfidenceDistanceKm = 60;

export function resolveObjective({
  races,
  today,
  history,
}: {
  races: ObjectiveRace[];
  today: string;
  history: Pick<HistorySummary, "sufficient">;
}): Objective {
  const upcoming = races
    .filter((race) => race.date > today && race.distanceKm > 0)
    .sort((first, second) => first.date.localeCompare(second.date));
  const race =
    upcoming.find((item) => item.priority === "A") ?? upcoming[0] ?? null;
  const reasons: string[] = [];
  let template = race ? matchTemplate(race) : planTemplates.base_building;
  if (race && race.distanceKm > lowConfidenceDistanceKm)
    reasons.push(
      "Course de plus de 60 km : plan à confiance faible, à ajuster à tes sensations.",
    );
  if (!history.sufficient) {
    template = planTemplates.base_building;
    reasons.push(
      "Historique court : moins de quatre semaines de course régulière, construction de base prudente.",
    );
  }
  return {
    race,
    template,
    otherRaces: race
      ? upcoming
          .filter((item) => item.id !== race.id && item.date < race.date)
          .map((item) => ({
            ...item,
            role: item.priority === "B" ? "secondary" : "preparation",
          }))
      : [],
    confidenceReasons: reasons,
  };
}
