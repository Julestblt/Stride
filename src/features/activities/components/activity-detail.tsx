import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import { RouteCard } from "./route-card";
import { ActivityCharts } from "./activity-charts";
import type { ActivityView } from "../activity-view";
import { effortStats, type ActivityDetailData } from "../detail";
import {
  ProvenanceLabel,
  SignalList,
  SignalRow,
} from "@/components/stride/provenance";
import { activityTitle, detailMetrics } from "@/features/activities/activities";

export function ActivityDetail({
  activity,
  view,
  current,
  detailHref,
  pair = null,
}: {
  activity: ActivityDetailData;
  view: ActivityView | null;
  current: boolean;
  detailHref: string;
  pair?: React.ReactNode;
}) {
  const Heading = current ? "h1" : "h2";
  const available = detailMetrics(activity);
  const headlineKeys = ["distance", "duration", "heartRate"];
  const metrics = [
    ...available.filter((metric) => headlineKeys.includes(metric.key)),
    ...available.filter((metric) => metric.key === "elevation"),
    ...available.filter((metric) => metric.key === "pace"),
  ].slice(0, 3);
  const effort = effortStats(activity).slice(0, 4);
  return (
    <article className="flex w-full max-w-240 flex-col gap-8 px-5 pt-8 pb-12 lg:px-10 2xl:mx-auto 2xl:max-w-360">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <Heading className="min-w-0 text-headline font-semibold text-balance break-words sm:text-[2.375rem] sm:leading-none sm:tracking-[-0.03em]">
          {activityTitle(activity)}
        </Heading>
        {metrics.length > 0 && (
          <dl className="flex flex-wrap gap-x-5 gap-y-4">
            {metrics.map((metric) => (
              <div key={metric.key} className="flex flex-col-reverse">
                <MonoLabel size="micro" asChild>
                  <dt>{metric.label}</dt>
                </MonoLabel>
                <dd>
                  <Metric size="lg" value={metric.value} unit={metric.unit} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </header>
      {metrics.length === 0 && (
        <p className="text-body text-muted">
          Garmin n’a transmis aucune mesure pour cette activité.
        </p>
      )}
      {pair}
      {view?.route ? (
        <RouteCard
          key={`route:${activity.id}`}
          view={view.route}
          gain={activity.elevationGainMeters}
          height="h-64 lg:h-90"
        />
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
      {effort.length > 0 && (
        <section
          aria-label="Effort enregistré"
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5"
        >
          <MonoLabel>Effort enregistré</MonoLabel>
          <SignalList className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {effort.map((stat) => (
              <SignalRow
                key={stat.key}
                label={stat.label}
                value={stat.value}
                unit={stat.unit}
                source="provider"
              />
            ))}
          </SignalList>
        </section>
      )}
      {view?.charts && (
        <ActivityCharts
          key={`charts:${activity.id}`}
          view={view.charts}
          metrics={["pace", "heartRate"]}
        />
      )}
      <div className="flex flex-col items-start gap-5">
        <Link
          href={detailHref}
          className="text-meta text-accent hover:text-foreground"
        >
          Détail complet : tours et effort →
        </Link>
        <ProvenanceLabel source="provider">
          Garmin · données importées
        </ProvenanceLabel>
      </div>
    </article>
  );
}
