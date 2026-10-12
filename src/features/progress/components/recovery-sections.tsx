import {
  ChartInspector,
  type InspectorTone,
} from "@/components/stride/chart-inspector";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot, TrendMark, type Trend } from "@/components/stride/marks";
import { cn } from "@/lib/utils";
import { Legend, nightTitle, RangeChart } from "./charts";
import type { Deviation, RecoveryView, SignalCard } from "../recovery-view";
import { formatSleep } from "../recovery-view";

function Source({ children }: { children: React.ReactNode }) {
  return (
    <MonoLabel size="nano" className="inline-flex items-center gap-1">
      <PulseDot tone="provider" breathing={false} className="size-1.25" />
      {children}
    </MonoLabel>
  );
}

export function ReadinessSection({
  readiness,
  deviations,
}: {
  readiness: NonNullable<RecoveryView["readiness"]>;
  deviations: Deviation[];
}) {
  const average = readiness.average;
  const anchor =
    average === null ? readiness.today : (average + readiness.today) / 2;
  return (
    <section
      aria-labelledby="recovery-readiness"
      className="flex flex-col gap-4.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-12"
    >
      <div className="flex items-center gap-4 sm:min-w-50 sm:flex-col sm:items-start sm:gap-2">
        <span className="font-metric text-[64px] leading-[0.8] font-semibold tabular-nums sm:order-2 sm:text-[120px]">
          {readiness.today}
        </span>
        <div className="flex flex-col gap-1.5 sm:contents">
          <MonoLabel
            id="recovery-readiness"
            size="micro"
            className="sm:order-1 sm:text-label"
          >
            Forme du jour · Garmin
          </MonoLabel>
          <span className="flex items-center gap-1.5 text-sm font-medium sm:order-3 sm:text-[15px]">
            <TrendMark trend={readiness.trend} />
            {readiness.label}
          </span>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 sm:flex-[1_1_560px]">
        <MonoLabel size="micro" className="sm:text-label">
          Ce qui bouge entre ta moyenne sur 14 j et aujourd’hui
        </MonoLabel>
        <ChartInspector
          label="Écarts entre ta moyenne sur 14 jours et aujourd’hui"
          points={[
            {
              x: 1 / 14,
              title: "Moyenne sur 14 jours",
              rows: [
                {
                  label: "Forme du jour Garmin",
                  value: average === null ? "—" : String(Math.round(average)),
                  tone: "muted",
                },
              ],
            },
            ...deviations.map((item, index) => ({
              x: (2 * index + 3) / 14,
              title: item.caption,
              rows: [
                {
                  label: "Écart",
                  value: item.value,
                  tone: (item.score === null
                    ? "muted"
                    : item.score > 0.05
                      ? "success"
                      : item.score < -0.05
                        ? "warning"
                        : "muted") as InspectorTone,
                },
              ],
              note: item.reference
                ? `Référence : ${item.reference}`
                : "Pas assez de mesures pour comparer.",
            })),
            {
              x: 13 / 14,
              title: "Aujourd’hui",
              rows: [
                {
                  label: "Forme du jour Garmin",
                  value: String(readiness.today),
                  tone: "foreground",
                },
              ],
            },
          ]}
        >
          <div className="grid h-25 grid-cols-7 items-end gap-1.5 border-b border-border-strong sm:h-45">
            <span className="relative h-full">
              {average !== null && (
                <span
                  className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-border-strong"
                  style={{ height: `${average}%` }}
                />
              )}
            </span>
            {deviations.map((item) => {
              const size = item.score === null ? 0 : Math.abs(item.score) * 12;
              return (
                <span key={item.key} className="relative h-full">
                  {item.score !== null && (
                    <span
                      className={cn(
                        "absolute inset-x-0 min-h-0.5 rounded-mark",
                        item.score > 0.05
                          ? "bg-success"
                          : item.score < -0.05
                            ? "bg-warning"
                            : "bg-dim",
                      )}
                      style={{
                        bottom: `${item.score >= 0 ? anchor : anchor - size}%`,
                        height: `${size}%`,
                      }}
                    />
                  )}
                </span>
              );
            })}
            <span
              className="rounded-t-[3px] bg-foreground"
              style={{ height: `${readiness.today}%` }}
            />
          </div>
        </ChartInspector>
        <dl className="grid grid-cols-7 gap-1.5 text-[10px] leading-tight sm:text-xs">
          {[
            {
              key: "average",
              value: average === null ? "—" : String(Math.round(average)),
              caption: "Moy. 14 j",
            },
            ...deviations,
            {
              key: "today",
              value: String(readiness.today),
              caption: "Aujourd’hui",
            },
          ].map((item) => (
            <div key={item.key} className="flex min-w-0 flex-col">
              <dt className="order-2 text-muted-foreground">{item.caption}</dt>
              <dd className="order-1 truncate font-metric text-sm font-semibold sm:text-lg">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-mark bg-border-strong"
            />
            Moyenne 14 j
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-mark bg-warning"
            />
            Écart défavorable
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-mark bg-success"
            />
            Écart favorable
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-mark bg-foreground"
            />
            Aujourd’hui
          </li>
        </ul>
      </div>
    </section>
  );
}

function CardHeader({
  id,
  title,
  card,
}: {
  id: string;
  title: string;
  card: SignalCard;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={id}
          className="flex items-center gap-2 text-base font-semibold sm:text-lg"
        >
          {title}
          <Source>Garmin</Source>
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-muted sm:text-meta">
          <TrendMark trend={card.trend} />
          {card.status}
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="font-metric text-[36px] leading-none font-semibold tabular-nums sm:text-[44px]">
          {card.value}
        </span>
        <span className="text-meta text-muted-foreground">{card.context}</span>
      </div>
    </>
  );
}

export function SleepCard({
  sleep,
}: {
  sleep: NonNullable<RecoveryView["sleep"]>;
}) {
  const max = Math.max(1, ...sleep.nights.map((night) => night.seconds ?? 0));
  return (
    <section aria-labelledby="recovery-sleep" className="flex flex-col gap-2.5">
      <CardHeader id="recovery-sleep" title="Sommeil" card={sleep} />
      <ChartInspector
        label="Durée de sommeil des 14 dernières nuits"
        points={sleep.nights.map((night, index, all) => ({
          x: (index + 0.5) / all.length,
          title: nightTitle(night.day),
          rows:
            night.seconds === null
              ? [{ label: "Sommeil", value: "Non mesuré", tone: "muted" }]
              : [
                  {
                    label: "Durée",
                    value: formatSleep(night.seconds),
                    tone: night.today ? "warning" : "provider",
                  },
                  ...(night.score === null
                    ? []
                    : [
                        {
                          label: "Score Garmin",
                          value: `${Math.round(night.score)} /100`,
                        },
                      ]),
                ],
        }))}
      >
        <ol className="flex h-22.5 items-end gap-1 border-b border-border-strong">
          {sleep.nights.map((night) => (
            <li
              key={night.day}
              className={cn(
                "flex-1 rounded-t-mark",
                night.today ? "bg-warning" : "bg-provider",
              )}
              style={{ height: `${((night.seconds ?? 0) / max) * 100}%` }}
            >
              <span className="sr-only">
                {night.seconds === null
                  ? "Nuit non mesurée"
                  : `Nuit de ${formatSleep(night.seconds)}`}
              </span>
            </li>
          ))}
        </ol>
      </ChartInspector>
      <Legend
        items={[
          {
            label: "Nuits précédentes",
            swatch: "size-2.5 rounded-mark bg-provider",
          },
          {
            label: "Dernière nuit",
            swatch: "size-2.5 rounded-mark bg-warning",
          },
        ]}
      />
    </section>
  );
}

export function RangeCard({
  id,
  title,
  card,
  label,
  unit,
  measure,
}: {
  id: string;
  title: string;
  card: NonNullable<RecoveryView["hrv"]>;
  label: string;
  unit: string;
  measure: string;
}) {
  const unfavorable: Trend[] = ["watch", "investigate"];
  const range = card.range
    ? card.range.low === card.range.high
      ? `${card.range.low} ${unit}`
      : `${card.range.low}–${card.range.high} ${unit}`
    : null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <CardHeader id={id} title={title} card={card} />
      <ChartInspector
        label={label}
        points={card.points.map((point, index, all) => ({
          x: all.length > 1 ? index / (all.length - 1) : 0.5,
          title: nightTitle(point.day),
          rows: [
            {
              label: measure,
              value:
                point.value === null
                  ? "Non mesuré"
                  : `${Math.round(point.value)} ${unit}`,
              tone: point.value === null ? "muted" : "foreground",
            },
          ],
          note: range ? `Plage habituelle : ${range}` : undefined,
        }))}
      >
        <RangeChart
          card={card}
          label={label}
          unfavorable={unfavorable.includes(card.trend)}
        />
      </ChartInspector>
      <Legend
        items={[
          { label: measure, swatch: "h-0.5 w-3.5 bg-foreground" },
          ...(range
            ? [
                {
                  label: `Plage habituelle ${range}`,
                  swatch:
                    "h-2.5 w-3.5 rounded-mark bg-surface-raised ring-1 ring-border-strong",
                },
              ]
            : []),
        ]}
      />
      <p className="text-xs text-muted-foreground">{card.note}</p>
    </section>
  );
}

export function MissingCard({
  id,
  title,
  message,
}: {
  id: string;
  title: string;
  message: string;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <h2 id={id} className="text-base font-semibold sm:text-lg">
        {title}
      </h2>
      <p className="border-t border-border pt-3 text-sm text-muted-foreground">
        {message}
      </p>
    </section>
  );
}

export function PlanChangesSection({
  races,
  racesNote,
}: Pick<RecoveryView, "races" | "racesNote">) {
  const max = Math.max(14, ...races.map((race) => race.days));
  return (
    <section
      aria-labelledby="recovery-plan"
      className="flex min-w-0 flex-[999_1_520px] flex-col gap-3.5"
    >
      <h2 id="recovery-plan" className="text-base font-semibold sm:text-xl">
        Ce que la récupération a changé à ton plan
      </h2>
      <p className="border-y border-border py-3.75 text-sm text-muted-foreground">
        Les ajustements apparaîtront ici quand Stride gérera ton plan
        d’entraînement.
      </p>
      <div className="mt-2 flex flex-col gap-2.5 sm:mt-5">
        <h3 className="text-base font-semibold">Récupération après course</h3>
        {races.length ? (
          <ul className="flex flex-col gap-2.5">
            {races.map((race) => (
              <li
                key={race.id}
                className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm sm:grid-cols-[7rem_minmax(0,1fr)_4.5rem]"
              >
                <span className="truncate">{race.name}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2.5 rounded-mark",
                    race.ongoing
                      ? "border border-dashed border-dim"
                      : "bg-provider",
                  )}
                  style={{ width: `${(race.days / max) * 100}%` }}
                />
                <span className="text-right font-metric text-lg font-semibold">
                  {race.ongoing
                    ? `${race.days} j +`
                    : `${race.days} jour${race.days > 1 ? "s" : ""}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune course passée avec des mesures de VFC.
          </p>
        )}
        <p className="text-xs text-muted-foreground">{racesNote}</p>
      </div>
    </section>
  );
}
