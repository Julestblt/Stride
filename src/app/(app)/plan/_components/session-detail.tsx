import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import { zoneFills } from "@/components/stride/session-shape";
import { zoneHeights } from "@/components/stride/session-blocks";
import { cn } from "@/lib/utils";
import type {
  PlanBlock,
  PlanSession,
  PlanState,
} from "@/features/plans/model/plan";
import {
  formatDuration,
  formatLongDay,
  formatStepDuration,
} from "@/features/plans/view/format";
import {
  chartSegments,
  sessionRows,
  sessionStats,
  stepViews,
} from "@/features/plans/view/plan-view";
import { sessionHref, weekHref } from "./week-view";

function StepChart({ session }: { session: PlanSession }) {
  const segments = chartSegments(session);
  const total = segments.reduce((sum, item) => sum + item.seconds, 0);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((share) =>
    formatStepDuration(Math.round((total * share) / 60) * 60).replace(
      /:00$/,
      "",
    ),
  );
  return (
    <figure className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`Déroulé de la séance sur ${formatDuration(total)}`}
        className="flex h-44 items-end gap-0.5 sm:h-52"
      >
        {segments.map((segment, index) => (
          <div
            key={index}
            className={cn(
              "relative min-w-0.5 rounded-t-mark",
              zoneFills[segment.zone],
            )}
            style={{
              flexGrow: segment.seconds,
              flexBasis: 0,
              height: `${zoneHeights[segment.zone]}%`,
            }}
          >
            {segment.label && (
              <span className="absolute top-1.5 left-1.5 font-metric text-sm font-semibold text-background tabular-nums max-sm:hidden">
                {segment.label}
              </span>
            )}
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex justify-between">
        {ticks.map((tick, index) => (
          <MonoLabel key={index} size="nano">
            {tick === "0" ? "0:00" : tick}
          </MonoLabel>
        ))}
      </div>
    </figure>
  );
}

export function WeekSessionsAside({
  state,
  weekStart,
  selected,
  className,
}: {
  state: PlanState;
  weekStart: string;
  selected: string;
  className?: string;
}) {
  const rows = sessionRows(state, weekStart);
  return (
    <nav
      aria-label="Séances de la semaine"
      className={cn("flex flex-col gap-1", className)}
    >
      {rows.map((row) => (
        <Link
          key={row.key}
          href={sessionHref(row.key)}
          aria-current={row.key === selected ? "page" : undefined}
          className={cn(
            "grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2 rounded-control px-2.5 py-2 text-sm text-muted hover:bg-surface-raised hover:text-foreground",
            row.key === selected &&
              "bg-surface-raised font-semibold text-foreground",
          )}
        >
          <MonoLabel
            size="nano"
            tone={row.key === selected ? "accent" : "muted"}
          >
            {row.dayLabel}
          </MonoLabel>
          <span className="truncate">{row.title}</span>
        </Link>
      ))}
    </nav>
  );
}

export function SessionDetail({
  session,
  block,
  weekNumber,
  weekStart,
}: {
  session: PlanSession;
  block: PlanBlock;
  weekNumber: number;
  weekStart: string;
}) {
  const stats = sessionStats(session);
  const steps = stepViews(session);
  const statItems = [
    { label: "Total", value: stats.total },
    stats.distance && { label: "Distance", value: stats.distance },
    stats.intensityTime && {
      label: stats.intensityTime.label,
      value: stats.intensityTime.value,
    },
    stats.pace && { label: "Allure /km", value: stats.pace },
    stats.heartRate && { label: "FC bpm", value: stats.heartRate },
    stats.elevation && { label: "D+", value: stats.elevation },
    stats.terrain && { label: "Terrain", value: stats.terrain },
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  return (
    <article className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href={weekHref(weekStart)}
          className="flex min-h-11 items-center gap-2 text-muted-foreground sm:hidden"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          <MonoLabel size="micro">
            Semaine {weekNumber} · {formatLongDay(session.scheduledOn)}
          </MonoLabel>
        </Link>
        <MonoLabel size="micro" className="max-sm:hidden">
          Plan / {block.name} / semaine {weekNumber} /{" "}
          {formatLongDay(session.scheduledOn)}
        </MonoLabel>
        <h1 className="text-[25px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance sm:text-[clamp(32px,4vw,46px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
          {session.title}
        </h1>
        <p className="max-w-200 text-sm leading-normal text-pretty text-muted sm:text-base sm:leading-[1.55]">
          {session.purpose}
        </p>
      </div>
      {session.kind !== "race" && <StepChart session={session} />}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-border py-5 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-x-12">
        {statItems.map((item) => (
          <div key={item.label} className="flex flex-col-reverse gap-1">
            <dt>
              <MonoLabel size="nano">{item.label}</MonoLabel>
            </dt>
            <dd>
              <Metric size="lg" value={item.value} />
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-8">
          {steps.length > 0 && session.kind !== "race" && (
            <section aria-labelledby="steps" className="flex flex-col gap-3">
              <h2 id="steps" className="text-title font-semibold">
                Étapes
              </h2>
              <ol className="flex flex-col border-t border-border">
                {steps.map((step) => (
                  <li
                    key={step.key}
                    className="grid grid-cols-[0.375rem_minmax(0,1fr)_auto] items-start gap-x-4 border-b border-border py-4"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-full min-h-8 rounded-mark",
                        zoneFills[step.zone],
                      )}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-semibold">{step.name}</span>
                      {step.cue && (
                        <span className="text-meta text-muted-foreground">
                          {step.cue}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-col items-end gap-0.5 text-right">
                      <Metric value={step.duration} />
                      <span className="text-meta text-muted-foreground">
                        {step.target}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {session.contingencies.length > 0 && (
            <section
              aria-labelledby="contingencies"
              className="flex flex-col gap-3"
            >
              <h2 id="contingencies" className="text-title font-semibold">
                Si ça se passe mal
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {session.contingencies.map((item) => (
                  <li
                    key={item}
                    className="rounded-card border border-border px-4 py-3 text-sm"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <section aria-labelledby="why" className="flex flex-col gap-2">
          <MonoLabel id="why" size="micro">
            Pourquoi cette séance
          </MonoLabel>
          <p className="text-body">
            {block.name} : {block.objective}
          </p>
        </section>
      </div>
    </article>
  );
}
