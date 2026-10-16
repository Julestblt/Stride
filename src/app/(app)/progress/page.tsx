import type { Metadata } from "next";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { localToday } from "@/features/app-shell/shell";
import {
  LoadChart,
  LoadLegend,
} from "@/features/progress/components/load-chart";
import {
  MeasureSection,
  PredictionSection,
  RecordsSection,
  WeeklyHoursSection,
} from "@/features/progress/components/fitness-sections";
import { planAdherence } from "@/features/plans/matching/adherence";
import { fitnessView } from "@/features/progress/fitness";
import { sparklineWindows } from "@/features/progress/measures";
import {
  defaultPeriod,
  parsePeriod,
  periodLabels,
  periodStart,
  progressPeriods,
} from "@/features/progress/period";
import { cn } from "@/lib/utils";
import { loadHeartRateZones } from "@/server/activities/activities";
import { requireAthlete } from "@/server/app/session";
import { loadPlanOverview } from "@/server/plans/overview";
import { loadProgressHistory } from "@/server/progress/history";

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
  const [history, zones, plan] = await Promise.all([
    loadProgressHistory(context, today),
    loadHeartRateZones(context, now),
    loadPlanOverview(context)
      .then((overview) =>
        overview ? { stored: overview.plan, matches: overview.matches } : null,
      )
      .catch(() => null),
  ]);
  const start = periodStart(today, period);
  const adherence = plan
    ? planAdherence({
        sessions: plan.stored.state.sessions,
        matches: plan.matches,
        start,
        today,
        windows: sparklineWindows(start, today),
      })
    : null;
  const view = fitnessView({ history, zones, period, today, adherence });
  return (
    <div className="flex flex-col gap-6.5 sm:gap-13">
      <section className="flex flex-col gap-6.5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
        <div className="flex max-w-200 flex-col gap-2.5 sm:gap-3">
          <h1 className="text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance sm:text-[clamp(32px,4vw,46px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
            {view.headline}
          </h1>
          <p className="text-sm leading-normal text-pretty text-muted sm:text-base sm:leading-[1.55]">
            {view.summary}
          </p>
        </div>
        <nav
          aria-label="Période"
          className="flex overflow-hidden rounded-surface border border-border"
        >
          {progressPeriods.map((item) => (
            <Link
              key={item}
              href={
                item === defaultPeriod
                  ? "/progress"
                  : `/progress?period=${item}`
              }
              aria-current={item === period ? "page" : undefined}
              scroll={false}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center border-l border-border px-3.5 text-meta whitespace-nowrap text-muted-foreground transition-colors first:border-l-0 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:min-h-9 sm:flex-none",
                item === period && "bg-surface-raised text-foreground",
              )}
            >
              {periodLabels[item]}
            </Link>
          ))}
        </nav>
      </section>
      <section
        aria-labelledby="progress-load"
        className="flex flex-col gap-3 sm:gap-3.5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between">
          <h2 id="progress-load" className="text-base font-semibold sm:text-xl">
            Condition, fatigue et fraîcheur
          </h2>
          {view.load && (
            <LoadLegend className="flex flex-wrap gap-3.5 text-[11px] text-muted sm:gap-4.5 sm:text-xs" />
          )}
        </div>
        {view.load ? (
          <LoadChart chart={view.load} />
        ) : (
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            Garmin n’a pas encore fourni assez de charges d’entraînement sur
            cette période pour tracer ta condition.
          </p>
        )}
      </section>
      <div className="flex flex-wrap items-start gap-x-14 gap-y-9">
        <MeasureSection rows={view.rows} note={view.note} />
        <aside className="flex min-w-0 flex-[1_1_360px] flex-col gap-9">
          <PredictionSection
            predictions={view.predictions}
            times={view.predictionTimes}
          />
          <WeeklyHoursSection weeks={view.weeks} />
          <RecordsSection records={view.records} />
        </aside>
      </div>
    </div>
  );
}
