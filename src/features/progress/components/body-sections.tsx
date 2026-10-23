import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { ChartInspector } from "@/components/stride/chart-inspector";
import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  BodyKpi,
  BodyNights,
  ReadinessAdvice,
  ReadinessFactor,
  ReadinessSummary,
  TodaySession,
} from "../body";
import { lighterSessionHref, sessionHref } from "../body";
import { formatInteger } from "../format";
import type { HealthRange } from "../health";
import type { RecoveryView } from "../recovery-view";
import { formatSleep } from "../recovery-view";
import { Legend, nightTitle, RangeChart } from "./charts";

const ringTones = {
  success: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
} as const;

export function ReadinessCard({
  summary,
  advice,
  session,
}: {
  summary: ReadinessSummary | null;
  advice: ReadinessAdvice | null;
  session: TodaySession | null;
}) {
  const planHref = session ? sessionHref(session) : null;
  const lighterHref = session ? lighterSessionHref(session) : null;
  return (
    <section
      aria-labelledby="body-readiness"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5"
    >
      {summary ? (
        <div className="flex items-center gap-4">
          <span className="relative size-19 shrink-0">
            <svg viewBox="0 0 64 64" aria-hidden="true" className="size-full">
              <circle
                cx="32"
                cy="32"
                r="27"
                fill="none"
                strokeWidth="6"
                className="stroke-border"
              />
              <circle
                cx="32"
                cy="32"
                r="27"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray={`${Math.max(0, Math.min(100, summary.score))} 100`}
                transform="rotate(-90 32 32)"
                className={ringTones[summary.tone]}
              />
            </svg>
            <Metric
              value={formatInteger(summary.score)}
              className="absolute inset-0 justify-center self-center text-[28px] leading-[76px]"
            />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <MonoLabel id="body-readiness" size="micro">
              Prêt pour aujourd’hui ?
            </MonoLabel>
            <span className="text-lg font-semibold sm:text-xl">
              {summary.level}
              {summary.gap ? ` · ${summary.gap}` : ""}
            </span>
            <span className="text-meta text-muted-foreground">
              Disponibilité Garmin + ton ressenti
            </span>
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <MonoLabel id="body-readiness" size="micro">
            Prêt pour aujourd’hui ?
          </MonoLabel>
          <p className="text-sm text-muted-foreground">
            Garmin n’a pas transmis de disponibilité pour aujourd’hui.
          </p>
        </div>
      )}
      {advice &&
        (session && planHref ? (
          <Link
            href={planHref}
            className="flex flex-col gap-1 rounded-surface border border-border p-3.5 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
          >
            <MonoLabel size="micro">Séance du jour</MonoLabel>
            <span className="font-semibold">{session.title}</span>
            <span className="text-meta leading-normal text-muted">
              {advice.text}
            </span>
          </Link>
        ) : (
          <p className="text-meta leading-normal text-muted">{advice.text}</p>
        ))}
      {session && planHref && (
        <div className="flex gap-2 [&>*]:flex-1">
          <Button
            asChild
            variant="outline"
            size="md"
            className="max-sm:min-h-11"
          >
            <Link href={planHref}>Voir la séance</Link>
          </Button>
          {advice?.lighter && lighterHref && (
            <Button
              asChild
              variant="outline"
              size="md"
              className="max-sm:min-h-11"
            >
              <Link href={lighterHref}>Version allégée</Link>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

const factorTones = {
  danger: "text-danger",
  warning: "text-warning",
  muted: "text-muted",
  success: "text-success",
} as const;

export function FactorsSection({ factors }: { factors: ReadinessFactor[] }) {
  return (
    <section aria-labelledby="body-factors" className="flex flex-col gap-1.5">
      <h2 id="body-factors" className="text-base font-semibold sm:text-lg">
        Ce qui pèse aujourd’hui
      </h2>
      {factors.length ? (
        <ul className="flex flex-col border-t border-border">
          {factors.map((factor) => (
            <li
              key={factor.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-border-subtle py-2.75"
            >
              <span className="text-sm">{factor.label}</span>
              <span
                className={cn(
                  "font-metric text-lg font-semibold",
                  factorTones[factor.tone],
                )}
              >
                {factor.value}
              </span>
              <span className="col-span-2 text-xs text-muted-foreground">
                {factor.reason}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          Aucun signal Garmin récent ni ressenti saisi aujourd’hui.
        </p>
      )}
    </section>
  );
}

export function NightsSection({ nights }: { nights: BodyNights }) {
  const max = Math.max(1, ...nights.nights.map((night) => night.seconds ?? 0));
  const hasNight = nights.nights.some((night) => night.seconds !== null);
  return (
    <section aria-labelledby="body-nights" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="body-nights" className="text-base font-semibold sm:text-lg">
          Nuits
        </h2>
        {nights.summary && (
          <span className="text-meta text-muted">{nights.summary}</span>
        )}
      </div>
      {hasNight ? (
        <>
          <ChartInspector
            label={`Durée et phases de sommeil des ${nights.nights.length} dernières nuits`}
            points={nights.nights.map((night, index, all) => ({
              x: (index + 0.5) / all.length,
              title: nightTitle(night.day),
              rows:
                night.seconds === null
                  ? [{ label: "Sommeil", value: "Non mesuré", tone: "muted" }]
                  : [
                      {
                        label: "Durée",
                        value: formatSleep(night.seconds),
                        tone: night.short ? "warning" : "provider",
                      },
                      ...(night.deep === null
                        ? []
                        : [
                            {
                              label: "Profond",
                              value: formatSleep(night.deep),
                            },
                          ]),
                      ...(night.rem === null
                        ? []
                        : [
                            {
                              label: "Paradoxal",
                              value: formatSleep(night.rem),
                            },
                          ]),
                    ],
              note:
                nights.average === null
                  ? undefined
                  : `Ta moyenne : ${formatSleep(nights.average)}`,
            }))}
          >
            <ol className="flex h-30 items-end gap-1 border-b border-border-strong sm:h-37.5 sm:gap-2">
              {nights.nights.map((night) => {
                const staged =
                  night.deep !== null &&
                  night.light !== null &&
                  night.rem !== null &&
                  night.deep + night.light + night.rem > 0;
                return (
                  <li
                    key={night.day}
                    className={cn(
                      "flex flex-1 flex-col overflow-hidden rounded-t-[3px]",
                      night.short &&
                        "outline-[1.5px] outline-offset-2 outline-danger",
                      !staged && "bg-provider/60",
                    )}
                    style={{
                      height: `${((night.seconds ?? 0) / max) * 100}%`,
                    }}
                  >
                    {staged && (
                      <>
                        <span
                          className="bg-provider"
                          style={{ flex: night.rem! }}
                        />
                        <span
                          className="bg-provider/60"
                          style={{ flex: night.light! }}
                        />
                        <span
                          className="bg-provider/35"
                          style={{ flex: night.deep! }}
                        />
                      </>
                    )}
                    <span className="sr-only">
                      {`${nightTitle(night.day)} : ${night.seconds === null ? "non mesurée" : formatSleep(night.seconds)}${night.short ? ", nuit courte" : ""}`}
                    </span>
                  </li>
                );
              })}
            </ol>
          </ChartInspector>
          <Legend
            items={[
              {
                label: "Paradoxal",
                swatch: "size-2.5 rounded-mark bg-provider",
              },
              {
                label: "Léger",
                swatch: "size-2.5 rounded-mark bg-provider/60",
              },
              {
                label: "Profond",
                swatch: "size-2.5 rounded-mark bg-provider/35",
              },
              {
                label: "Nuit courte",
                swatch: "size-2.5 rounded-mark outline-[1.5px] outline-danger",
              },
            ]}
          />
        </>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          Aucune nuit mesurée par Garmin sur cette période.
        </p>
      )}
    </section>
  );
}

function rangeText(range: { low: number; high: number } | null) {
  if (!range) return null;
  return range.low === range.high
    ? `${range.low}`
    : `${range.low}–${range.high}`;
}

function RangeCard({
  id,
  title,
  unit,
  signal,
  higherIsBetter,
  caption,
  chartDays,
}: {
  id: string;
  title: string;
  unit: string;
  signal: HealthRange | null;
  higherIsBetter: boolean;
  caption: (signal: HealthRange) => string;
  chartDays: number;
}) {
  const unfavorable = higherIsBetter ? "below" : "above";
  const status = !signal
    ? null
    : signal.position === null
      ? { label: "Plage en cours de calcul", tone: "text-muted-foreground" }
      : signal.position === "within"
        ? {
            label: higherIsBetter ? "Dans ta plage" : "Stable",
            tone: "text-success",
          }
        : signal.position === unfavorable
          ? {
              label: higherIsBetter ? "Sous ta plage" : "Au-dessus",
              tone: "text-warning",
            }
          : {
              label: higherIsBetter ? "Au-dessus de ta plage" : "Plus basse",
              tone: "text-success",
            };
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-2 rounded-card border border-border bg-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={id}>
          <MonoLabel size="micro">{title}</MonoLabel>
        </h3>
        {status && (
          <span className={cn("text-xs", status.tone)}>{status.label}</span>
        )}
      </div>
      {signal ? (
        <>
          <Metric
            value={formatInteger(signal.last)}
            unit={unit}
            className="text-[30px] [&>span]:text-[15px] [&>span]:text-muted-foreground"
          />
          <ChartInspector
            label={`${title} sur ${chartDays} jours`}
            points={signal.points.map((point, index, all) => ({
              x: all.length > 1 ? index / (all.length - 1) : 0.5,
              title: nightTitle(point.day),
              rows: [
                {
                  label: title,
                  value:
                    point.value === null
                      ? "Non mesurée"
                      : `${Math.round(point.value)} ${unit}`,
                  tone: "foreground",
                },
              ],
              note: signal.range
                ? `Plage habituelle : ${rangeText(signal.range)} ${unit}`
                : undefined,
            }))}
          >
            <RangeChart
              card={signal}
              label={`${title} sur ${chartDays} jours`}
              unfavorable={signal.position === unfavorable}
              height={70}
            />
          </ChartInspector>
          <span className="text-xs text-muted-foreground">
            {caption(signal)}
          </span>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucune mesure ces deux derniers jours.
        </p>
      )}
    </section>
  );
}

export function HeartCards({
  hrv,
  resting,
  chartDays,
}: {
  hrv: HealthRange | null;
  resting: HealthRange | null;
  chartDays: number;
}) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      <RangeCard
        id="body-hrv"
        title="VFC nocturne"
        unit="ms"
        signal={hrv}
        higherIsBetter
        chartDays={chartDays}
        caption={(signal) =>
          signal.range
            ? `plage ${rangeText(signal.range)} ms · 28 nuits`
            : "plage en cours de calcul"
        }
      />
      <RangeCard
        id="body-resting"
        title="FC au repos"
        unit="bpm"
        signal={resting}
        higherIsBetter={false}
        chartDays={chartDays}
        caption={(signal) =>
          signal.median === null
            ? "médiane en cours de calcul"
            : `médiane ${formatInteger(signal.median)} bpm · 28 j`
        }
      />
    </div>
  );
}

const kpiTones = {
  warning: "text-warning",
  success: "text-success",
  muted: "text-muted-foreground",
} as const;

export function KpiCards({ kpis }: { kpis: BodyKpi[] }) {
  if (kpis.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-2.5">
      {kpis.map((kpi) => (
        <div
          key={kpi.key}
          className="flex flex-col gap-1 rounded-card border border-border bg-surface p-3.5"
        >
          <dt>
            <MonoLabel size="micro">{kpi.label}</MonoLabel>
          </dt>
          <dd>
            <Metric value={kpi.value} className="text-[26px]" />
          </dd>
          <dd className={cn("text-xs", kpiTones[kpi.tone])}>{kpi.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

const monthShort = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  timeZone: "UTC",
});

export function RaceRecoveries({
  races,
  note,
}: {
  races: RecoveryView["races"];
  note: string;
}) {
  return (
    <section aria-labelledby="body-races" className="flex flex-col gap-2.5">
      <h2 id="body-races" className="text-base font-semibold sm:text-lg">
        Après tes courses
      </h2>
      {races.length ? (
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3.5 gap-y-2.5 border-t border-border pt-3 text-sm">
          {races.map((race) => (
            <div key={race.id} className="contents">
              <dt className="truncate">
                {race.name} ·{" "}
                {monthShort.format(new Date(`${race.day}T00:00:00Z`))}
              </dt>
              <dd className="text-meta text-muted">
                {race.ongoing ? "VFC basse depuis " : "VFC normale en "}
                <Metric
                  value={`${formatInteger(race.days)} j`}
                  className="text-lg text-foreground"
                />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          Aucune course passée avec des mesures de VFC.
        </p>
      )}
      <p className="text-xs text-muted-foreground">{note}</p>
    </section>
  );
}
