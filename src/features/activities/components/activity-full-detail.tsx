import type { ActivityView } from "../activity-view";
import { formatClock } from "../charts";
import { RouteCard } from "./route-card";
import { ActivityCharts, ActivityScatter } from "./activity-charts";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PulseDot } from "@/components/stride/marks";
import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import {
  ProvenanceLabel,
  SignalList,
  SignalRow,
} from "@/components/stride/provenance";
import {
  activitiesQuery,
  activityTitle,
  detailMetrics,
  formatActivityDate,
  type ActivityFilter,
} from "@/features/activities/activities";
import {
  effortStats,
  lapTable,
  type ActivityDetailData,
  type ActivitySegment,
} from "@/features/activities/detail";
import { formatLocalDate } from "@/features/app-shell/shell";
import { LapTableSection } from "./lap-table";

export function ActivityFullDetail({
  activity,
  segments,
  view,
  zoneMethod,
  filter,
  limit,
  sync,
  today,
}: {
  activity: ActivityDetailData;
  segments: ActivitySegment[];
  view: ActivityView;
  zoneMethod: "karvonen" | "percentage_maximum" | null;
  filter: ActivityFilter;
  limit: number;
  sync: string | null;
  today: string;
}) {
  const query = activitiesQuery(filter, limit);
  const date = formatActivityDate(activity.date, today);
  const metrics = detailMetrics(activity);
  const laps = lapTable(activity, segments);
  const effort = effortStats(activity);
  const imported = formatLocalDate(activity.detailImportedAt);
  const kicker = [
    date,
    activity.localTime,
    activity.routeName && activity.routeName !== activityTitle(activity)
      ? activity.routeName
      : null,
  ].filter(Boolean);
  return (
    <>
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4">
        <SidebarTrigger aria-label="Afficher ou masquer la barre latérale" />
        <Separator
          orientation="vertical"
          className="data-vertical:h-4 data-vertical:self-center"
        />
        <nav
          aria-label="Fil d’Ariane"
          className="flex min-w-0 flex-1 items-center gap-2 text-sm"
        >
          <Link
            href={`/activities${query}`}
            className="text-muted-foreground hover:text-foreground"
          >
            Activités
          </Link>
          <span aria-hidden="true" className="text-dim">
            /
          </span>
          <Link
            href={`/activities/${activity.id}${query}`}
            className="truncate text-muted-foreground hover:text-foreground"
          >
            {date}
          </Link>
          <span aria-hidden="true" className="text-dim">
            /
          </span>
          <span aria-current="page" className="truncate">
            Détail
          </span>
        </nav>
        {sync && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <PulseDot tone="success" breathing={false} />
            {sync}
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <article className="mx-auto flex w-full max-w-360 flex-col gap-10 px-5 pt-8 pb-12 sm:px-[4vw]">
          <header className="flex flex-col gap-3">
            <MonoLabel size="label">{kicker.join(" · ")}</MonoLabel>
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
              <h1 className="text-headline font-semibold text-balance sm:text-display sm:leading-none sm:tracking-[-0.03em]">
                {activityTitle(activity)}
              </h1>
              {metrics.length > 0 && (
                <dl className="flex flex-wrap gap-x-6.5 gap-y-4">
                  {metrics.map((metric) => (
                    <div key={metric.key} className="flex flex-col-reverse">
                      <MonoLabel size="micro" asChild>
                        <dt>{metric.label}</dt>
                      </MonoLabel>
                      <dd>
                        <Metric
                          className="text-[1.625rem] sm:text-[2.125rem]"
                          size="md"
                          value={metric.value}
                          unit={metric.unit}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </header>
          {view.route ? (
            <RouteCard view={view.route} gain={activity.elevationGainMeters} />
          ) : (
            <section
              aria-label="Parcours"
              className="rounded-card border border-border bg-surface px-4 py-5"
            >
              <MonoLabel>Parcours</MonoLabel>
              <p className="mt-2 text-body text-muted">
                Aucun tracé GPS n’est disponible pour cette activité.
              </p>
            </section>
          )}
          <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="flex min-w-0 flex-col gap-10">
              {view.charts && <ActivityCharts view={view.charts} />}
              {laps ? (
                <LapTableSection table={laps} />
              ) : (
                <p className="text-body text-muted">
                  Garmin n’a transmis aucun tour pour cette activité.
                </p>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-8">
              {effort.length > 0 && (
                <section
                  aria-labelledby="activity-effort"
                  className="flex flex-col gap-3"
                >
                  <MonoLabel asChild>
                    <h2 id="activity-effort">Effort</h2>
                  </MonoLabel>
                  <SignalList className="grid grid-cols-2 gap-x-5 lg:flex">
                    {effort.map((stat) => (
                      <SignalRow
                        className="flex flex-col gap-1 lg:grid"
                        key={stat.key}
                        label={stat.label}
                        value={stat.value}
                        unit={stat.unit}
                        source="provider"
                        provenance="Garmin"
                        provenanceVariant="mono"
                      />
                    ))}
                  </SignalList>
                </section>
              )}
              {view.zoneTime && (
                <section
                  aria-label="Temps dans les zones"
                  className="flex flex-col gap-3"
                >
                  <MonoLabel>Temps dans les zones</MonoLabel>
                  <div className="flex flex-col gap-2">
                    {view.zoneTime.map(({ zone, seconds }) => {
                      const total = view.zoneTime!.reduce(
                        (sum, item) => sum + item.seconds,
                        0,
                      );
                      const percentage =
                        total > 0 ? (seconds / total) * 100 : 0;
                      return (
                        <div
                          key={zone}
                          className="grid grid-cols-[2rem_minmax(0,1fr)_3rem] items-center gap-3"
                        >
                          <MonoLabel size="micro">Z{zone}</MonoLabel>
                          <div className="h-2 overflow-hidden rounded-mark bg-surface-raised">
                            <div
                              className="h-full rounded-mark"
                              style={{
                                width: `${percentage}%`,
                                background: `var(--zone-${zone})`,
                              }}
                            />
                          </div>
                          <span className="text-right font-mono text-micro text-muted">
                            {formatClock(seconds)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <ProvenanceLabel source="estimate">
                    Estimation Stride · histogramme Garmin ·{" "}
                    {zoneMethod === "karvonen"
                      ? "zones selon la réserve cardiaque"
                      : "zones selon la FC maximale"}
                  </ProvenanceLabel>
                </section>
              )}
              {view.charts && <ActivityScatter view={view.charts} />}
            </div>
          </div>
          <ProvenanceLabel source="provider">
            {imported
              ? `Garmin · détail importé le ${imported}`
              : "Garmin · détail importé"}
          </ProvenanceLabel>
        </article>
      </div>
    </>
  );
}
