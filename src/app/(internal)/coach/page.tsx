import { redirect } from "next/navigation";
import { getOnboardingContext } from "@/server/onboarding/context";
import { readActivePlan } from "@/server/plans/stored";
import { CoachSpike } from "./coach-spike";

export default async function CoachSpikePage() {
  const context = await getOnboardingContext();
  if (!context) redirect("/sign-in");
  const [plan, proposals] = await Promise.all([
    readActivePlan(context),
    context.client
      .from("plan_proposals")
      .select("id, title, summary, status, created_at")
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
        proposals={proposals.data ?? []}
      />
    </main>
  );
}
