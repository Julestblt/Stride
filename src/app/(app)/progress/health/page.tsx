import type { Metadata } from "next";
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
import { parseHealthView } from "@/features/progress/health";
import { healthPageView } from "@/features/progress/health-view";
import { getShell } from "@/server/app/shell";
import { requireAthlete } from "@/server/app/session";
import { loadHealth } from "@/server/progress/health";

export const metadata: Metadata = { title: "Santé · Progression" };

const headerDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function ProgressHealthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query, shell] = await Promise.all([
    requireAthlete(),
    searchParams,
    getShell(),
  ]);
  const requested = parseHealthView(query.view);
  const view = requested === "day" ? "week" : requested;
  const today = localToday(new Date());
  const model = await loadHealth(context, today, view);
  const page = healthPageView(model, shell.sync);
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] sm:text-[clamp(32px,4vw,46px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
          Santé
        </h1>
        <HealthViewSwitch
          current={view}
          date={headerDate.format(new Date(`${today}T00:00:00Z`))}
        />
      </section>
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
  );
}
