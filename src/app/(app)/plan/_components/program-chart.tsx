import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { MonoLabel } from "@/components/stride/mono-label";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/features/plans/view/format";
import {
  chartDescription,
  type BandTone,
  type ProgramBand,
  type ProgramNested,
  type ProgramWeek,
} from "@/features/plans/view/program";
import { formatInteger } from "@/features/progress/format";

const bandTones: Record<BandTone, string> = {
  dim: "bg-dim",
  provider: "bg-provider",
  terrain: "bg-zone-3",
  success: "bg-success",
  accent: "bg-accent",
};

function column(start: number, span: number) {
  return { gridColumn: `${start + 1} / span ${span}` };
}

function RaceMark({
  letter,
  primary,
  className,
}: {
  letter: string;
  primary: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-4 place-items-center rounded-[4px] font-metric text-[10px] leading-none font-bold",
        primary
          ? "bg-accent text-accent-foreground"
          : "border border-dim text-muted",
        className,
      )}
    >
      {letter}
    </span>
  );
}

function Bar({
  week,
  scale,
  selected,
  onSelect,
}: {
  week: ProgramWeek;
  scale: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const muted = week.isLight || week.status === "past";
  const distance =
    week.totals.distanceMeters !== null
      ? formatInteger(week.totals.distanceMeters / 1000)
      : null;
  const approximate = week.totals.distanceEstimated;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={[
        `Semaine ${week.number}, ${week.range}`,
        formatDuration(week.totals.durationSeconds),
        distance ? `${approximate ? "environ " : ""}${distance} km` : null,
      ]
        .filter(Boolean)
        .join(", ")}
      onClick={onSelect}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1.5 rounded-[9px] border border-transparent py-2 hover:bg-surface",
        selected &&
          "border-foreground bg-surface-raised hover:bg-surface-raised",
        week.status === "past" && !selected && "opacity-55",
      )}
    >
      <span
        className={cn(
          "font-metric text-[11px] leading-none font-semibold tabular-nums",
          selected ? "text-foreground" : "text-muted",
        )}
      >
        {formatDuration(week.totals.durationSeconds)}
      </span>
      <span className="relative flex h-16 w-full flex-col items-center justify-end sm:h-18.5">
        {week.race && (
          <RaceMark
            letter={week.race.letter}
            primary={week.race.primary}
            className="absolute top-0"
          />
        )}
        <span
          className={cn(
            "w-[62%] rounded-t-[3px]",
            muted ? "bg-provider-muted" : "bg-provider",
          )}
          style={{ height: `${week.easySeconds * scale}px` }}
        />
        <span
          className={cn(
            "w-[62%] bg-zone-4",
            muted ? "opacity-45" : "opacity-90",
          )}
          style={{ height: `${week.qualitySeconds * scale}px` }}
        />
      </span>
      <span className="font-metric text-[11px] leading-none font-semibold text-muted-foreground tabular-nums">
        {distance ? `${approximate ? "≈" : ""}${distance}` : "–"}
      </span>
      <MonoLabel
        size="nano"
        tone={selected ? "foreground" : "muted"}
        className="text-[9px]"
      >
        S{week.number}
      </MonoLabel>
    </button>
  );
}

export function ProgramChart({
  weeks,
  bands,
  nested,
  selected,
  onSelect,
}: {
  weeks: ProgramWeek[];
  bands: ProgramBand[];
  nested: ProgramNested[];
  selected: string | null;
  onSelect: (weekKey: string) => void;
}) {
  const maximum = Math.max(
    1,
    ...weeks.map((week) => week.easySeconds + week.qualitySeconds),
  );
  const columns = {
    gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
  };
  return (
    <section
      aria-labelledby="program-volume"
      className="flex flex-col gap-1.5 rounded-card border border-border bg-surface-panel px-2.5 pt-2.5 pb-3 sm:rounded-panel sm:px-4 sm:py-3.5"
    >
      <div className="flex flex-wrap items-center gap-3.5 px-1 max-sm:sr-only">
        <MonoLabel id="program-volume">
          {weeks.length > 1
            ? `Les ${weeks.length} semaines · durée en haut, km en bas`
            : "Durée en haut, km en bas"}
        </MonoLabel>
        <span className="ml-auto flex gap-3.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-mark bg-provider"
            />
            Facile
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-mark bg-zone-4"
            />
            Qualité
          </span>
        </span>
      </div>
      <div className="-mx-2.5 overflow-x-auto px-2.5 sm:mx-0 sm:px-0">
        <div
          style={{ "--weeks": weeks.length } as React.CSSProperties}
          className="flex min-w-[calc(var(--weeks)*2.25rem)] flex-col sm:min-w-0"
        >
          {nested.length > 0 && (
            <div style={columns} className="mb-1 grid gap-x-1">
              {nested.map((item) => (
                <Link
                  key={item.raceId}
                  href={`/plan?race=${item.raceId}`}
                  style={column(item.start, item.span)}
                  className="flex h-6 min-w-0 items-center gap-1.5 overflow-hidden rounded-t-control border border-b-0 border-dashed border-dim px-2 text-[11px] whitespace-nowrap text-muted hover:text-foreground"
                >
                  <RaceMark letter={item.letter} primary={false} />
                  <span className="truncate">
                    Programme {item.name} · ouvrir
                  </span>
                </Link>
              ))}
            </div>
          )}
          <div
            role="group"
            aria-label={chartDescription(weeks)}
            style={columns}
            className="grid items-stretch gap-x-0.75 sm:gap-x-1"
          >
            {weeks.map((week) => (
              <Bar
                key={week.weekKey}
                week={week}
                scale={56 / maximum}
                selected={week.weekKey === selected}
                onSelect={() => onSelect(week.weekKey)}
              />
            ))}
          </div>
          <div
            aria-hidden="true"
            style={columns}
            className="mt-2.5 grid gap-x-0.75 sm:gap-x-1"
          >
            {bands.map((band) => (
              <span
                key={`${band.key}-${band.start}`}
                style={column(band.start, band.span)}
                className="flex min-w-0 flex-col gap-1.25"
              >
                <span
                  className={cn(
                    "h-0.75 rounded-mark",
                    bandTones[band.tone],
                    !band.current && "opacity-55",
                  )}
                />
                <MonoLabel
                  size="nano"
                  tone={band.current ? "foreground" : "muted"}
                  className="truncate text-[9px]"
                >
                  {band.name}
                </MonoLabel>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
