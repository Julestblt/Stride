import type { Metadata } from "next";
import { localToday } from "@/features/app-shell/shell";
import {
  LoadChart,
  LoadLegend,
} from "@/features/progress/components/load-chart";
import {
  GoalCardView,
  IntensitySection,
  LoadAdviceCard,
  MeasureSection,
  PredictionSection,
  RunningVolumeSection,
} from "@/features/progress/components/fitness-sections";
import { planAdherence } from "@/features/plans/matching/adherence";
import { buildProgram } from "@/features/plans/view/program";
import { fitnessView } from "@/features/progress/fitness";
import { garminPredictions } from "@/features/progress/garmin-predictions";
import { goalCard, preparationWindowDays } from "@/features/progress/goal";
import { intensityDistribution } from "@/features/progress/intensity";
import { sparklineWindows } from "@/features/progress/measures";
import { PeriodNav } from "@/features/progress/components/period-nav";
import { addDays, parsePeriod, periodStart } from "@/features/progress/period";
import { loadAdvice } from "@/features/progress/reading";
import { fitnessRecords } from "@/features/progress/records";
import { runningVolume } from "@/features/progress/running-volume";
import { requireAthlete } from "@/server/app/session";
import { programInput } from "@/server/plans/overview";
import { loadFitness } from "@/server/progress/fitness";

export const metadata: Metadata = { title: "Forme · Progression" };

export default async function ProgressFitnessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const period = parsePeriod(query.period);
  const now = new Date();
  const today = localToday(now);
  const data = await loadFitness(context, today, now);
  const { history, overview } = data;
  const start = periodStart(today, period);
  const adherence = overview
    ? planAdherence({
        sessions: overview.plan.state.sessions,
        matches: overview.matches,
        start,
        today,
        windows: sparklineWindows(start, today),
      })
    : null;
  const program = overview
    ? buildProgram(programInput(overview, data.paces))
    : null;
  const view = fitnessView({
    history,
    zones: data.zones,
    period,
    today,
    adherence,
  });
  const currentWeek = program?.weeks.find(
    (week) => week.weekKey === program.currentWeekKey,
  );
  const advice = view.load
    ? loadAdvice(
        view.load,
        currentWeek && program
          ? {
              currentWeekStart: currentWeek.weekStart,
              currentLight: currentWeek.isLight,
              nextLightWeekStart:
                program.weeks.find(
                  (week) =>
                    week.weekStart > currentWeek.weekStart && week.isLight,
                )?.weekStart ?? null,
            }
          : null,
      )
    : null;
  const predictions = garminPredictions(data.predictions, today);
  const recent = fitnessRecords(
    history.activities.filter(
      (activity) =>
        activity.day >= addDays(today, -preparationWindowDays) &&
        activity.day <= today,
    ),
    history.laps,
  );
  const goal = goalCard({
    races: data.races,
    primaryRaceId: data.primaryRaceId,
    today,
    predictions,
    longestRunMeters: recent.longest?.meters ?? null,
    maxWeeklyGainMeters: recent.weeklyGain?.meters ?? null,
    preparation: data.preparation,
    program,
    blockKinds: Object.fromEntries(
      (overview?.plan.state.blocks ?? []).map((block) => [
        block.blockKey,
        block.kind,
      ]),
    ),
  });
  const volume = runningVolume(
    history.activities,
    program?.weeks.map((week) => ({
      weekStart: week.weekStart,
      meters: week.totals.distanceMeters,
      estimated: week.totals.distanceEstimated,
    })) ?? null,
    today,
  );
  const intensity = intensityDistribution(
    data.runs,
    data.zones?.zones ?? null,
    today,
  );
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <section className="grid items-start gap-6.5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col gap-2.5 max-lg:order-2 sm:gap-3.5">
          <h1 className="text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance sm:text-[40px] sm:leading-[1.08] sm:tracking-[-0.03em]">
            {view.headline}
          </h1>
          <p className="max-w-155 text-sm leading-normal text-pretty text-muted sm:text-base sm:leading-[1.55]">
            {view.summary}
          </p>
          <div className="mt-1.5">
            <PeriodNav period={period} />
          </div>
        </div>
        <div className="max-lg:order-1">
          <GoalCardView goal={goal} />
        </div>
      </section>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
        <section
          aria-labelledby="progress-load"
          className="flex min-w-0 flex-col gap-3.5"
        >
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-4.5">
            <h2
              id="progress-load"
              className="text-base font-semibold sm:text-lg"
            >
              Condition et fatigue
            </h2>
            {view.load && (
              <LoadLegend className="flex flex-wrap gap-3.5 text-[11px] text-muted sm:gap-4 sm:text-xs" />
            )}
          </div>
          {view.load ? (
            <>
              <LoadChart chart={view.load} />
              {advice && <LoadAdviceCard advice={advice} />}
            </>
          ) : (
            <p className="border-t border-border pt-3 text-sm text-muted-foreground">
              Garmin n’a pas encore fourni assez de charges d’entraînement sur
              cette période pour tracer ta condition.
            </p>
          )}
        </section>
        <div className="flex min-w-0 flex-col gap-8">
          <PredictionSection predictions={predictions} />
          <IntensitySection intensity={intensity} />
        </div>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
        <RunningVolumeSection volume={volume} />
        <MeasureSection rows={view.rows} note={view.note} />
      </div>
    </div>
  );
}
