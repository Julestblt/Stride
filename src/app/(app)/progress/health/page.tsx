import { DataCategoryScope } from "@/features/data-activity/components/status";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HealthDayLoading } from "@/features/data-activity/components/loading";
import { localToday } from "@/features/app-shell/shell";
import {
  EnergyPanel,
  HealthViewSwitch,
  HeartPanel,
  KpiStrip,
  LoadPanel,
  ReadingCard,
  SleepPanel,
} from "@/features/progress/components/health-sections";
import { DayTimeline } from "@/features/progress/components/day-timeline";
import {
  DayMoments,
  DayNavigator,
  DayReading,
  DayUnavailable,
  NightCard,
} from "@/features/progress/components/health-day-sections";
import { parseHealthView, type HealthModel } from "@/features/progress/health";
import { parseHealthDate } from "@/features/progress/health-day";
import { healthDayView } from "@/features/progress/health-day-view";
import { addDays } from "@/features/progress/period";
import { healthPageView } from "@/features/progress/health-view";
import { requireAthlete } from "@/server/app/session";
import { loadHealth } from "@/server/progress/health";
import { loadHealthDay, loadHealthStrip } from "@/server/progress/health-day";

export const metadata: Metadata = { title: "Santé · Progression" };

const headerDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

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

export default async function ProgressHealthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const view = parseHealthView(query.view);
  const today = localToday(new Date());
  const header = (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <h1 className="text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] sm:text-[clamp(32px,4vw,46px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
        Santé
      </h1>
      <HealthViewSwitch
        current={view}
        date={headerDate.format(new Date(`${today}T00:00:00Z`))}
      />
    </section>
  );
  if (view === "day") {
    const day = parseHealthDate(query.date, today);
    const dayRead = loadHealthDay(context, day);
    const { reference, strip } = await loadHealthStrip(context, day, today);
    return (
      <DataCategoryScope categories={["recovery"]}>
        <div className="flex flex-col gap-6 sm:gap-8">
          {header}
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
            Battery, phases de sommeil, pas par heure). Les vues semaine et mois
            utilisent les moyennes quotidiennes. Les moments et la lecture sont
            des repères de Stride, pas un diagnostic.
          </p>
        </div>
      </DataCategoryScope>
    );
  }
  const model = await loadHealth(context, today, view);
  const page = healthPageView(model);
  return (
    <DataCategoryScope categories={["recovery"]}>
      <div className="flex flex-col gap-6 sm:gap-8">
        {header}
        <ReadingCard view={page} />
        <KpiStrip kpis={page.kpis} />
        <div className="grid gap-5 lg:grid-cols-2">
          <SleepPanel model={model} view={page} />
          <HeartPanel model={model} view={page} />
          <EnergyPanel model={model} view={page} />
          <LoadPanel model={model} view={page} />
        </div>
        <p className="text-xs leading-normal text-muted-foreground">
          {page.footnote}
        </p>
      </div>
    </DataCategoryScope>
  );
}
