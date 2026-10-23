import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { MonoLabel } from "@/components/stride/mono-label";
import { StrideMark } from "@/components/stride/stride-mark";
import { Button } from "@/components/ui/button";
import {
  formatClock,
  formatDuration,
  formatInteger,
  formatKm,
} from "../format";
import {
  countdownLabel,
  type PreparationRow,
  type SeasonTimeline,
} from "../overview";
import {
  defaultStartMinutes,
  formatRaceDate,
  formatShortDate,
  daysUntil,
  type RacePlan,
  type RaceSummary,
  type StoredCourse,
} from "../race";
import { EmptyState, Figure, RaceCard } from "./race-ui";

export function PriorityBadge({
  priority,
  planned = true,
  small = false,
}: {
  priority: RaceSummary["priority"];
  planned?: boolean;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center font-metric font-bold",
        small
          ? "size-6 rounded-tag text-sm"
          : "size-8 rounded-control text-base",
        priority === "A"
          ? "bg-accent text-accent-foreground"
          : cn(
              "border-[1.5px] text-muted",
              planned ? "border-border-strong" : "border-dashed",
            ),
      )}
    >
      {priority}
    </span>
  );
}

const phaseTones = [
  "bg-surface-raised",
  "bg-accent/12",
  "bg-accent/22",
  "bg-surface-raised",
];

const laneHeight = 28;
const labelsTop = 20;

export function SeasonCard({ timeline }: { timeline: SeasonTimeline }) {
  const phaseTop = labelsTop + timeline.lanes * laneHeight + 18;
  const monthTop = phaseTop + 16 + 10;
  const label = `Saison : ${timeline.markers
    .map((marker) => `${marker.name} le ${formatShortDate(marker.date)}`)
    .join(", ")}`;
  return (
    <RaceCard className="gap-3 pb-3">
      <div className="flex items-baseline gap-3">
        <MonoLabel>Ta saison</MonoLabel>
        <span className="text-xs text-muted-foreground max-sm:hidden">
          Phases indicatives et courses à venir
        </span>
        <Link
          href="/plan"
          className="ml-auto text-meta text-accent hover:text-foreground"
        >
          Voir le plan →
        </Link>
      </div>
      <div className="-mx-1 overflow-x-auto overflow-y-hidden px-1">
        <div
          role="img"
          aria-label={label}
          className="relative min-w-224"
          style={{ height: monthTop + 18 }}
        >
          {timeline.months.map((month) => (
            <span
              key={month.key}
              aria-hidden="true"
              className="absolute top-0 border-l border-border-subtle"
              style={{ left: `${month.left}%`, height: phaseTop + 16 }}
            />
          ))}
          <span
            aria-hidden="true"
            className="absolute top-0 left-0 border-l border-foreground"
            style={{ height: phaseTop + 16 }}
          />
          <MonoLabel
            size="nano"
            tone="foreground"
            className="absolute top-0 left-1.5"
          >
            Auj.
          </MonoLabel>
          {timeline.markers.map((marker) => {
            const top = labelsTop + marker.lane * laneHeight;
            return (
              <div key={marker.id}>
                <span
                  className={cn(
                    "absolute flex w-max items-center gap-1.5 text-meta leading-5.5 whitespace-nowrap",
                    marker.align === "center" && "-translate-x-1/2",
                    marker.align === "end" && "-translate-x-full",
                    marker.priority === "A" ? "text-foreground" : "text-muted",
                  )}
                  style={{ left: `${marker.left}%`, top }}
                >
                  <PriorityBadge priority={marker.priority} small />
                  {marker.label}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute border-l border-dashed border-border-strong"
                  style={{
                    left: `${marker.left}%`,
                    top: top + 24,
                    height: phaseTop - top - 32,
                  }}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute z-10 size-2 -translate-x-1/2 rounded-full ring-2 ring-surface",
                    marker.priority === "A" ? "bg-accent" : "bg-muted",
                  )}
                  style={{ left: `${marker.left}%`, top: phaseTop - 10 }}
                />
              </div>
            );
          })}
          {timeline.phases.map((phase) => (
            <span
              key={phase.key}
              className={cn(
                "absolute flex h-4 items-center overflow-hidden rounded-tag border-r-2 border-surface px-1.5 text-micro whitespace-nowrap text-muted",
                phaseTones[phase.stage],
              )}
              style={{
                left: `${phase.left}%`,
                width: `${phase.width}%`,
                top: phaseTop,
              }}
            >
              {phase.labelled && phase.label}
            </span>
          ))}
          {timeline.months.map((month) => (
            <MonoLabel
              key={month.key}
              size="micro"
              className="absolute pl-1.5"
              style={{ left: `${month.left}%`, top: monthTop }}
            >
              {month.label}
            </MonoLabel>
          ))}
        </div>
      </div>
    </RaceCard>
  );
}

