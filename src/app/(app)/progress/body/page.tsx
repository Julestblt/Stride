import type { Metadata } from "next";
import { Suspense } from "react";
import { DataCategoryScope } from "@/features/data-activity/components/status";
import { HealthDayLoading } from "@/features/data-activity/components/loading";
import { localToday } from "@/features/app-shell/shell";
import { coachRequestHref } from "@/features/coach/request";
import {
  bodyKpis,
  bodyNights,
  checkinHistory,
  readinessAdvice,
  readinessFactors,
  readinessSummary,
} from "@/features/progress/body";
import {
  FactorsSection,
  HeartCards,
  KpiCards,
  NightsSection,
  RaceRecoveries,
  ReadinessCard,
} from "@/features/progress/components/body-sections";
import { ScaleSwitch } from "@/features/progress/components/scale-switch";
import { CheckinCard } from "@/features/progress/components/checkin-card";
import { DayTimeline } from "@/features/progress/components/day-timeline";
import {
  DayMoments,
  DayNavigator,
  DayReading,
  DayUnavailable,
  NightCard,
} from "@/features/progress/components/health-day-sections";
import { KpiStrip } from "@/features/progress/components/health-sections";
import {
  healthModel,
  parseHealthView,
  type HealthModel,
} from "@/features/progress/health";
import { parseHealthDate } from "@/features/progress/health-day";
import { healthDayView } from "@/features/progress/health-day-view";
import { addDays } from "@/features/progress/period";
import { recoveryView } from "@/features/progress/recovery-view";
import { requireAthlete } from "@/server/app/session";
import { loadBody } from "@/server/progress/body";
import { loadHealthDay, loadHealthStrip } from "@/server/progress/health-day";

export const metadata: Metadata = { title: "Corps · Progression" };

const titleClass =
  "text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance sm:text-[40px] sm:leading-[1.08] sm:tracking-[-0.03em]";

async function HealthDay({
  loaded: pending,
  reference,
  day,
  today,
}: {
  loaded: ReturnType<typeof loadHealthDay>;
  reference: HealthModel;
  day: string;
  today: string;
}) {
  const loaded = await pending;
  if (!loaded.model) return <DayUnavailable failure={loaded.failure} />;
  const nightTitle = `Nuit du ${new Date(`${addDays(day, -1)}T00:00:00Z`).getUTCDate()} au ${new Date(`${day}T00:00:00Z`).getUTCDate()}`;
  const dayView = healthDayView(loaded.model, reference, nightTitle);
  return (
    <>
      <KpiStrip kpis={dayView.kpis} />
      <DayTimeline model={loaded.model} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-5">
          <DayReading view={dayView} today={day === today} />
          {dayView.night && <NightCard night={dayView.night} />}
        </div>
        <DayMoments model={loaded.model} />
      </div>
    </>
  );
}

export default async function ProgressBodyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const view = parseHealthView(query.view);
  const today = localToday(new Date());
  if (view === "day") {
    const day = parseHealthDate(query.date, today);
    const dayRead = loadHealthDay(context, day);
    const { reference, strip } = await loadHealthStrip(context, day, today);
    return (
      <DataCategoryScope categories={["recovery"]}>
        <div className="flex flex-col gap-6 sm:gap-8">
          <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h1 className={titleClass}>Ta journée</h1>
            <ScaleSwitch current="day" />
          </section>
          <DayNavigator day={day} today={today} strip={strip} />
          <Suspense key={day} fallback={<HealthDayLoading />}>
            <HealthDay
              loaded={dayRead}
              reference={reference}
              day={day}
              today={today}
            />
          </Suspense>
          <p className="text-xs leading-normal text-muted-foreground">
            Vue jour : courbes détaillées chargées depuis Garmin quand tu ouvres
            une journée (FC toutes les 2 min, stress toutes les 3 min, Body
            Battery, phases de sommeil, pas par heure). Les vues 14 et 30 jours
            utilisent les moyennes quotidiennes. Les moments et la lecture sont
            des repères de Stride, pas un diagnostic.
          </p>
        </div>
      </DataCategoryScope>
    );
  }
  const { recovery, days, checkins, session } = await loadBody(context, today);
  const health = healthModel({ days, view, today });
  const reading = recoveryView(recovery);
  const advice = readinessAdvice(recovery.readiness, session);
  return (
    <DataCategoryScope categories={["recovery"]}>
      <div className="flex flex-col gap-8 sm:gap-10">
        <section className="grid items-start gap-6.5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
          <div className="flex flex-col gap-2.5 sm:gap-3.5">
            <h1 className={titleClass}>{reading.headline}</h1>
            {reading.summary && (
              <p className="max-w-150 text-sm leading-normal text-pretty text-muted sm:text-base sm:leading-[1.55]">
                {reading.summary}
              </p>
            )}
            <div className="mt-1.5">
              <ScaleSwitch current={view} />
            </div>
          </div>
          <ReadinessCard
            summary={readinessSummary(recovery.readiness)}
            advice={advice}
            session={session}
            lighterHref={
              session
                ? coachRequestHref(
                    `Ma forme du jour est sous ma moyenne. Propose-moi une version allégée de « ${session.title} ».`,
                    session.sessionKey,
                  )
                : null
            }
          />
        </section>
        <div className="flex flex-col gap-7 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
            <div className="order-2 lg:order-none">
              <NightsSection
                nights={bodyNights(
                  days,
                  health.sleep?.lastDay ?? today,
                  health.chartDays,
                )}
              />
            </div>
            <div className="order-3 lg:order-none">
              <HeartCards
                hrv={health.hrv}
                resting={health.restingHeartRate}
                chartDays={health.chartDays}
              />
            </div>
            <div className="order-5 lg:order-none">
              <CheckinCard
                initial={recovery.checkin}
                history={checkinHistory(checkins, today)}
              />
            </div>
          </div>
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-7">
            <div className="order-1 lg:order-none">
              <FactorsSection factors={readinessFactors(recovery)} />
            </div>
            <div className="order-4 lg:order-none">
              <KpiCards kpis={bodyKpis(health, days)} />
            </div>
            <div className="order-6 lg:order-none">
              <RaceRecoveries races={reading.races} note={reading.racesNote} />
            </div>
          </div>
        </div>
      </div>
    </DataCategoryScope>
  );
}
