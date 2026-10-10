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
  filter,
  limit,
  sync,
  today,
}: {
  activity: ActivityDetailData;
  segments: ActivitySegment[];
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
        <SidebarTrigger />
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
        <article className="mx-auto flex w-full max-w-290 flex-col gap-10 px-5 pt-8 pb-12 sm:px-10">
          <header className="flex flex-col gap-3">
            <MonoLabel size="label">{kicker.join(" · ")}</MonoLabel>
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
              <h1 className="text-headline font-semibold text-balance sm:text-[2.375rem] sm:leading-none sm:tracking-[-0.03em]">
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
                          size="lg"
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
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
            {laps ? (
              <LapTableSection table={laps} />
            ) : (
              <p className="text-body text-muted">
                Garmin n’a transmis aucun tour pour cette activité.
              </p>
            )}
            {effort.length > 0 && (
              <section
                aria-labelledby="activity-effort"
                className="flex flex-col gap-3"
              >
                <MonoLabel asChild>
                  <h2 id="activity-effort">Effort</h2>
                </MonoLabel>
                <SignalList>
                  {effort.map((stat) => (
                    <SignalRow
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