function ElevationStrip({
  samples,
  distanceM,
  nightRanges,
  stations,
}: {
  samples: { distanceM: number; ele: number }[];
  distanceM: number;
  nightRanges: { fromM: number; toM: number }[];
  stations: number[];
}) {
  const width = 560;
  const height = 70;
  const low = Math.min(...samples.map((sample) => sample.ele));
  const high = Math.max(...samples.map((sample) => sample.ele));
  const span = high - low || 1;
  const x = (meters: number) => (meters / distanceM) * width;
  const line = samples
    .map(
      (sample, index) =>
        `${index === 0 ? "M" : "L"}${x(sample.distanceM).toFixed(1)},${(8 + (1 - (sample.ele - low) / span) * 46).toFixed(1)}`,
    )
    .join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="h-17.5 w-full overflow-visible"
      >
        {nightRanges.map((range) => (
          <rect
            key={range.fromM}
            x={x(range.fromM)}
            y={0}
            width={Math.max(0, x(range.toM) - x(range.fromM))}
            height={height}
            className="fill-night/20"
          />
        ))}
        <path
          d={line}
          fill="none"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          className="stroke-muted"
        />
        {stations.map((meters) => (
          <line
            key={meters}
            x1={x(meters)}
            x2={x(meters)}
            y1={60}
            y2={70}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            className="stroke-accent"
          />
        ))}
      </svg>
      <div className="flex items-center justify-between gap-3">
        <MonoLabel size="nano">0 km</MonoLabel>
        <span className="flex items-center gap-3">
          {stations.length > 0 && (
            <MonoLabel size="nano" className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-2.5 bg-accent" />
              Ravitos
            </MonoLabel>
          )}
          {nightRanges.length > 0 && (
            <MonoLabel size="nano" className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 bg-night/40" />
              Nuit
            </MonoLabel>
          )}
        </span>
        <MonoLabel size="nano">{formatKm(distanceM)} km</MonoLabel>
      </div>
    </div>
  );
}

const rowMarks: Record<PreparationRow["state"], string> = {
  done: "bg-success",
  partial: "bg-warning",
  todo: "border border-border-strong",
};

const rowStateLabels: Record<PreparationRow["state"], string> = {
  done: "Fait",
  partial: "En cours",
  todo: "À faire",
};

