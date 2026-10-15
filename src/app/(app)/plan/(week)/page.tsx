import type { Metadata } from "next";
import { mondayOf } from "@/features/plans/model/dates";
import { buildProgram } from "@/features/plans/view/program";
import { requireAthlete } from "@/server/app/session";
import { loadPlanOverview, programInput } from "@/server/plans/overview";
import { loadIntensityPaces } from "@/server/plans/paces";
import { loadSessionPanel } from "@/server/plans/session-panel";
import { PlanEmpty } from "../_components/plan-empty";
import { PlanFrame } from "../_components/plan-frame";
import { ProgramExplorer } from "../_components/program-explorer";
import { ProgramTabs } from "../_components/program-hero";
import { SessionSheet } from "../_components/session-sheet";

export const metadata: Metadata = { title: "Programme complet · Plan" };

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const seance = typeof query.seance === "string" ? query.seance : null;
  const [overview, panel, paces] = await Promise.all([
    loadPlanOverview(context),
    seance ? loadSessionPanel(context, seance) : null,
    loadIntensityPaces(context),
  ]);
  if (!overview)
    return (
      <PlanFrame crumbs={[{ label: "Plan" }]}>
        <PlanEmpty />
      </PlanFrame>
    );
  const { programs } = buildProgram(programInput(overview, paces));
  const race = typeof query.race === "string" ? query.race : null;
  const program =
    programs.find((item) => race !== null && item.raceId === race) ??
    programs[0];
  const session = overview.plan.state.sessions.find(
    (item) => item.sessionKey === seance,
  );
  const requested =
    typeof query.week === "string"
      ? query.week
      : session
        ? mondayOf(session.scheduledOn)
        : null;
  const initialWeekKey =
    program.weeks.find((week) => week.weekStart === requested)?.weekKey ?? null;
  return (
    <PlanFrame
      crumbs={[
        { label: "Plan", href: "/plan" },
        { label: "Programme complet" },
      ]}
      className="gap-5 sm:gap-4.5 sm:pt-6"
    >
      <p
        aria-hidden="true"
        className="-mb-2 text-[28px] font-semibold tracking-[-0.025em] sm:hidden"
      >
        Plan
      </p>
      <ProgramTabs programs={programs} active={program} />
      <ProgramExplorer
        key={program.raceId ?? "plan"}
        program={program}
        initialWeekKey={initialWeekKey}
      />
      {panel && <SessionSheet key={panel.sessionKey} panel={panel} />}
    </PlanFrame>
  );
}
