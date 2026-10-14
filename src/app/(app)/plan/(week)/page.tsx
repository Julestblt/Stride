import type { Metadata } from "next";
import {
  planAlerts,
  weekPosition,
  defaultWeekStart,
} from "@/features/plans/view/plan-view";
import { requireAthlete } from "@/server/app/session";
import { loadPlanDraft } from "@/server/plans/draft";
import { PlanEmpty } from "../_components/plan-empty";
import { DraftBanner, PlanFrame } from "../_components/plan-frame";
import {
  BlockNavigation,
  PlanAlerts,
  WeekHeader,
  WeekSessions,
} from "../_components/week-view";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const { today, plan } = await loadPlanDraft(context);
  if (plan.status !== "ready")
    return (
      <PlanFrame crumbs={[{ label: "Plan" }]}>
        <PlanEmpty plan={plan} />
      </PlanFrame>
    );
  const { state } = plan;
  const requested = typeof query.week === "string" ? query.week : null;
  const weekStart = state.weeks.some((week) => week.weekStart === requested)
    ? requested!
    : defaultWeekStart(state, today);
  const position = weekPosition(state, weekStart);
  return (
    <PlanFrame
      crumbs={[
        { label: "Plan", href: "/plan" },
        { label: position.block.name },
        { label: `Semaine ${position.number}` },
      ]}
    >
      <WeekHeader state={state} weekStart={weekStart} />
      <DraftBanner />
      <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <BlockNavigation
          state={state}
          today={today}
          selected={weekStart}
          className="max-lg:hidden lg:sticky lg:top-0 lg:self-start"
        />
        <div className="flex min-w-0 flex-col gap-8">
          <WeekSessions
            state={state}
            weekStart={weekStart}
            today={today}
            report={plan.report}
          />
          <PlanAlerts
            alerts={planAlerts(
              plan.report,
              plan.feasibility,
              state.plan.confidence.reasons,
            )}
          />
          <section
            aria-labelledby="all-weeks"
            className="flex flex-col gap-4 lg:hidden"
          >
            <h2 id="all-weeks" className="text-title font-semibold">
              Toutes les semaines
            </h2>
            <BlockNavigation state={state} today={today} selected={weekStart} />
          </section>
        </div>
      </div>
    </PlanFrame>
  );
}
