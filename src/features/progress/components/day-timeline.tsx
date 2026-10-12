import {
  ChartInspector,
  type InspectorPoint,
  type InspectorTone,
} from "@/components/stride/chart-inspector";
import { MonoLabel } from "@/components/stride/mono-label";
import { cn } from "@/lib/utils";
import type { SleepStage } from "@/features/garmin/wellness";
import { formatClock, stressLevel, type HealthDayModel } from "../health-day";
import { Legend } from "./charts";

const width = 1000;
const stageRows: SleepStage[] = ["awake", "rem", "light", "deep"];
const stageLabels: Record<SleepStage, string> = {
  deep: "Profond",
  light: "Léger",
  rem: "Paradoxal",
  awake: "Éveil",
};
const stageFill: Record<SleepStage, string> = {
  deep: "fill-provider",
  light: "fill-dim",
  rem: "fill-zone-3",
  awake: "fill-danger",
};
const stressFill = {
  rest: "fill-provider",
  low: "fill-muted-foreground",
  high: "fill-warning",
} as const;
const stressLabels = { rest: "repos", low: "faible", high: "élevé" } as const;
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function Track({
  label,
  unit,
  height,
  children,
}: {
  label: string;
  unit: string;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-stretch border-b border-border-subtle last:border-b-0 max-sm:grid-cols-[5rem_minmax(0,1fr)]">
      <div className="flex flex-col justify-center gap-0.5 pr-3">
        <span className="text-meta">{label}</span>
        <MonoLabel size="nano">{unit}</MonoLabel>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="w-full"
        style={{ height }}
      >
        {children}
      </svg>
    </div>
  );
}

