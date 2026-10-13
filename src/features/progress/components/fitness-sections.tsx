import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import {
  ConfidenceMeter,
  type Confidence,
} from "@/components/stride/confidence-meter";
import { ChartInspector } from "@/components/stride/chart-inspector";
import { CoachNote } from "@/components/stride/coach-note";
import { SourceMark } from "@/components/stride/marks";
import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import { Sparkline } from "@/components/stride/sparkline";
import { VerdictList, VerdictRow } from "@/components/stride/verdict-row";
import { cn } from "@/lib/utils";
import type { MeasureRow, RecordRow } from "../fitness";
import type { RacePredictions } from "../predictions";
import type { WeekVolume } from "../volume";
import { formatDayMonth, formatHours, formatInteger } from "../format";

const confidenceLabels: Record<Confidence, string> = {
  low: "Confiance faible",
  moderate: "Confiance moyenne",
  high: "Confiance élevée",
};

function SectionTitle({
  id,
  children,
  meta,
}: {
  id: string;
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2
        id={id}
        className="flex items-center gap-2 text-base font-semibold sm:text-xl"
      >
        {children}
      </h2>
      {meta && (
        <MonoLabel size="micro" className="max-w-36 text-right">
          {meta}
        </MonoLabel>
      )}
    </div>
  );
}

export function MeasureSection({
  rows,
  note,
}: {
  rows: MeasureRow[];
  note: string | null;
}) {
  return (
    <section
      aria-labelledby="progress-measures"
      className="flex min-w-0 flex-[999_1_620px] flex-col gap-3.5"
    >
      <SectionTitle id="progress-measures">Ce qui évolue</SectionTitle>
      <VerdictList>
        {rows.map((row) => (
          <VerdictRow
            key={row.key}
            label={
              <span className="font-medium sm:text-[15px]">{row.label}</span>
            }
            detail={row.detail}
            value={
              <span className={cn(!row.trend && "text-dim")}>{row.value}</span>
            }
            metricSize="lg"
            trend={row.trend}
            verdict={row.verdict}
            className="py-3.5 sm:py-3.75 [&_[data-slot=trend-label]]:text-meta"
          >
            {row.samples ? (
              <ChartInspector
                label={`Évolution · ${row.label}`}
                points={row.samples.map((sample, index, all) => ({
                  x: all.length > 1 ? index / (all.length - 1) : 0.5,
                  title: sample.title,
                  rows: [{ label: row.label, value: sample.value }],
                }))}
                className="w-fit"
              >
                <Sparkline
                  values={row.sparkline ?? []}
                  tone={row.tone}
                  className="max-lg:h-6 max-lg:w-15"
                />
              </ChartInspector>
            ) : (
              <Sparkline
                values={row.sparkline ?? []}
                tone={row.tone}
                className="max-lg:h-6 max-lg:w-15"
              />
            )}
          </VerdictRow>
        ))}
      </VerdictList>
      {note && <CoachNote className="mt-2 leading-normal">{note}</CoachNote>}
    </section>
  );
}