export function FeaturedRace({
  race,
  plan,
  course,
  rows,
  progress,
  elevation,
  nightRanges,
  nightSeconds,
  stationDistances,
  today,
}: {
  race: RaceSummary;
  plan: RacePlan;
  course: StoredCourse | null;
  rows: PreparationRow[];
  progress: { done: number; total: number; next: string | null };
  elevation: { distanceM: number; ele: number }[] | null;
  nightRanges: { fromM: number; toM: number }[];
  nightSeconds: number | null;
  stationDistances: number[];
  today: string;
}) {
  const days = race.date ? daysUntil(race.date, today) : null;
  const distance = course
    ? `${formatKm(course.distanceM)} km`
    : race.distanceKm
      ? `${formatInteger(race.distanceKm)} km`
      : "—";
  const gain = course?.elevationGainM ?? race.elevationGainM;
  const start = plan.startMinutes ?? defaultStartMinutes;
  const principal = race.priority === "A";
  return (
    <section
      aria-label={race.name}
      className="grid overflow-hidden rounded-panel border border-accent/30 bg-surface lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 flex-col gap-4.5 px-5 py-5.5 sm:px-7 sm:py-6.5">
        <div className="flex items-center gap-3">
          <PriorityBadge priority={race.priority} />
          <MonoLabel className="min-w-0 truncate">
            {principal ? "Objectif principal" : `Course ${race.priority}`}
            {race.date ? ` · ${formatRaceDate(race.date)}` : ""}
          </MonoLabel>
          <MonoLabel
            size="micro"
            className="ml-auto shrink-0 rounded-tag border border-border-strong px-1.5 py-0.5"
          >
            {race.kind === "road" ? "Route" : "Trail"}
          </MonoLabel>
        </div>
        <h2 className="text-[2rem] leading-none font-semibold tracking-[-0.03em] text-balance sm:text-[2.5rem]">
          {race.name}
        </h2>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          {days !== null && days >= 0 && (
            <div className="flex items-end gap-2.5">
              <span className="font-metric text-[4rem] leading-[0.8] font-semibold tabular-nums">
                {days}
              </span>
              <span className="pb-1 text-body">
                {days > 1 ? "jours" : "jour"}
              </span>
            </div>
          )}
          {race.targetSeconds && (
            <Figure
              value={formatDuration(race.targetSeconds)}
              label="Objectif"
              className="pb-1 [&>span:first-child]:text-[1.875rem]"
            />
          )}
          {nightSeconds !== null && nightSeconds > 0 && (
            <Figure
              value={`≈ ${formatDuration(nightSeconds)}`}
              label="de nuit à l’objectif"
              tone="night"
              className="pb-1 [&>span:first-child]:text-[1.875rem]"
            />
          )}
        </div>
        {elevation && course ? (
          <ElevationStrip
            samples={elevation}
            distanceM={course.distanceM}
            nightRanges={nightRanges}
            stations={stationDistances}
          />
        ) : (
          <EmptyState title="Pas encore de parcours">
            Importe le GPX pour afficher le profil, les ravitos et la nuit.
          </EmptyState>
        )}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: course ? "Distance GPX" : "Distance", value: distance },
            {
              label: course ? "D+ GPX" : "D+",
              value: gain !== null ? `${formatInteger(gain)} m` : "—",
            },
            { label: "Départ", value: formatClock(start) },
            {
              label: "Barrière",
              value: plan.cutoffSeconds
                ? formatClock(start + plan.cutoffSeconds / 60)
                : "—",
            },
          ].map((item) => (
            <div key={item.label} className="flex min-w-0 flex-col gap-1">
              <dd className="order-1 font-metric text-[1.625rem] leading-none font-semibold tabular-nums">
                {item.value}
              </dd>
              <MonoLabel asChild size="nano" className="order-2">
                <dt>{item.label}</dt>
              </MonoLabel>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex min-w-0 flex-col gap-3.5 border-t border-border bg-surface-inset px-5 py-5.5 sm:px-7 sm:py-6.5 lg:border-t-0 lg:border-l">
        <div className="flex items-baseline justify-between">
          <MonoLabel>Préparation</MonoLabel>
          <span className="text-xs text-muted-foreground">
            {progress.done} sur {progress.total}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Préparation"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          className="h-1 overflow-hidden rounded-full bg-border-subtle"
        >
          <div
            className="h-full bg-success"
            style={{
              width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li key={row.key} className="border-t border-border first:border-t">
              <Link
                href={row.href}
                prefetch={false}
                className="flex items-center gap-2.5 py-2 text-meta hover:text-accent focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    rowMarks[row.state],
                  )}
                />
                <span className="flex-1">{row.label}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {row.detail}
                </span>
                <span className="sr-only">{rowStateLabels[row.state]}</span>
              </Link>
            </li>
          ))}
        </ul>
        {progress.next && (
          <p className="mt-auto flex items-start gap-2.5 rounded-card border border-border-subtle bg-surface px-3.5 py-3 text-meta leading-normal text-pretty text-muted">
            <StrideMark className="mt-0.5 size-3.5 shrink-0" />
            {progress.next}
          </p>
        )}
        <Button asChild size="lg" className="w-full rounded-surface">
          <Link href={`/races/${race.id}`}>Ouvrir la course</Link>
        </Button>
      </div>
    </section>
  );
}

