import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import { ProvenanceLabel } from "@/components/stride/provenance";
import {
  activityTitle,
  detailMetrics,
  type Activity,
} from "@/features/activities/activities";

export function ActivityDetail({
  activity,
  current,
}: {
  activity: Activity;
  current: boolean;
}) {
  const Heading = current ? "h1" : "h2";
  const metrics = detailMetrics(activity);
  return (
    <article className="flex w-full max-w-240 flex-col gap-8 px-5 pt-8 pb-12 sm:px-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <Heading className="text-headline font-semibold text-balance sm:text-[2.375rem] sm:leading-none sm:tracking-[-0.03em]">
          {activityTitle(activity)}
        </Heading>
        {metrics.length > 0 && (
          <dl className="flex flex-wrap gap-x-6.5 gap-y-4">
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
      <ProvenanceLabel source="provider">
        Garmin · données importées
      </ProvenanceLabel>
    </article>
  );
}
