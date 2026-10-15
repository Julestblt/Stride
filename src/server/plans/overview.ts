import "server-only";
import { cache } from "react";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import type { ProgramInput, ProgramRace } from "@/features/plans/view/program";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readSessionMatches, type SessionMatch } from "./matches";
import { readReadyProposals, type ReadyProposal } from "./proposals";
import { readActivePlan, type StoredPlan } from "./stored";

export type PlanOverview = {
  today: string;
  plan: StoredPlan;
  matches: SessionMatch[];
  proposals: ReadyProposal[];
  races: ProgramRace[];
};

const raceSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    race_date: z.string().nullable(),
    priority: z.enum(["A", "B", "C"]).nullable().catch(null),
    target_duration_seconds: z.number().int().positive().nullable().catch(null),
  })
  .transform((row) => ({
    id: row.id,
    name: row.name ?? "Course sans nom",
    date: row.race_date,
    priority: row.priority,
    targetSeconds: row.target_duration_seconds,
  }));

async function readRaces(context: OnboardingContext): Promise<ProgramRace[]> {
  const { data, error } = await context.client
    .from("athlete_races")
    .select("id, name, race_date, priority, target_duration_seconds")
    .eq("user_id", context.userId);
  if (error) return [];
  return z.array(raceSchema).catch([]).parse(data);
}

export const loadPlanOverview = cache(
  async (context: OnboardingContext): Promise<PlanOverview | null> => {
    const [plan, races] = await Promise.all([
      readActivePlan(context),
      readRaces(context),
    ]);
    if (!plan) return null;
    const [matches, proposals] = await Promise.all([
      readSessionMatches(context, plan.planId),
      readReadyProposals(context, plan.planId),
    ]);
    return {
      today: localToday(plan.state.plan.timeZone),
      plan,
      matches,
      proposals,
      races,
    };
  },
);

export function programInput(overview: PlanOverview): ProgramInput {
  return {
    state: overview.plan.state,
    today: overview.today,
    summary: overview.plan.versionSummary,
    matches: overview.matches,
    proposalKeys: overview.proposals.flatMap((proposal) => proposal.targetKeys),
    races: overview.races,
  };
}