export function CalendarRow({
  race,
  today,
}: {
  race: RaceSummary;
  today: string;
}) {
  const label = countdownLabel(race.date, today);
  const terrain = [
    race.distanceKm ? `${formatInteger(race.distanceKm)} km` : null,
    race.elevationGainM ? `D+ ${formatInteger(race.elevationGainM)} m` : null,
  ].filter(Boolean);
  return (
    <Link
      href={`/races/${race.id}`}
      prefetch={false}
      className="grid items-center gap-x-5 gap-y-3 rounded-card border border-border bg-surface px-4 py-4 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring sm:grid-cols-[2rem_minmax(0,1fr)_10rem_9rem_7rem_1rem] sm:px-5"
    >
      <PriorityBadge priority={race.priority} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-base font-semibold">{race.name}</span>
        <span className="text-meta text-muted">
          {race.kind === "road" ? "Route" : "Trail"}
        </span>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm">
          {race.date ? formatRaceDate(race.date) : "Date à définir"}
        </span>
        {label && (
          <span className="font-metric text-xl leading-none font-semibold">
            {label}
          </span>
        )}
      </span>
      <span className="font-metric text-xl leading-none font-semibold">
        {terrain.length ? terrain.join(" · ") : "—"}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-metric text-xl leading-none font-semibold">
          {race.targetSeconds ? formatDuration(race.targetSeconds) : "—"}
        </span>
        <MonoLabel size="nano">Objectif</MonoLabel>
      </span>
      <ChevronRightIcon
        aria-hidden="true"
        className="size-4 text-muted-foreground max-sm:hidden"
      />
    </Link>
  );
}

export function OpenSlot({ priority }: { priority: "B" }) {
  return (
    <div className="grid items-center gap-x-5 gap-y-3 rounded-card border border-dashed border-border-strong px-4 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:px-5">
      <PriorityBadge priority={priority} planned={false} />
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="text-base font-semibold">
          Aucune course B au calendrier
        </span>
        <span className="flex items-start gap-2.5 text-meta leading-normal text-pretty text-muted">
          <StrideMark className="mt-0.5 size-3.5 shrink-0" />
          Une course B sert de répétition générale avant l’objectif : départ,
          nutrition et équipement testés dans les conditions réelles.
        </span>
      </span>
      <Button asChild variant="outline" size="md" className="rounded-surface">
        <Link href="/settings/goals">Ajouter une course B</Link>
      </Button>
    </div>
  );
}

export function PastRaces({ races }: { races: RaceSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-136 border-collapse">
        <thead>
          <tr className="border-b border-border-strong text-left">
            {["Course", "Date", "Distance", "D+", "Objectif"].map(
              (heading, index) => (
                <th
                  key={heading}
                  scope="col"
                  className={cn(
                    "pb-2 font-mono text-micro font-normal tracking-[0.08em] text-muted-foreground uppercase",
                    index > 1 && "text-right",
                  )}
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {races.map((race) => (
            <tr key={race.id} className="border-b border-border">
              <td className="py-3 pr-3">
                <Link
                  href={`/races/${race.id}`}
                  prefetch={false}
                  className="flex items-center gap-2.5 text-body font-semibold hover:text-accent focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="font-metric text-muted">
                    {race.priority}
                  </span>
                  {race.name}
                </Link>
              </td>
              <td className="py-3 pr-3 text-meta text-muted">
                {race.date ? formatRaceDate(race.date) : "—"}
              </td>
              <td className="py-3 text-right font-metric text-lg tabular-nums">
                {race.distanceKm ? `${formatInteger(race.distanceKm)} km` : "—"}
              </td>
              <td className="py-3 text-right font-metric text-lg tabular-nums">
                {race.elevationGainM
                  ? `${formatInteger(race.elevationGainM)} m`
                  : "—"}
              </td>
              <td className="py-3 text-right font-metric text-lg tabular-nums">
                {race.targetSeconds ? formatDuration(race.targetSeconds) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
