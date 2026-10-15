import { CheckIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import { SessionKindTile } from "@/components/stride/session-kind-tile";
import { SessionShape } from "@/components/stride/session-shape";
import { StrideMark } from "@/components/stride/stride-mark";
import { cn } from "@/lib/utils";
import { formatDuration, formatElevation } from "@/features/plans/view/format";
import type { ProgramDay, ProgramWeek } from "@/features/plans/view/program";
import { formatInteger } from "@/features/progress/format";
import { sessionHref } from "./week-view";

function DayState({ day }: { day: ProgramDay }) {
  switch (day.state) {
    case "done":
    case "partial":
      return (
        <span
          className={cn(
            "flex items-center gap-1.25 text-xs",
            day.state === "done" ? "text-success" : "text-warning",
          )}
        >
          <CheckIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
          Fait{day.compliancePct !== null && ` · ${day.compliancePct} %`}
        </span>
      );
    case "proposed":
      return (
        <span className="flex items-center gap-1.5 text-xs text-warning">
          <PulseDot tone="warning" breathing={false} />
          Proposé
        </span>
      );
    case "substituted":
      return <span className="text-xs text-muted-foreground">Remplacé</span>;
    case "missed":
      return <span className="text-xs text-muted-foreground">Non fait</span>;
    default:
      return null;
  }
}

function DayCard({ day }: { day: ProgramDay }) {
  const rest = day.sessionKey === null;
  const body = (
    <>
      <span className="flex items-center justify-between gap-1.5">
        <span className="flex items-baseline gap-1.25">
          <MonoLabel size="micro" tone={day.isToday ? "accent" : "muted"}>
            {day.weekday}
          </MonoLabel>
          <span className="font-metric text-lg leading-none font-semibold tabular-nums">
            {day.dayNumber}
          </span>
        </span>
        <SessionKindTile kind={day.family} size="md" />
      </span>
      <span className="flex min-h-9 flex-col gap-0.75">
        <span
          className={cn(
            "text-[13.5px] leading-tight",
            rest ? "text-muted-foreground" : "font-semibold",
          )}
        >
          {day.title}
        </span>
      </span>
      {day.summary && (
        <span className="font-metric text-base leading-tight font-semibold tabular-nums">
          {day.summary}
        </span>
      )}
      {day.elevation && (
        <span className="-mt-2 text-xs text-muted-foreground">
          {day.elevation}
        </span>
      )}
      {day.blocks.length > 0 && (
        <SessionShape
          blocks={day.blocks}
          aria-hidden="true"
          role={undefined}
          aria-label={undefined}
          className="mt-auto h-3.5 gap-px"
        />
      )}
      <DayState day={day} />
    </>
  );
  const className = cn(
    "flex min-w-0 flex-col gap-2.5 rounded-card border p-3",
    rest
      ? "border-dashed border-border"
      : "border-border bg-surface hover:border-border-strong",
    day.isPast && !rest && "bg-surface-panel",
    day.isPast && "opacity-70",
    day.isToday && "border-foreground bg-surface-current opacity-100",
  );
  return day.sessionKey ? (
    <Link
      href={sessionHref(day.sessionKey)}
      aria-current={day.isToday ? "date" : undefined}
      className={className}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function DayRow({ day }: { day: ProgramDay }) {
  const rest = day.sessionKey === null;
  const details = [day.summary, day.elevation].filter(Boolean).join(" · ");
  const body = (
    <>
      <span className="flex flex-col items-center">
        <MonoLabel size="nano" tone={day.isToday ? "accent" : "muted"}>
          {day.weekday}
        </MonoLabel>
        <span className="font-metric text-lg leading-none font-semibold tabular-nums">
          {day.dayNumber}
        </span>
      </span>
      <SessionKindTile kind={day.family} size="lg" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "text-sm",
            rest ? "text-muted-foreground" : "font-semibold",
          )}
        >
          {day.title}
        </span>
        {details && (
          <span className="text-xs text-muted-foreground">{details}</span>
        )}
      </span>
      <DayState day={day} />
    </>
  );
  const className = cn(
    "grid min-h-11 grid-cols-[40px_32px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border py-3",
    day.isPast && "opacity-65",
    day.isToday &&
      "my-0.5 rounded-card border border-border-strong bg-surface-current px-3",
  );
  return day.sessionKey ? (
    <Link
      href={sessionHref(day.sessionKey)}
      aria-current={day.isToday ? "date" : undefined}
      className={className}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function WeekNote({ note }: { note: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <StrideMark className="mt-0.75 size-3.5 shrink-0" />
      <p className="text-[13px] leading-normal text-muted">{note}</p>
    </div>
  );
}

function WeekStatus({ week }: { week: ProgramWeek }) {
  if (week.status === "current")
    return (
      <span className="flex items-center gap-1.5 text-xs">
        <PulseDot breathing={false} />
        En cours
      </span>
    );
  if (week.status === "future")
    return (
      <span className="text-xs text-muted-foreground">
        dans {week.daysUntil} j
      </span>
    );
  if (week.completionPct !== null)
    return (
      <span className="flex items-center gap-1.25 text-xs text-success">
        <CheckIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
        {week.completionPct} %
        <span className="sr-only"> des séances réalisées</span>
      </span>
    );
  return null;
}

function kilometers(meters: number) {
  return `${formatInteger(meters / 1000)} km`;
}

function weekMetrics(week: ProgramWeek) {
  const { totals, done } = week;
  const started = week.status !== "future";
  return [
    {
      key: "duration",
      value: formatDuration(totals.durationSeconds),
      note: started
        ? `${formatDuration(done.durationSeconds)} faites`
        : "Durée",
    },
    ...(totals.distanceMeters !== null
      ? [
          {
            key: "distance",
            value: kilometers(totals.distanceMeters),
            note:
              started && done.distanceMeters !== null
                ? `${kilometers(done.distanceMeters)} faits`
                : "Distance",
          },
        ]
      : []),
    ...(totals.elevationMeters !== null
      ? [
          {
            key: "elevation",
            value: formatElevation(totals.elevationMeters),
            note:
              started && done.elevationMeters !== null
                ? `D+ · ${formatElevation(done.elevationMeters)} faits`
                : "D+",
          },
        ]
      : []),
  ];
}

function progress(week: ProgramWeek) {
  const total = week.totals.durationSeconds;
  return total > 0
    ? Math.min(100, Math.round((week.done.durationSeconds / total) * 100))
    : 0;
}

export function ProgramWeekPanel({
  week,
  navigation,
}: {
  week: ProgramWeek;
  navigation: React.ReactNode;
}) {
  const subtitle = [week.blockName, week.label].filter(Boolean).join(" · ");
  return (
    <section
      aria-labelledby="program-week-title"
      className="flex flex-col gap-3.5 rounded-panel border border-border bg-surface p-4 sm:gap-4 sm:px-5.5 sm:py-5"
    >
      <div className="flex flex-wrap items-start gap-3 sm:items-center">
        <div className="flex flex-col gap-0.75">
          <h2
            id="program-week-title"
            className="flex flex-wrap items-baseline gap-2.5"
          >
            <span className="font-metric text-[22px] leading-none font-semibold tabular-nums sm:text-2xl">
              S{week.number}
            </span>
            <span className="text-[15px] font-semibold sm:text-[17px]">
              {week.range}
            </span>
          </h2>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <WeekStatus week={week} />
            {subtitle}
          </span>
        </div>
        {navigation}
      </div>
      <div className="grid gap-4 sm:gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
        <div className="flex flex-col gap-2">
          <dl className="flex flex-wrap items-baseline gap-3.5 sm:gap-4.5">
            {weekMetrics(week).map((metric) => (
              <div key={metric.key} className="flex flex-col gap-0.5">
                <dt className="order-2 text-[11px] text-muted-foreground">
                  {metric.note}
                </dt>
                <dd className="order-1 font-metric text-[22px] leading-none font-semibold whitespace-nowrap tabular-nums sm:text-[26px]">
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>
          {week.status !== "future" && (
            <span
              aria-hidden="true"
              className="h-1 overflow-hidden rounded-mark bg-border"
            >
              <span
                className="block h-full bg-success"
                style={{ width: `${progress(week)}%` }}
              />
            </span>
          )}
        </div>
        {week.note && <WeekNote note={week.note} />}
      </div>
      <div className="grid grid-cols-7 gap-2 max-lg:hidden">
        {week.days.map((day) => (
          <DayCard key={day.date} day={day} />
        ))}
      </div>
      <div className="flex flex-col lg:hidden">
        {week.days.map((day) => (
          <DayRow key={day.date} day={day} />
        ))}
      </div>
    </section>
  );
}
