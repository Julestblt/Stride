import Link from "next/link";
import { ChartInspector } from "@/components/stride/chart-inspector";
import { TrendMark } from "@/components/stride/marks";
import { MonoLabel } from "@/components/stride/mono-label";
import { StrideMark } from "@/components/stride/stride-mark";
import { cn } from "@/lib/utils";
import { formatInteger } from "../format";
import {
  healthViewLabels,
  healthViews,
  type HealthModel,
  type HealthView,
} from "../health";
import {
  formatRatio,
  formatStage,
  stressLabel,
  type HealthKpi,
  type HealthPageView,
  type Tone,
} from "../health-view";
import { formatSleep } from "../recovery-view";
import { Legend, nightTitle, RangeChart } from "./charts";

const toneDot: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  muted: "bg-muted-foreground",
};

const toneText: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-foreground",
};

export function HealthViewSwitch({
  current,
  date,
}: {
  current: HealthView;
  date: string;
}) {
  return (
    <div className="flex items-center gap-4 max-sm:w-full">
      <MonoLabel size="micro" className="max-sm:hidden">
        {date}
      </MonoLabel>
      <nav
        aria-label="Période"
        className="flex gap-0.5 rounded-surface border border-border bg-surface p-0.75 max-sm:flex-1"
      >
        {healthViews.map((view) => (
          <Link
            key={view}
            href={
              view === "week"
                ? "/progress/health"
                : `/progress/health?view=${view}`
            }
            aria-current={view === current ? "page" : undefined}
            scroll={false}
            className={cn(
              "flex min-h-9 items-center justify-center rounded-control px-3 text-meta text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-sm:min-h-10 max-sm:flex-1",
              view === current && "bg-border font-semibold text-foreground",
            )}
          >
            {healthViewLabels[view]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-2 py-0.5 text-xs">
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", toneDot[tone])}
      />
      {children}
    </span>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-surface border border-border bg-surface-inset px-4 py-3 text-meta leading-normal text-pretty">
      <StrideMark className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Panel({
  id,
  title,
  status,
  source,
  children,
}: {
  id: string;
  title: string;
  status?: { tone: Tone; label: string } | null;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-4 rounded-panel border border-border bg-surface p-4.5 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id}>
          <MonoLabel size="micro" tone="secondary">
            {title}
          </MonoLabel>
        </h2>
        {status && <StatusChip tone={status.tone}>{status.label}</StatusChip>}
      </div>
      {children}
      <MonoLabel size="nano" className="mt-auto">
        {source}
      </MonoLabel>
    </section>
  );
}

function Hero({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: Tone;
}) {
  return (
    <p className="flex items-baseline gap-2.5">
      <span
        className={cn(
          "font-metric text-[40px] leading-none font-semibold tabular-nums sm:text-[44px]",
          toneText[tone],
        )}
      >
        {value}
      </span>
      <span className="text-meta text-muted">{label}</span>
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function ReadingCard({ view }: { view: HealthPageView }) {
  return (
    <section
      aria-labelledby="health-reading"
      className="grid gap-6 rounded-panel border border-border bg-surface p-5 sm:p-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10"
    >
      <div className="flex flex-col gap-3">
        <MonoLabel size="micro" className="flex items-center gap-2">
          <StrideMark className="size-3" />
          {view.readingLabel}
        </MonoLabel>
        <h2
          id="health-reading"
          className="text-[24px] leading-[1.12] font-semibold tracking-[-0.02em] text-balance sm:text-[30px]"
        >
          {view.headline}
        </h2>
        <p className="text-sm leading-[1.6] text-pretty text-muted sm:text-[15px]">
          {view.paragraph}
        </p>
      </div>
      {view.takeaways.length > 0 && (
        <div className="flex flex-col gap-2">
          <MonoLabel size="micro">Ce qu’on retient</MonoLabel>
          <ul className="flex flex-col border-t border-border">
            {view.takeaways.map((item) => (
              <li
                key={item.title}
                className="flex gap-3 border-b border-border py-3.5 last:border-b-0"
              >
                <TrendMark trend={item.trend} className="mt-1.5" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{item.title}</span>
                  <span className="text-meta text-muted">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function KpiStrip({ kpis }: { kpis: HealthKpi[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-panel border border-border bg-surface sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((kpi) => (
        <div
          key={kpi.key}
          className="flex flex-col gap-1.5 border-border p-4 not-last:border-b sm:not-last:border-r lg:border-b-0"
        >
          <dt>
            <MonoLabel size="nano">{kpi.label}</MonoLabel>
          </dt>
          <dd className="flex items-baseline gap-1.5">
            <span className="font-metric text-[28px] leading-none font-semibold tabular-nums">
              {kpi.value}
            </span>
            {kpi.unit && (
              <span className="text-xs text-muted-foreground">{kpi.unit}</span>
            )}
          </dd>
          <dd className="flex items-center gap-1.5 text-xs text-muted">
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                toneDot[kpi.tone],
              )}
            />
            {kpi.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SleepPanel({
  model,
  view,
}: {
  model: HealthModel;
  view: HealthPageView;
}) {
  const sleep = model.sleep;
  if (!sleep || !view.sleep)
    return (
      <Panel id="health-sleep" title="Sommeil" source="Garmin · sommeil">
        <Empty>Aucune nuit mesurée par Garmin ces deux derniers jours.</Empty>
      </Panel>
    );
  const max = Math.max(
    1,
    sleep.average ?? 0,
    ...sleep.nights.map((night) => night.value ?? 0),
  );
  const total = view.sleep.stages.reduce(
    (sum, stage) => sum + stage.seconds,
    0,
  );
  return (
    <Panel
      id="health-sleep"
      title="Sommeil"
      status={{ tone: view.sleep.tone, label: view.sleep.status }}
      source={`Garmin · sommeil · ${model.chartDays} nuits`}
    >
      <Hero
        value={formatSleep(sleep.last)}
        label="cette nuit"
        tone={view.sleep.tone === "warning" ? "warning" : "muted"}
      />
      {total > 0 && (
        <div className="flex flex-col gap-2.5">
          <div
            aria-hidden="true"
            className="flex h-2 gap-0.5 overflow-hidden rounded-full"
          >
            {view.sleep.stages.map((stage) => (
              <span
                key={stage.key}
                className={stage.swatch}
                style={{ width: `${(stage.seconds / total) * 100}%` }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {view.sleep.stages.map((stage) => (
              <li key={stage.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn("size-2 rounded-full", stage.swatch)}
                />
                {stage.label}
                <b className="font-metric text-sm font-semibold text-foreground">
                  {formatStage(stage.seconds)}
                </b>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ChartInspector
        label={`Durée de sommeil des ${model.chartDays} dernières nuits`}
        points={sleep.nights.map((night, index, all) => ({
          x: (index + 0.5) / all.length,
          title: nightTitle(night.day),
          rows:
            night.value === null
              ? [{ label: "Sommeil", value: "Non mesuré", tone: "muted" }]
              : [
                  {
                    label: "Durée",
                    value: formatSleep(night.value),
                    tone: night.day === sleep.lastDay ? "warning" : "muted",
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
          note:
            sleep.average === null
              ? undefined
              : `Ta moyenne : ${formatSleep(sleep.average)}`,
        }))}
      >
        <div className="relative flex h-20 items-end gap-1 border-b border-border-strong">
          {sleep.average !== null && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground"
              style={{ bottom: `${(sleep.average / max) * 100}%` }}
            />
          )}
          {sleep.nights.map((night) => (
            <span
              key={night.day}
              className={cn(
                "flex-1 rounded-t-mark",
                night.day === sleep.lastDay ? "bg-warning" : "bg-border-strong",
              )}
              style={{ height: `${((night.value ?? 0) / max) * 100}%` }}
            />
          ))}
        </div>
      </ChartInspector>
      <Legend
        items={[
          {
            label: "Nuits précédentes",
            swatch: "size-2.5 rounded-mark bg-border-strong",
          },
          {
            label: "Dernière nuit",
            swatch: "size-2.5 rounded-mark bg-warning",
          },
          ...(sleep.average === null
            ? []
            : [
                {
                  label: `Ta moyenne ${formatSleep(sleep.average)}`,
                  swatch:
                    "w-3.5 border-t border-dashed border-muted-foreground",
                },
              ]),
        ]}
      />
      {view.sleep.note && <Note>{view.sleep.note}</Note>}
    </Panel>
  );
}

function rangeLabel(range: { low: number; high: number } | null, unit: string) {
  if (!range) return null;
  return range.low === range.high
    ? `${range.low} ${unit}`
    : `${range.low} – ${range.high} ${unit}`;
}

export function HeartPanel({
  model,
  view,
}: {
  model: HealthModel;
  view: HealthPageView;
}) {
  const { hrv, restingHeartRate } = model;
  if (!hrv || !view.heart)
    return (
      <Panel
        id="health-heart"
        title="VFC et FC au repos"
        source="Garmin · récupération"
      >
        <Empty>Aucune VFC nocturne mesurée ces deux derniers jours.</Empty>
      </Panel>
    );
  const hrvRange = rangeLabel(hrv.range, "ms");
  const restingRange = restingHeartRate
    ? rangeLabel(restingHeartRate.range, "bpm")
    : null;
  return (
    <Panel
      id="health-heart"
      title="VFC et FC au repos"
      status={{ tone: view.heart.tone, label: view.heart.status }}
      source={`Garmin · récupération · ${model.chartDays} jours`}
    >
      <Hero
        value={formatInteger(hrv.last)}
        label="ms de VFC"
        tone={view.heart.tone === "warning" ? "warning" : "muted"}
      />
      <ChartInspector
        label={`VFC nocturne sur ${model.chartDays} nuits`}
        points={hrv.points.map((point, index, all) => ({
          x: all.length > 1 ? index / (all.length - 1) : 0.5,
          title: nightTitle(point.day),
          rows: [
            {
              label: "VFC nocturne",
              value:
                point.value === null
                  ? "Non mesurée"
                  : `${Math.round(point.value)} ms`,
              tone: "provider",
            },
          ],
          note: hrvRange ? `Plage habituelle : ${hrvRange}` : undefined,
        }))}
      >
        <RangeChart
          card={hrv}
          label={`VFC nocturne sur ${model.chartDays} nuits`}
          unfavorable={hrv.position === "below"}
          tone="provider"
          height={70}
        />
      </ChartInspector>
      <Legend
        items={[
          { label: "VFC nocturne", swatch: "h-0.5 w-3.5 bg-provider" },
          ...(hrvRange
            ? [
                {
                  label: `Plage habituelle ${hrvRange}`,
                  swatch:
                    "h-2.5 w-3.5 rounded-mark bg-surface-raised ring-1 ring-border-strong",
                },
              ]
            : []),
        ]}
      />
      {restingHeartRate && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="flex items-baseline justify-between gap-3">
            <MonoLabel size="micro">FC au repos</MonoLabel>
            <span className="text-xs text-muted-foreground">
              <b className="font-metric text-lg font-semibold text-foreground">
                {formatInteger(restingHeartRate.last)}
              </b>{" "}
              bpm{restingRange ? ` · habituelle ${restingRange}` : ""}
            </span>
          </p>
          <ChartInspector
            label={`FC au repos sur ${model.chartDays} jours`}
            points={restingHeartRate.points.map((point, index, all) => ({
              x: all.length > 1 ? index / (all.length - 1) : 0.5,
              title: nightTitle(point.day),
              rows: [
                {
                  label: "FC au repos",
                  value:
                    point.value === null
                      ? "Non mesurée"
                      : `${Math.round(point.value)} bpm`,
                  tone: "foreground",
                },
              ],
              note: restingRange ? `Habituelle : ${restingRange}` : undefined,
            }))}
          >
            <RangeChart
              card={restingHeartRate}
              label={`FC au repos sur ${model.chartDays} jours`}
              unfavorable={restingHeartRate.position === "above"}
              height={44}
            />
          </ChartInspector>
        </div>
      )}
      <Note>{view.heart.note}</Note>
    </Panel>
  );
}

export function EnergyPanel({
  model,
  view,
}: {
  model: HealthModel;
  view: HealthPageView;
}) {
  const energy = model.energy;
  if (!energy || !view.energy)
    return (
      <Panel
        id="health-energy"
        title="Énergie"
        source="Garmin · Body Battery · stress"
      >
        <Empty>
          Garmin n’a pas encore transmis ton Body Battery. Il apparaîtra ici dès
          la prochaine synchronisation qui l’inclut.
        </Empty>
        {model.stress && (
          <p className="text-sm">
            Stress moyen d’hier :{" "}
            <b className="font-metric text-lg">
              {formatInteger(model.stress.value)}
            </b>{" "}
            <span className="text-muted">
              ({stressLabel(model.stress.value).toLowerCase()})
            </span>
          </p>
        )}
      </Panel>
    );
  return (
    <Panel
      id="health-energy"
      title="Énergie"
      status={{ tone: view.energy.tone, label: view.energy.status }}
      source="Garmin · Body Battery · stress"
    >
      <Hero
        value={formatInteger(energy.wake)}
        label="Body Battery au réveil"
        tone="success"
      />
      <ChartInspector
        label={`Body Battery au réveil sur ${model.chartDays} jours`}
        points={energy.points.map((point, index, all) => ({
          x: all.length > 1 ? index / (all.length - 1) : 0.5,
          title: nightTitle(point.day),
          rows: [
            {
              label: "Au réveil",
              value:
                point.value === null
                  ? "Non mesuré"
                  : `${Math.round(point.value)} /100`,
              tone: "success",
            },
          ],
        }))}
      >
        <RangeChart
          card={{ points: energy.points, range: null }}
          label={`Body Battery au réveil sur ${model.chartDays} jours`}
          unfavorable={false}
          tone="success"
          height={70}
        />
      </ChartInspector>
      <dl className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Recharge nuit",
            value:
              energy.charged === null
                ? "—"
                : `+${formatInteger(energy.charged)}`,
          },
          {
            label: "Consommé hier",
            value:
              energy.drained === null
                ? "—"
                : `−${formatInteger(Math.abs(energy.drained))}`,
          },
          {
            label: "Stress moyen",
            value: energy.stress === null ? "—" : formatInteger(energy.stress),
          },
        ].map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-0.5 rounded-surface border border-border px-3 py-2.5"
          >
            <dd className="font-metric text-xl font-semibold">{item.value}</dd>
            <dt className="order-last text-xs text-muted-foreground">
              {item.label}
            </dt>
          </div>
        ))}
      </dl>
      <Note>{view.energy.note}</Note>
    </Panel>
  );
}

export function LoadPanel({
  model,
  view,
}: {
  model: HealthModel;
  view: HealthPageView;
}) {
  const load = model.load;
  if (!load || !view.load)
    return (
      <Panel
        id="health-load"
        title="Charge et forme"
        source="Garmin · statut d’entraînement"
      >
        <Empty>Garmin n’a pas fourni de charge d’entraînement récente.</Empty>
      </Panel>
    );
  const position = Math.min(1, load.ratio / 2);
  const focusMax = Math.max(1, ...view.load.focus.map((item) => item.value));
  return (
    <Panel
      id="health-load"
      title="Charge et forme"
      status={{ tone: view.load.tone, label: view.load.status }}
      source="Garmin · statut d’entraînement"
    >
      <Hero
        value={formatRatio(load.ratio)}
        label="ratio aigu / chronique"
        tone={
          view.load.tone === "warning"
            ? "warning"
            : view.load.tone === "success"
              ? "success"
              : "muted"
        }
      />
      <div className="flex flex-col gap-1.5">
        <div
          className="relative h-2 rounded-full bg-surface-raised"
          aria-hidden="true"
        >
          <span className="absolute inset-y-0 left-[40%] w-[35%] rounded-full bg-success/30" />
          <span
            className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground"
            style={{ left: `${position * 100}%` }}
          />
        </div>
        <div className="flex justify-between font-mono text-nano text-muted-foreground uppercase">
          <span>0</span>
          <span>Zone productive 0,8 – 1,5</span>
          <span>2</span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {[
          { label: "Charge aiguë", value: formatInteger(load.acute) },
          { label: "Charge chronique", value: formatInteger(load.chronic) },
          {
            label: "VO₂max",
            value: load.vo2 === null ? "—" : formatInteger(load.vo2),
          },
          {
            label: "Récup. conseillée",
            value:
              load.recoveryHours === null
                ? "—"
                : `${formatInteger(load.recoveryHours)} h`,
          },
        ].map((item) => (
          <div key={item.label} className="flex flex-col">
            <dd className="font-metric text-xl font-semibold">{item.value}</dd>
            <dt className="order-last text-xs text-muted-foreground">
              {item.label}
            </dt>
          </div>
        ))}
      </dl>
      {view.load.focus.length > 0 && (
        <div className="flex flex-col gap-2">
          <MonoLabel size="nano">Répartition sur 4 semaines</MonoLabel>
          <ul className="flex flex-col gap-2">
            {view.load.focus.map((item) => (
              <li
                key={item.label}
                className="grid grid-cols-[7rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-meta"
              >
                <span>{item.label}</span>
                <span className="h-1.5 rounded-full bg-surface-raised">
                  <span
                    className={cn("block h-full rounded-full", item.swatch)}
                    style={{ width: `${(item.value / focusMax) * 100}%` }}
                  />
                </span>
                <span className="text-right font-metric text-base font-semibold">
                  {formatInteger(item.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Note>{view.load.note}</Note>
    </Panel>
  );
}
