import type { ShoeCategory, ShoeTerrain } from "./model";
import { reservedRace, type RaceFacts } from "./recommendation";

export const breakInBudgetKm = { min: 30, max: 50 } as const;

export type BreakInStatus = "new" | "breaking_in" | "broken_in";

export type BreakIn = {
  status: BreakInStatus;
  totalKm: number;
  longestRunKm: number;
  budgetKm: { min: number; max: number };
};

export function breakIn(totalKm: number, longestRunKm: number): BreakIn {
  return {
    status:
      totalKm >= breakInBudgetKm.max
        ? "broken_in"
        : totalKm >= breakInBudgetKm.min
          ? "breaking_in"
          : "new",
    totalKm,
    longestRunKm,
    budgetKm: { ...breakInBudgetKm },
  };
}

export type RacePairCandidate = {
  id: string;
  category: ShoeCategory;
  terrain: ShoeTerrain;
  retired: boolean;
};

export type RaceWithPair = RaceFacts & { id: string };

export function racePair(
  race: RaceWithPair,
  linkedPairIds: string[],
  pairs: RacePairCandidate[],
  races: RaceWithPair[],
  today: string,
): { pairId: string; source: "checklist" | "reserved" } | null {
  const active = pairs.filter((pair) => !pair.retired);
  const linked = active.find((pair) => linkedPairIds.includes(pair.id));
  if (linked) return { pairId: linked.id, source: "checklist" };
  const reserved = active.find(
    (pair) => reservedRace(pair, races, today)?.id === race.id,
  );
  return reserved ? { pairId: reserved.id, source: "reserved" } : null;
}
