import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  defaultWeekStart,
  weekPosition,
} from "@/features/plans/view/plan-view";
import { requireAthlete } from "@/server/app/session";
import { loadPlanOverview } from "@/server/plans/overview";
import { PlanFrame } from "../_components/plan-frame";
import {
  BlockNavigation,
  WeekHeader,
  WeekSessions,
} from "../_components/week-view";

export const metadata: Metadata = { title: "Semaine · Plan" };

export default async function PlanWeekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const overview = await loadPlanOverview(context);
  if (!overview) redirect("/plan");
  const { today } = overview;
  const { state } = overview.plan;
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
      <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <BlockNavigation
          state={state}
          today={today}
          selected={weekStart}
          className="max-lg:hidden lg:sticky lg:top-0 lg:self-start"
        />
        <div className="flex min-w-0 flex-col gap-8">
          <WeekSessions state={state} weekStart={weekStart} today={today} />
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
