import { ChevronRightIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { SourceMark } from "@/components/stride/marks";
import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GoalCard } from "../goal";
import { goalSummary } from "../goal";
import type { MarkerCard, ReachCard, RecordRow } from "../records-view";

const tones = {
  success: "text-success",
  warning: "text-warning",
  muted: "text-muted-foreground",
} as const;

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function ReachSection({
  reach,
  goal,
}: {
  reach: ReachCard | null;
  goal: GoalCard | null;
}) {
  return (
    <section aria-labelledby="records-reach" className="flex flex-col gap-3">
      <h2 id="records-reach" className="text-base font-semibold sm:text-lg">
        À portée
      </h2>
      {reach ? (
        <div className="flex flex-col gap-3.5 rounded-card border border-border bg-surface p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold sm:text-base">
              {reach.label}
            </span>
            <span className={cn("text-xs", tones[reach.tone])}>
              {reach.gap}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="flex flex-col gap-0.5">
              <dt>
                <MonoLabel size="micro">Record · {reach.recordDate}</MonoLabel>
              </dt>
              <dd>
                <Metric
                  value={reach.record}
                  className="text-[28px] sm:text-4xl"
                />
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt>
                <MonoLabel size="micro" className="flex items-center gap-1.5">
                  <SourceMark source="provider" />
                  Prévision
                </MonoLabel>
              </dt>
              <dd>
                <Metric
                  value={reach.prediction}
                  className="text-[28px] text-muted sm:text-4xl"
                />
              </dd>
            </div>
          </dl>
          <span
            aria-hidden="true"
            className="relative h-2 overflow-hidden rounded-full bg-border"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-accent"
              style={{ width: `${reach.progress * 100}%` }}
            />
          </span>
          <Button
            asChild
            variant="outline"
            size="md"
            className="max-sm:min-h-11"
          >
            <Link href={reach.coachHref}>
              Préparer une tentative avec le coach
            </Link>
          </Button>
        </div>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          Aucun record sur route à moins de 3 % de ta prévision Garmin pour le
          moment.
        </p>
      )}
      {goal && (
        <Link
          href={`/races/${goal.id}`}
          className={cn(
            "flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3.5 transition-colors hover:border-border-strong sm:px-4.5",
            focus,
          )}
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-[15px] font-semibold">
              {goal.name} · {goal.date}
            </span>
            <span className="text-meta text-muted">{goalSummary(goal)}</span>
          </span>
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </Link>
      )}
    </section>
  );
}

export function MarkersSection({ markers }: { markers: MarkerCard[] }) {
  return (
    <section aria-labelledby="records-markers" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="records-markers" className="text-base font-semibold sm:text-lg">
          Tes repères actuels
        </h2>
        <Link
          href="/settings/profile#entrainement"
          className={cn(
            "text-meta text-accent hover:text-foreground max-sm:hidden",
            focus,
          )}
        >
          Voir tes zones d’allure et de FC →
        </Link>
      </div>
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {markers.map((marker) => (
          <div
            key={marker.key}
            className={cn(
              "flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-3 sm:p-4",
              marker.key === "vam" && "max-sm:hidden",
            )}
          >
            <dt>
              <MonoLabel size="micro">{marker.label}</MonoLabel>
            </dt>
            <dd>
              <Metric
                value={marker.value ?? "—"}
                unit={marker.unit ?? undefined}
                className={cn(
                  "text-2xl sm:text-[30px] [&>span]:text-sm [&>span]:text-muted-foreground",
                  marker.value === null && "text-dim",
                )}
              />
            </dd>
            <dd className={cn("text-[11px] sm:text-xs", tones[marker.tone])}>
              {marker.detail}
            </dd>
          </div>
        ))}
      </dl>
      <Link
        href="/settings/profile#entrainement"
        className={cn(
          "flex min-h-11 items-center text-meta text-accent hover:text-foreground sm:hidden",
          focus,
        )}
      >
        Voir tes zones d’allure et de FC →
      </Link>
    </section>
  );
}

function Row({ row }: { row: RecordRow }) {
  const content = (
    <>
      <span className="flex min-w-0 flex-col gap-0.5 max-sm:contents">
        <span className="text-sm sm:text-[15px]">{row.label}</span>
        <span className="truncate text-xs text-muted-foreground max-sm:order-3">
          {row.detail}
        </span>
      </span>
      <Metric
        value={row.value ?? "—"}
        className={cn(
          "text-[22px] max-sm:order-2 max-sm:justify-self-end sm:text-[26px]",
          row.value === null && "text-muted-foreground",
        )}
      />
      <span
        className={cn(
          "flex items-center justify-end gap-1 text-right text-xs max-sm:order-4 sm:min-w-28",
          tones[row.tone],
        )}
      >
        {row.side}
        {row.href && (
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        )}
      </span>
    </>
  );
  const className =
    "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.75 border-b border-border py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-4 sm:py-3.25";
  return row.href ? (
    <li>
      <Link
        href={row.href}
        prefetch={false}
        className={cn(
          className,
          "transition-colors hover:bg-surface-raised/40",
          focus,
        )}
      >
        {content}
      </Link>
    </li>
  ) : (
    <li className={className}>{content}</li>
  );
}

export function RecordList({
  id,
  title,
  rows,
  empty,
}: {
  id: string;
  title: string;
  rows: RecordRow[];
  empty: string;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <h2 id={id} className="text-base font-semibold sm:text-lg">
        {title}
      </h2>
      {rows.length ? (
        <ul className="flex flex-col border-t border-border">
          {rows.map((row) => (
            <Row key={row.key} row={row} />
          ))}
        </ul>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  );
}