export function PredictionSection({
  predictions,
  times,
}: {
  predictions: RacePredictions | null;
  times: { key: string; label: string; value: string }[];
}) {
  const confidence = new Map(
    (predictions?.predictions ?? []).map((item) => [item.key, item.confidence]),
  );
  return (
    <section
      aria-labelledby="progress-predictions"
      className="flex flex-col gap-3"
    >
      <SectionTitle
        id="progress-predictions"
        meta={predictions ? "Si tu courais cette semaine" : undefined}
      >
        Prévisions de course
        <SourceMark source="estimate" className="sm:hidden" />
      </SectionTitle>
      {predictions ? (
        <>
          <ul className="flex flex-col border-t border-border">
            {times.map((time) => {
              const level = confidence.get(
                time.key as RacePredictions["predictions"][number]["key"],
              )!;
              return (
                <li
                  key={time.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto_3rem] items-center gap-3 border-b border-border py-3 sm:grid-cols-[minmax(0,1fr)_auto_3.5rem] sm:gap-3.5"
                >
                  <span className="text-sm">{time.label}</span>
                  <Metric value={time.value} className="sm:text-2xl" />
                  <ConfidenceMeter
                    level={level}
                    label={confidenceLabels[level]}
                    hideLabel
                    className="justify-self-end"
                  />
                </li>
              );
            })}
            {predictions.goal && (
              <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3">
                <Link
                  href={`/races/${predictions.goal.id}`}
                  className="truncate text-sm hover:text-accent focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {predictions.goal.name} →
                </Link>
                <span className="text-xs text-muted-foreground">
                  Projection à venir
                </span>
              </li>
            )}
          </ul>
          <p className="flex items-center gap-1.75 text-xs text-muted-foreground">
            <SourceMark source="estimate" />
            {`Estimation Stride depuis ta VO₂ max Garmin (${formatInteger(predictions.vo2)} au ${formatDayMonth(predictions.observedOn)}), sur route plate.`}
          </p>
        </>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          Pas de VO₂ max Garmin récente : les prévisions reviendront après ta
          prochaine sortie mesurée.
        </p>
      )}
    </section>
  );
}

export function WeeklyHoursSection({ weeks }: { weeks: WeekVolume[] }) {
  const max = Math.max(1, ...weeks.map((week) => week.seconds));
  const hasRace = weeks.some((week) => week.race);
  return (
    <section aria-labelledby="progress-hours" className="flex flex-col gap-3">
      <SectionTitle id="progress-hours">
        Heures par semaine · {weeks.length} sem.
      </SectionTitle>
      <ChartInspector
        label="Heures d’entraînement par semaine"
        points={weeks.map((week, index) => ({
          x: (index + 0.5) / weeks.length,
          title: `Semaine du ${formatDayMonth(week.start)}`,
          rows: [
            {
              label: week.current ? "En cours" : "Entraînement",
              value: formatHours(week.seconds),
              tone: week.race ? "zone-3" : "provider",
            },
            ...(week.race
              ? [{ label: "Semaine de course", value: "Oui" }]
              : []),
          ],
        }))}
      >
        <ol className="flex h-27.5 items-end gap-1 border-b border-border-strong">
          {weeks.map((week) => (
            <li
              key={week.start}
              className={cn(
                "flex-1 rounded-t-mark",
                week.current
                  ? "border-[1.5px] border-b-0 border-accent"
                  : week.race
                    ? "bg-zone-3"
                    : "bg-provider",
              )}
              style={{
                height: `${Math.max(week.seconds > 0 ? 2 : 0, (week.seconds / max) * 100)}%`,
              }}
            >
              <span className="sr-only">
                {`Semaine du ${formatDayMonth(week.start)} : ${formatHours(week.seconds)}${week.race ? ", semaine de course" : ""}${week.current ? ", en cours" : ""}`}
              </span>
            </li>
          ))}
        </ol>
      </ChartInspector>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{formatDayMonth(weeks[0].start)}</span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-mark bg-provider"
          />
          Toutes activités
        </span>
        {hasRace && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-mark bg-zone-3"
            />
            Semaines de course
          </span>
        )}
        <span>Maintenant</span>
      </div>
    </section>
  );
}

export function RecordsSection({ records }: { records: RecordRow[] }) {
  return (
    <section aria-labelledby="progress-records" className="flex flex-col gap-3">
      <SectionTitle id="progress-records">Records</SectionTitle>
      {records.length ? (
        <dl className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-4 gap-y-2.5 text-sm">
          {records.map((record) => (
            <div key={record.key} className="contents">
              <dt>
                {record.href ? (
                  <Link
                    href={record.href}
                    className="hover:text-accent focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {record.label}
                  </Link>
                ) : (
                  record.label
                )}
              </dt>
              <dd>
                <Metric value={record.value} size="sm" className="sm:text-xl" />
              </dd>
              <dd className="text-xs text-muted-foreground">{record.date}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucune sortie enregistrée pour établir des records.
        </p>
      )}
    </section>
  );
}
