import { redirect } from "next/navigation";
import { mondayOf } from "@/features/plans/model/dates";
import { planOperationsSchema } from "@/features/plans/operations/operations";
import { getOnboardingContext } from "@/server/onboarding/context";
import { readActivePlan } from "@/server/plans/stored";
import { CoachSpike } from "./coach-spike";

function proposalWeeks(operations: unknown) {
  const parsed = planOperationsSchema.safeParse(operations);
  if (!parsed.success) return null;
  const [creation] = parsed.data;
  if (creation.op !== "create_plan") return null;
  return creation.state.weeks.map((week) => {
    const sessions = creation.state.sessions
      .filter((session) => mondayOf(session.scheduledOn) === week.weekStart)
      .map((session) => ({
        date: session.scheduledOn,
        title: session.title,
        minutes: session.targets.durationSeconds / 60,
      }));
    return {
      weekStart: week.weekStart,
      minutes: week.targets.durationSeconds / 60,
      sessions,
    };
  });
}

export default async function CoachSpikePage() {
  const context = await getOnboardingContext();
  if (!context) redirect("/sign-in");
  const [plan, proposals] = await Promise.all([
    readActivePlan(context),
    context.client
      .from("plan_proposals")
      .select("id, title, summary, status, scope, operations, created_at")
      .eq("user_id", context.userId)
      .in("status", ["ready", "accepted"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="font-metric text-3xl uppercase">
        Coach — test Managed Agents
      </h1>
      <CoachSpike
        hasPlan={plan !== null}
        planVersion={plan?.activeVersion ?? null}
        proposals={(proposals.data ?? []).map((proposal) => ({
          id: proposal.id,
          title: proposal.title,
          summary: proposal.summary,
          status: proposal.status,
          weeks: proposalWeeks(proposal.operations),
        }))}
      />
    </main>
  );
}