function linePath(points: [number, number][]) {
  return points
    .map(
      ([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`,
    )
    .join(" ");
}

function segments(
  values: [number, number | null][],
  x: (at: number) => number,
  y: (value: number) => number,
  gap: number,
) {
  const result: [number, number][][] = [];
  let previous: number | null = null;
  for (const [at, value] of values) {
    if (value === null) {
      previous = null;
      continue;
    }
    if (previous === null || at - previous > gap) result.push([]);
    result.at(-1)!.push([x(at), y(value)]);
    previous = at;
  }
  return result.filter((part) => part.length > 1);
}

const hourMs = 3_600_000;

export function DayTimeline({ model }: { model: HealthDayModel }) {
  const span = model.window.end - model.window.start;
  const x = (at: number) => ((at - model.window.start) / span) * width;
  const fraction = (at: number) => (at - model.window.start) / span;
  const heart = model.heartRate.flatMap(([, value]) =>
    value === null ? [] : [value],
  );
  const heartMin = Math.min(40, ...heart) - 5;
  const heartMax = Math.max(120, ...heart) + 5;
  const heartY = (value: number) =>
    86 - ((value - heartMin) / (heartMax - heartMin)) * 80;
  const stepMax = Math.max(500, ...model.steps.map(([, value]) => value ?? 0));
  const ticks = Array.from(
    { length: 7 },
    (_, index) => model.window.start + index * 4 * hourMs,
  );
  const points: InspectorPoint[] = model.slots.map((slot) => {
    const rows: InspectorPoint["rows"] = [];
    if (slot.stage)
      rows.push({
        label: "Sommeil",
        value: stageLabels[slot.stage],
        tone: (slot.stage === "deep"
          ? "provider"
          : slot.stage === "rem"
            ? "zone-3"
            : slot.stage === "awake"
              ? "danger"
              : "muted") as InspectorTone,
      });
    rows.push({
      label: "FC",
      value:
        slot.heartRate === null ? "—" : `${integer.format(slot.heartRate)} bpm`,
      tone: "danger",
    });
    rows.push({
      label: "Stress",
      value:
        slot.stress === null
          ? "Non mesuré"
          : `${integer.format(slot.stress)} · ${stressLabels[stressLevel(slot.stress)]}`,
      tone: slot.stress !== null && slot.stress > 50 ? "warning" : "provider",
    });
    rows.push({
      label: "Body Battery",
      value: slot.bodyBattery === null ? "—" : integer.format(slot.bodyBattery),
      tone: "success",
    });
    rows.push({
      label: "Pas (heure)",
      value: slot.steps === null ? "—" : integer.format(slot.steps),
      tone: "muted",
    });
    return {
      x: fraction(slot.start + 5 * 60_000),
      title: `${formatClock(slot.start)} – ${formatClock(slot.start + 10 * 60_000)}`,
      rows,
    };
  });
  const sleepBand = model.sleep
    ? {
        left: Math.max(0, fraction(model.sleep.start)) * 100,
        right: Math.min(1, fraction(model.sleep.end)) * 100,
      }
    : null;
  const future = model.now === null ? null : fraction(model.now) * 100;
  const battery = segments(
    model.bodyBattery,
    x,
    (value) => 86 - value * 0.8,
    45 * 60_000,
  );
  return (
    <section
      aria-labelledby="health-day-timeline"
      className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-4.5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="health-day-timeline">
          <MonoLabel size="micro" tone="secondary">
            Ta journée heure par heure · de 22:00 à 22:00
          </MonoLabel>
        </h2>
        <p className="text-xs text-muted-foreground">
          Survole les courbes pour lire chaque moment
          {future !== null ? " · la zone hachurée est à venir" : ""}
        </p>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="min-w-160">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 left-28 max-sm:left-20">
              {sleepBand && (
                <span
                  className="absolute inset-y-0 bg-surface-raised/60"
                  style={{
                    left: `${sleepBand.left}%`,
                    width: `${sleepBand.right - sleepBand.left}%`,
                  }}
                />
              )}
              {future !== null && (
                <>
                  <span
                    className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_9px)]"
                    style={{ left: `${future}%` }}
                  />
                  <span
                    className="absolute inset-y-0 w-px bg-foreground/70"
                    style={{ left: `${future}%` }}
                  />
                </>
              )}
            </div>
            <ChartInspector
              label="Ta journée heure par heure"
              points={points}
              className="relative ml-28 max-sm:ml-20"
            >
              <div className="h-[404px]" />
            </ChartInspector>
            <div className="pointer-events-none absolute inset-0">
              <Track label="Sommeil" unit="Phases" height={64}>
                {model.stages.map((stage) => {
                  const row = stageRows.indexOf(stage.stage);
                  return (
                    <rect
                      key={stage.start}
                      x={x(stage.start)}
                      width={Math.max(1.5, x(stage.end) - x(stage.start))}
                      y={6 + row * 14}
                      height={11}
                      rx={1.5}
                      className={stageFill[stage.stage]}
                    />
                  );
                })}
              </Track>
              <Track label="Fréquence cardiaque" unit="bpm" height={96}>
                {model.restingHeartRate !== null && (
                  <line
                    x1={0}
                    x2={width}
                    y1={heartY(model.restingHeartRate)}
                    y2={heartY(model.restingHeartRate)}
                    strokeDasharray="3 4"
                    vectorEffect="non-scaling-stroke"
                    className="stroke-muted-foreground"
                  />
                )}
                {segments(model.heartRate, x, heartY, 15 * 60_000).map(
                  (part, index) => (
                    <path
                      key={index}
                      d={linePath(part)}
                      fill="none"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                      className="stroke-danger"
                    />
                  ),
                )}
              </Track>
              <Track label="Stress" unit="0 – 100" height={72}>
                {model.stress.map(([at, value]) =>
                  value === null ? null : (
                    <rect
                      key={at}
                      x={x(at)}
                      width={Math.max(1, x(at + 180_000) - x(at) - 0.6)}
                      y={68 - value * 0.6}
                      height={Math.max(1, value * 0.6)}
                      className={stressFill[stressLevel(value)]}
                    />
                  ),
                )}
              </Track>
              <Track label="Body Battery" unit="0 – 100" height={96}>
                {battery.map((part, index) => (
                  <g key={index}>
                    <path
                      d={`${linePath(part)} L${part.at(-1)![0]},90 L${part[0][0]},90 Z`}
                      className="fill-success/15"
                    />
                    <path
                      d={linePath(part)}
                      fill="none"
                      strokeWidth={1.6}
                      vectorEffect="non-scaling-stroke"
                      className="stroke-success"
                    />
                  </g>
                ))}
              </Track>
              <Track label="Pas" unit="par heure" height={72}>
                {model.steps.map(([at, value]) =>
                  !value ? null : (
                    <rect
                      key={at}
                      x={x(at) + 2}
                      width={Math.max(1, x(at + hourMs) - x(at) - 4)}
                      y={68 - (value / stepMax) * 60}
                      height={(value / stepMax) * 60}
                      className="fill-muted-foreground"
                    />
                  ),
                )}
              </Track>
            </div>
          </div>
          <div className="relative mt-2 ml-28 h-4 font-mono text-nano text-muted-foreground max-sm:ml-20">
            {ticks.map((tick, index) => (
              <span
                key={tick}
                className={cn(
                  "absolute",
                  index === 0
                    ? ""
                    : index === ticks.length - 1
                      ? "-translate-x-full"
                      : "-translate-x-1/2",
                )}
                style={{ left: `${fraction(tick) * 100}%` }}
              >
                {formatClock(tick)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Legend
        items={[
          { label: "Profond", swatch: "size-2.5 rounded-mark bg-provider" },
          { label: "Léger", swatch: "size-2.5 rounded-mark bg-dim" },
          { label: "Paradoxal", swatch: "size-2.5 rounded-mark bg-zone-3" },
          { label: "Éveil", swatch: "size-2.5 rounded-mark bg-danger" },
          { label: "FC", swatch: "h-0.5 w-3.5 bg-danger" },
          ...(model.restingHeartRate !== null
            ? [
                {
                  label: `FC au repos ${integer.format(model.restingHeartRate)}`,
                  swatch:
                    "w-3.5 border-t border-dashed border-muted-foreground",
                },
              ]
            : []),
          {
            label: "Stress repos",
            swatch: "size-2.5 rounded-mark bg-provider",
          },
          {
            label: "Stress faible",
            swatch: "size-2.5 rounded-mark bg-muted-foreground",
          },
          { label: "Stress élevé", swatch: "size-2.5 rounded-mark bg-warning" },
          { label: "Body Battery", swatch: "h-0.5 w-3.5 bg-success" },
          {
            label: "Nuit",
            swatch:
              "size-2.5 rounded-mark bg-surface-raised ring-1 ring-border-strong",
          },
        ]}
      />
    </section>
  );
}
