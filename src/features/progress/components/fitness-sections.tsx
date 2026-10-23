import { ChevronRightIcon } from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { CoachNote } from "@/components/stride/coach-note";
import { SourceMark, TrendMark } from "@/components/stride/marks";
import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import { StrideMark } from "@/components/stride/stride-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MeasureRow } from "../fitness";
import { formatClock, formatDayMonth, formatInteger } from "../format";
import type { GarminPrediction } from "../garmin-predictions";
import type { GoalCard } from "../goal";
import type { IntensityDistribution } from "../intensity";
import type { LoadAdvice } from "../reading";
import type { RunningVolume } from "../running-volume";

export function SectionTitle({
  id,
  children,
  meta,
}: {
  id: string;
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-base font-semibold sm:text-lg">
        {children}
      </h2>
      {meta}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-border pt-3 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

const linkFocus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function GoalCardView({ goal }: { goal: GoalCard | null }) {
  if (!goal)
    return (
      <section
        aria-labelledby="progress-goal"
        className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:p-5"
      >
        <h2 id="progress-goal">
          <MonoLabel size="micro">Objectif</MonoLabel>
        </h2>
        <p className="text-sm text-muted">
          Aucune course A ou B à venir. Ajoute ton prochain objectif pour suivre
          ta préparation ici.
        </p>
        <Link
          href="/races"
          className={cn(
            "w-fit text-sm text-accent hover:text-foreground",
            linkFocus,
          )}
        >
          Ouvrir tes courses →
        </Link>
      </section>
    );
  const prep = goal.preparation;
  return (
    <section aria-labelledby="progress-goal">
      <Link
        href={`/races/${goal.id}`}
        className={cn(
          "flex flex-col gap-4 rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong sm:p-5",
          linkFocus,
        )}
      >
        <span className="flex items-center gap-2">
          <MonoLabel size="micro" tone="accent">
            Objectif {goal.priority}
          </MonoLabel>
          <MonoLabel size="micro">
            · {goal.date} · {goal.countdown}
          </MonoLabel>
          <span className="ml-auto flex items-center text-meta text-muted-foreground">
            <span className="max-sm:sr-only">Ouvrir la course</span>
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </span>
        </span>
        <h2
          id="progress-goal"
          className="text-lead font-semibold tracking-[-0.015em] sm:text-title"
        >
          {goal.name}
        </h2>
        {goal.road ? (
          <span className="grid grid-cols-2 gap-3">
            <span className="flex flex-col gap-0.5">
              <MonoLabel size="micro">Ton objectif</MonoLabel>
              <Metric value={goal.target ?? "—"} className="text-[30px]" />
            </span>
            <span className="flex flex-col gap-0.5">
              <MonoLabel size="micro" className="flex items-center gap-1.5">
                <SourceMark source="provider" />
                Prévision Garmin
              </MonoLabel>
              <Metric
                value={goal.road.prediction ?? "—"}
                className="text-[30px] text-muted"
              />
            </span>
            <span
              className={cn(
                "col-span-2 text-meta",
                goal.road.tone === "success" && "text-success",
                goal.road.tone === "warning" && "text-warning",
                goal.road.tone === "muted" && "text-muted-foreground",
              )}
            >
              {goal.road.verdict}
            </span>
          </span>
        ) : (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <MonoLabel size="micro">Ton objectif</MonoLabel>
              <Metric value={goal.target ?? "—"} className="text-[34px]" />
            </span>
            {prep && (
              <span className="grid grid-cols-3 gap-2.5">
                <span className="flex flex-col gap-0.5">
                  <MonoLabel size="micro">Plus longue</MonoLabel>
                  <Metric
                    value={prep.longest ?? "—"}
                    unit={prep.distance ? `/ ${prep.distance} km` : "km"}
                    className="text-[22px] [&>span]:text-meta [&>span]:text-muted-foreground"
                  />
                </span>
                <span className="flex flex-col gap-0.5">
                  <MonoLabel size="micro">D+ max sem.</MonoLabel>
                  <Metric
                    value={prep.weeklyGain ?? "—"}
                    unit="m"
                    className="text-[22px] [&>span]:text-meta [&>span]:text-muted-foreground"
                  />
                </span>
                <span className="flex flex-col gap-0.5">
                  <MonoLabel size="micro">Préparation</MonoLabel>
                  <Metric
                    value={
                      prep.preparation
                        ? formatInteger(prep.preparation.done)
                        : "—"
                    }
                    unit={
                      prep.preparation
                        ? `/ ${formatInteger(prep.preparation.total)}`
                        : undefined
                    }
                    className="text-[22px] [&>span]:text-meta [&>span]:text-muted-foreground"
                  />
                </span>
              </span>
            )}
            {goal.note && (
              <span className="text-xs text-muted-foreground">{goal.note}</span>
            )}
          </>
        )}
        {goal.phase ? (
          <span className="flex flex-col gap-1.5">
            <span className="flex justify-between gap-3 text-xs text-muted">
              <span>{goal.phase.label}</span>
              {goal.phase.taper && <span>{goal.phase.taper}</span>}
            </span>
            <span
              aria-hidden="true"
              className="grid h-2 gap-0.75"
              style={{
                gridTemplateColumns: goal.phase.segments
                  .map((segment) => `${segment.weeks}fr`)
                  .join(" "),
              }}
            >
              {goal.phase.segments.map((segment) => (
                <span
                  key={segment.key}
                  className="overflow-hidden rounded-mark bg-border-strong"
                >
                  <span
                    className={cn(
                      "block h-full",
                      segment.state === "past" ? "bg-provider" : "bg-accent",
                    )}
                    style={{ width: `${segment.progress * 100}%` }}
                  />
                </span>
              ))}
            </span>
            <span
              aria-hidden="true"
              className="grid gap-0.75 text-[11px] text-muted-foreground"
              style={{
                gridTemplateColumns: goal.phase.segments
                  .map((segment) => `${segment.weeks}fr`)
                  .join(" "),
              }}
            >
              {goal.phase.segments.map((segment) => (
                <span key={segment.key} className="truncate">
                  {segment.name}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Pas de plan actif : la phase d’entraînement apparaîtra avec ton
            plan.
          </span>
        )}
      </Link>
    </section>
  );
}

export function LoadAdviceCard({ advice }: { advice: LoadAdvice }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-4">
      <p className="flex flex-1 items-start gap-2.5 text-sm leading-normal text-pretty">
        <StrideMark className="mt-1 size-3.5 shrink-0" />
        {advice.text}
      </p>
      {advice.actions.length > 0 && (
        <div className="flex shrink-0 gap-2 max-sm:[&>*]:flex-1">
          {advice.actions.map((action) => (
            <Button
              key={action.label}
              asChild
              variant="outline"
              size="md"
              className="max-sm:min-h-11"
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function delta(prediction: GarminPrediction) {
  if (!prediction.previous) return { label: "—", tone: "muted" as const };
  const gap = prediction.seconds - prediction.previous.seconds;
  if (gap === 0) return { label: "=", tone: "muted" as const };
  return {
    label: `${gap < 0 ? "−" : "+"}${formatClock(Math.abs(gap))}`,
    tone: gap < 0 ? ("success" as const) : ("warning" as const),
  };
}

export function PredictionSection({
  predictions,
}: {
  predictions: GarminPrediction[];
}) {
  const rows = predictions.filter((item) => item.key !== "5k");
  return (
    <section
      aria-labelledby="progress-predictions"
      className="flex flex-col gap-2.5"
    >
      <SectionTitle
        id="progress-predictions"
        meta={
          <MonoLabel size="micro" className="flex items-center gap-1.5">
            <SourceMark source="provider" />
            Garmin
          </MonoLabel>
        }
      >
        Prévisions de course
      </SectionTitle>
      {rows.length ? (
        <>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto_3.5rem] items-baseline gap-x-4 gap-y-3 border-t border-border pt-3">
            {rows.map((prediction) => {
              const change = delta(prediction);
              return (
                <div key={prediction.key} className="contents">
                  <dt className="text-sm">{prediction.label}</dt>
                  <dd>
                    <Metric
                      value={formatClock(prediction.seconds)}
                      className="text-2xl"
                    />
                  </dd>
                  <dd
                    className={cn(
                      "text-right text-xs",
                      change.tone === "success" && "text-success",
                      change.tone === "warning" && "text-warning",
                      change.tone === "muted" && "text-muted-foreground",
                    )}
                  >
                    {change.label}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="text-xs text-muted-foreground">
            Écart sur 4 semaines · mêmes chiffres que ton coach.
          </p>
        </>
      ) : (
        <Empty>
          Garmin n’a pas encore transmis de prévisions de course. Elles
          apparaîtront après une prochaine synchronisation.
        </Empty>
      )}
    </section>
  );
}

const intensityColors = {
  easy: "bg-success",
  tempo: "bg-warning",
  hard: "bg-danger",
} as const;

export function IntensitySection({
  intensity,
}: {
  intensity: IntensityDistribution | null;
}) {
  return (
    <section
      aria-labelledby="progress-intensity"
      className="flex flex-col gap-2.5"
    >
      <SectionTitle
        id="progress-intensity"
        meta={<MonoLabel size="micro">4 sem. · temps en zones</MonoLabel>}
      >
        Répartition de l’intensité
      </SectionTitle>
      {intensity ? (
        <>
          <div
            aria-hidden="true"
            className="flex h-3.5 gap-0.5 overflow-hidden rounded-tag"
          >
            {intensity.shares.map((share) => (
              <span
                key={share.key}
                className={intensityColors[share.key]}
                style={{ width: `${share.share * 100}%` }}
              />
            ))}
          </div>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            {intensity.shares.map((share) => (
              <div key={share.key} className="flex flex-col gap-0.5">
                <dt className="text-muted">{share.label}</dt>
                <dd>
                  <Metric
                    value={`${formatInteger(share.share * 100)} %`}
                    className={cn(
                      "text-2xl",
                      !share.onTarget &&
                        share.key === "tempo" &&
                        "text-warning",
                    )}
                  />
                </dd>
                <dd className="text-muted-foreground">{share.target}</dd>
              </div>
            ))}
          </dl>
          {intensity.drift && (
            <Link
              href="/activities"
              className={cn(
                "text-meta leading-normal text-muted hover:text-foreground",
                linkFocus,
              )}
            >
              {intensity.drift.note}{" "}
              <span className="text-accent">Voir ces sorties ›</span>
            </Link>
          )}
        </>
      ) : (
        <Empty>
          Aucune sortie avec fréquence cardiaque ces 4 dernières semaines, ou
          zones cardiaques indisponibles.
        </Empty>
      )}
    </section>
  );
}

export function RunningVolumeSection({ volume }: { volume: RunningVolume }) {
  const max = Math.max(
    1,
    ...volume.weeks.flatMap((week) => [
      week.doneMeters,
      week.plannedMeters ?? 0,
    ]),
  );
  const hasPlan = volume.weeks.some((week) => week.plannedMeters !== null);
  return (
    <section
      aria-labelledby="progress-volume"
      className="flex min-w-0 flex-col gap-3.5"
    >
      <SectionTitle
        id="progress-volume"
        meta={
          <ul className="flex gap-3.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-mark bg-foreground"
              />
              Fait
            </li>
            {hasPlan && (
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 border-[1.5px] border-dashed border-muted-foreground"
                />
                Prévu
              </li>
            )}
          </ul>
        }
      >
        Course à pied · km par semaine
      </SectionTitle>
      <ol className="flex h-36 items-end gap-1.5 border-b border-border-strong sm:h-45 sm:gap-2.5">
        {volume.weeks.map((week) => (
          <li
            key={week.start}
            className="relative flex h-full flex-1 items-end"
          >
            {week.plannedMeters !== null && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-0 bottom-0 border-[1.5px] border-b-0 border-dashed",
                  week.current ? "border-accent" : "border-dim",
                )}
                style={{ height: `${(week.plannedMeters / max) * 100}%` }}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "w-full rounded-t-mark",
                week.current ? "bg-accent" : "bg-foreground",
              )}
              style={{
                height: `${Math.max(week.doneMeters > 0 ? 2 : 0, (week.doneMeters / max) * 100)}%`,
              }}
            />
            <span className="sr-only">
              {`Semaine du ${formatDayMonth(week.start)} : ${formatInteger(week.doneMeters / 1000)} km${week.plannedMeters === null ? "" : ` sur ${formatInteger(week.plannedMeters / 1000)} prévus`}${week.current ? ", en cours" : ""}`}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatDayMonth(volume.weeks[0].start)}</span>
        <span>Cette semaine</span>
      </div>
      <p className="text-sm leading-normal text-muted">{volume.summary}</p>
      {!hasPlan && (
        <p className="text-xs text-muted-foreground">
          Sans plan actif, Stride affiche seulement les kilomètres réalisés.
        </p>
      )}
    </section>
  );
}

const toneText = {
  success: "text-success",
  muted: "text-muted",
  warning: "text-warning",
  danger: "text-danger",
} as const;

export function MeasureSection({
  rows,
  note,
}: {
  rows: MeasureRow[];
  note: string | null;
}) {
  return (
    <section
      aria-labelledby="progress-measures"
      className="flex min-w-0 flex-col gap-2"
    >
      <SectionTitle id="progress-measures">Ce qui évolue</SectionTitle>
      <ul className="flex flex-col border-t border-border">
        {rows.map((row) => (
          <li key={row.key} className="border-b border-border">
            <Link
              href={row.href}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3.5 transition-colors hover:bg-surface-raised/40",
                linkFocus,
              )}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-medium">{row.label}</span>
                <span className="text-xs text-muted-foreground">
                  {row.detail}
                </span>
              </span>
              <Metric
                value={row.value}
                className={cn("text-[26px]", !row.trend && "text-dim")}
              />
              <span
                className={cn(
                  "col-span-2 flex items-center gap-1.5 text-meta",
                  toneText[row.tone],
                )}
              >
                {row.trend && <TrendMark trend={row.trend} />}
                <span className="text-muted">{row.verdict}</span>
                <ChevronRightIcon
                  aria-hidden="true"
                  className="ml-auto size-4 text-muted-foreground"
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {note && <CoachNote className="mt-2 leading-normal">{note}</CoachNote>}
      <p className="text-xs text-muted-foreground">
        Seuil et VO₂ max : dans Records, avec tes repères.
      </p>
    </section>
  );
}
