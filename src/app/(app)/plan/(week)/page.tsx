import type { Metadata } from "next";
import { HistoryIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { mondayOf } from "@/features/plans/model/dates";
import { proposalsByWeek } from "@/features/plans/review/proposal";
import { buildProgram } from "@/features/plans/view/program";
import { requireAthlete } from "@/server/app/session";
import { loadPlanOverview, programInput } from "@/server/plans/overview";
import { loadIntensityPaces } from "@/server/plans/paces";
import { loadProposalReview } from "@/server/plans/proposals";
import { loadSessionPanel } from "@/server/plans/session-panel";
import {
  watchCopy,
  watchDayTags,
  watchRowFor,
  watchState,
} from "@/features/garmin/watch";
import { loadWatchView } from "@/server/garmin/watch";
import { PlanEmpty } from "../_components/plan-empty";
import { PlanFrame } from "../_components/plan-frame";
import { ProgramExplorer } from "../_components/program-explorer";
import { ProgramTabs } from "../_components/program-hero";
import { ProposalSheet } from "../_components/proposal-sheet";
import { SessionSheet } from "../_components/session-sheet";

export const metadata: Metadata = { title: "Programme complet · Plan" };

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const proposition =
    typeof query.proposition === "string" ? query.proposition : null;
  const seance =
    typeof query.seance === "string" && !proposition ? query.seance : null;
  const [overview, panel, paces, review] = await Promise.all([
    loadPlanOverview(context),
    seance ? loadSessionPanel(context, seance) : null,
    loadIntensityPaces(context),
    proposition ? loadProposalReview(context, proposition) : null,
  ]);
  const reviewSheet = review && (
    <ProposalSheet key={review.id} review={review} />
  );
  if (!overview)
    return (
      <PlanFrame crumbs={[{ label: "Plan" }]}>
        <PlanEmpty />
        {reviewSheet}
      </PlanFrame>
    );
  const watch = await loadWatchView(context, overview.plan);
  const { planId, state } = overview.plan;
  const { programs } = buildProgram(programInput(overview, paces));
  const race = typeof query.race === "string" ? query.race : null;
  const program =
    programs.find((item) => race !== null && item.raceId === race) ??
    programs[0];
  const session = state.sessions.find((item) => item.sessionKey === seance);
  const sessionWatch =
    watch.enabled && session
      ? watchState({
          session,
          today: overview.today,
          row: watchRowFor(watch.rows, planId, session.sessionKey),
        })
      : null;
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
      <div className="flex items-start gap-3 max-sm:flex-col-reverse max-sm:items-stretch">
        <ProgramTabs programs={programs} active={program} />
        <Link
          href="/plan/historique"
          className="ml-auto flex min-h-9 shrink-0 items-center gap-2 rounded-surface border border-border px-3 text-[13px] text-muted hover:text-foreground max-sm:-mt-11 max-sm:min-h-11 max-sm:self-end"
        >
          <HistoryIcon aria-hidden="true" className="size-3.5" />
          Historique
        </Link>
      </div>
      <ProgramExplorer
        key={program.raceId ?? "plan"}
        program={program}
        initialWeekKey={initialWeekKey}
        proposals={proposalsByWeek(state, overview.proposals)}
        watchTags={watchDayTags({
          enabled: watch.enabled,
          rows: watch.rows,
          planId,
          sessions: state.sessions,
          today: overview.today,
        })}
      />
      {panel && (
        <SessionSheet
          key={panel.sessionKey}
          panel={panel}
          watch={
            sessionWatch &&
            watchCopy(sessionWatch, { pendingChange: panel.proposal !== null })
          }
        />
      )}
      {reviewSheet}
    </PlanFrame>
  );
}
