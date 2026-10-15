import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import { SessionShape, zoneFills } from "@/components/stride/session-shape";
import { cn } from "@/lib/utils";
import type { PlanState } from "@/features/plans/model/plan";
import {
  formatDuration,
  formatElevation,
  formatWeekRange,
} from "@/features/plans/view/format";
import {
  planNavigation,
  restDays,
  sessionRows,
  weekDays,
  weekPosition,
  weekStats,
  weekSummary,
} from "@/features/plans/view/plan-view";
import { addDays } from "@/features/plans/model/dates";

export const weekHref = (weekStart: string) => `/plan/week?week=${weekStart}`;
export const sessionHref = (key: string) => `/plan/sessions/${key}`;

export function BlockNavigation({
  state,
  today,
  selected,
  className,
}: {
  state: PlanState;
  today: string;
  selected: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Blocs du plan"
      className={cn("flex flex-col gap-4", className)}
    >
      {planNavigation(state, today).map((block) => (
        <div key={block.blockKey} className="flex flex-col gap-1">
          <MonoLabel size="micro">{block.name}</MonoLabel>
          <ul className="flex flex-col">
            {block.weeks.map((week) => {
              const active = week.weekStart === selected;
              return (
                <li key={week.weekStart}>
                  <Link
                    href={weekHref(week.weekStart)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-9 items-center justify-between gap-3 rounded-control px-2.5 text-sm text-muted hover:bg-surface-raised hover:text-foreground",
                      active &&
                        "bg-surface-raised font-semibold text-foreground",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      {week.label}
                      {week.detail && (
                        <span className="text-muted-foreground">
                          · {week.detail}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 font-metric tabular-nums">
                      {formatDuration(week.durationSeconds)}
                      {week.current && (
                        <span
                          aria-label="Semaine en cours"
                          className="size-1.5 rounded-full bg-accent"
                        />
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function DayBars({
  state,
  weekStart,
  today,
}: {
  state: PlanState;
  weekStart: string;
  today: string;
}) {
  const days = weekDays(state, weekStart, today);
  const longest = Math.max(...days.map((day) => day.totalSeconds), 1);
  const described = days
    .map((day) =>
      day.isRace
        ? `${day.label} course`
        : day.totalSeconds > 0
          ? `${day.label} ${formatDuration(day.totalSeconds)}`
          : `${day.label} repos`,
    )
    .join(", ");
  return (
    <div
      role="img"
      aria-label={`Charge de la semaine : ${described}`}
      className="grid grid-cols-7 gap-1.5 max-sm:hidden"
    >
      {days.map((day) => (
        <div key={day.date} className="flex flex-col gap-2">
          <div className="flex h-36 flex-col justify-end border-b border-border">
            {day.isRace ? (
              <div className="h-full rounded-t-mark border border-dashed border-accent" />
            ) : (
              <div
                className="flex flex-col-reverse overflow-hidden rounded-t-mark"
                style={{ height: `${(day.totalSeconds / longest) * 100}%` }}
              >
                {day.segments.map((segment, index) => (
                  <span
                    key={index}
                    className={zoneFills[segment.zone]}
                    style={{
                      flexGrow: segment.seconds,
                      flexBasis: 0,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <MonoLabel size="micro" tone={day.isToday ? "accent" : "muted"}>
            {day.label}
            {day.isToday && " · auj."}
            {day.isRace && " · course"}
          </MonoLabel>
        </div>
      ))}
    </div>
  );
}

export function WeekHeader({
  state,
  weekStart,
}: {
  state: PlanState;
  weekStart: string;
}) {
  const position = weekPosition(state, weekStart);
  const stats = weekStats(state, weekStart);
  const range = formatWeekRange(weekStart, addDays(weekStart, 6));
  const items = [
    { label: "Prévu", value: formatDuration(stats.durationSeconds) },
    ...(stats.elevationGainMeters !== null
      ? [{ label: "D+", value: formatElevation(stats.elevationGainMeters) }]
      : []),
    { label: "Facile / dur %", value: `${stats.easyPct} / ${stats.hardPct}` },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <h1 className="text-[28px] font-semibold tracking-[-0.025em]">Plan</h1>
        <div className="flex gap-2">
          {[
            {
              target: position.previous,
              label: "Semaine précédente",
              icon: <ChevronLeftIcon />,
            },
            {
              target: position.next,
              label: "Semaine suivante",
              icon: <ChevronRightIcon />,
            },
          ].map((item) =>
            item.target ? (
              <Link
                key={item.label}
                href={weekHref(item.target)}
                aria-label={item.label}
                className="grid size-11 place-items-center rounded-control border border-border-strong [&_svg]:size-4"
              >
                {item.icon}
              </Link>
            ) : (
              <span
                key={item.label}
                aria-hidden="true"
                className="grid size-11 place-items-center rounded-control border border-border text-dim [&_svg]:size-4"
              >
                {item.icon}
              </span>
            ),
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex gap-1" aria-hidden="true">
          {position.blockWeeks.map((week) => (
            <span
              key={week}
              className={cn(
                "h-1 flex-1 rounded-full",
                week === weekStart ? "bg-accent" : "bg-border-strong",
              )}
            />
          ))}
        </div>
        <MonoLabel size="micro" tone="foreground">
          {position.block.name} · semaine {position.number} sur {position.count}{" "}
          · {range}
        </MonoLabel>
      </div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-200 flex-col gap-3 max-sm:hidden">
          <h1 className="text-[clamp(32px,4vw,46px)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
            Semaine {position.number} · {range}
          </h1>
          <p className="text-base leading-[1.55] text-pretty text-muted">
            {weekSummary(state, weekStart)}
          </p>
        </div>
        <dl
          className={cn(
            "grid border-y border-border sm:flex sm:gap-8 sm:border-0",
            items.length === 3 ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {items.map((item, index) => (
            <div
              key={item.label}
              className={cn(
                "flex flex-col-reverse gap-1 py-3",
                index > 0 && "max-sm:pl-3",
                index < items.length - 1 &&
                  "max-sm:border-r max-sm:border-border",
              )}
            >
              <dt>
                <MonoLabel size="nano">{item.label}</MonoLabel>
              </dt>
              <dd>
                <Metric size="lg" value={item.value} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-meta text-muted sm:hidden">
        {weekSummary(state, weekStart)}
      </p>
    </div>
  );
}

export function WeekSessions({
  state,
  weekStart,
  today,
}: {
  state: PlanState;
  weekStart: string;
  today: string;
}) {
  const rows = sessionRows(state, weekStart);
  const rest = restDays(state, weekStart);
  return (
    <div className="flex flex-col gap-6">
      <DayBars state={state} weekStart={weekStart} today={today} />
      <div className="flex flex-col">
        <ul className="flex flex-col border-t border-border">
          {rows.map((row) => (
            <li key={row.key} className="border-b border-border">
              <Link
                href={sessionHref(row.key)}
                className={cn(
                  "grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-1 py-4 hover:bg-surface-raised sm:grid-cols-[5.5rem_minmax(0,1fr)_9rem_5rem] sm:px-3",
                  row.date === today && "bg-surface-raised",
                )}
              >
                <MonoLabel
                  size="micro"
                  tone={row.date === today ? "accent" : "muted"}
                >
                  {row.dayLabel}
                </MonoLabel>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold">{row.title}</span>
                  <span className="text-meta text-muted-foreground">
                    {row.summary}
                  </span>
                  {row.warnings.map((warning) => (
                    <span key={warning} className="text-meta text-warning">
                      {warning}
                    </span>
                  ))}
                </span>
                {row.isRace ? (
                  <span className="max-sm:hidden" />
                ) : (
                  <SessionShape
                    blocks={row.blocks}
                    label={`Forme de la séance ${row.title}`}
                    className="h-5 max-sm:hidden"
                  />
                )}
                <MonoLabel
                  size="micro"
                  tone={row.isRace ? "accent" : "muted"}
                  className="max-sm:hidden"
                >
                  {row.isRace ? "Course" : "Prévu"}
                </MonoLabel>
              </Link>
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <p className="py-4 text-meta text-muted">
            Aucune séance cette semaine : tu as déclaré une indisponibilité ou
            ton volume ne le permet pas.
          </p>
        )}
        {rest.length > 0 && rows.length > 0 && (
          <p className="pt-3 text-meta text-muted-foreground">
            Repos : {rest.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
