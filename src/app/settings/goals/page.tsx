import type { Metadata } from "next";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { Button } from "@/components/ui/button";
import { SettingsNotice } from "@/features/settings/components/settings-notice";
import { RaceWizard } from "@/features/settings/components/race-wizard";
import { localToday } from "@/features/app-shell/shell";
import {
  goalFocuses,
  racePriorities,
  resolveRaceSnapshots,
  type GoalFocus,
  type RacePriority,
} from "@/features/onboarding/goals";
import {
  daysUntil,
  formatRaceDistance,
  formatRaceLongDate,
  formatRaceShortDate,
  formatKm,
  formatTarget,
  priorityMissingCopy,
  splitRaces,
} from "@/features/settings/goals-view";
import { cn } from "@/lib/utils";
import { requireAthlete } from "@/server/app/session";
import { readGoals } from "@/server/onboarding/goals";
import { readRaceCourses } from "@/server/races/courses";
import { saveSettingsGoal } from "@/server/settings/actions";

export const metadata: Metadata = { title: "Objectifs et courses · Réglages" };

const focusLabels: Record<GoalFocus, string> = {
  general_fitness: "Forme générale",
  faster: "Courir plus vite",
  short_distance: "5 km ou 10 km",
  half_marathon_marathon: "Semi-marathon ou marathon",
  trail: "Trail",
  ultra_trail: "Ultra-trail",
};

const columns =
  "md:grid-cols-[2.75rem_minmax(0,1.6fr)_7.5rem_8.75rem_6.875rem_4.375rem]";

function PriorityBadge({
  priority,
  dashed = false,
}: {
  priority: RacePriority;
  dashed?: boolean;
}) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-control font-metric text-base font-bold",
        priority === "A" && !dashed && "bg-accent text-background",
        priority !== "A" &&
          !dashed &&
          "border-[1.5px] border-border-strong text-muted",
        dashed &&
          "border-[1.5px] border-dashed border-border-strong text-muted-foreground",
      )}
    >
      {priority}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1.5 font-mono text-micro tracking-wider text-muted uppercase md:px-0 md:text-label">
      {children}
    </h2>
  );
}

export default async function GoalsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    course?: string;
    priorite?: string;
  }>;
}) {
  const [context, query] = await Promise.all([requireAthlete(), searchParams]);
  const [goals, courses] = await Promise.all([
    readGoals(context),
    readRaceCourses(context),
  ]);
  const today = localToday(new Date());
  const races = goals.races.map((race) => ({
    id: race.id,
    revision: race.revision,
    values: race.values,
  }));
  const { upcoming, past, primary, missing } = splitRaces(
    resolveRaceSnapshots(races, courses),
    today,
  );
  const editing =
    query.course && query.course !== "nouvelle"
      ? (races.find((race) => race.id === query.course) ?? null)
      : null;
  const plan = editing
    ? await context.client
        .from("race_plans")
        .select("start_time, cutoff_duration_seconds")
        .eq("user_id", context.userId)
        .eq("race_id", editing.id)
        .maybeSingle()
    : null;
  const requestedPriority = racePriorities.find(
    (priority) => priority === query.priorite,
  );
  const wizardOpen = query.course === "nouvelle" || editing !== null;
  const primaryName =
    races.find(
      (race) =>
        race.values.priority === "A" &&
        race.id !== editing?.id &&
        race.values.name,
    )?.values.name ?? null;
  return (
    <div className="flex flex-col gap-6 md:gap-10">
      <div className="flex flex-col gap-2 px-1 md:px-0">
        <h1 className="text-2xl font-semibold tracking-tight md:text-[2rem] md:tracking-[-0.025em]">
          Objectifs et courses
        </h1>
        <p className="text-sm leading-normal text-muted md:text-body">
          Ta course A structure tout le plan. La changer crée une proposition de
          plan que tu peux relire avant.
        </p>
      </div>
      <SettingsNotice
        status={query.status}
        savedMessage="Objectif enregistré."
      />
      {wizardOpen && (
        <RaceWizard
          key={editing?.id ?? "nouvelle"}
          mode={editing ? "edit" : "create"}
          race={
            editing
              ? {
                  id: editing.id,
                  revision: editing.revision ?? 1,
                  values: editing.values,
                  startTime: plan?.data?.start_time?.slice(0, 5) ?? null,
                  cutoffSeconds: plan?.data?.cutoff_duration_seconds ?? null,
                }
              : undefined
          }
          defaultPriority={requestedPriority ?? "B"}
          primaryName={primaryName}
        />
      )}
      {primary && (
        <section className="flex flex-col gap-2 md:gap-3">
          <SectionTitle>Objectif principal</SectionTitle>
          <div className="flex flex-col gap-3.5 rounded-card border border-accent bg-surface p-4 md:flex-row md:flex-wrap md:items-center md:gap-4 md:rounded-surface md:bg-transparent md:px-5 md:py-4.5">
            <div className="flex min-w-0 items-start gap-3 md:min-w-55 md:flex-1 md:items-center md:gap-4">
              <PriorityBadge priority="A" />
              <div className="flex min-w-0 flex-col gap-0.75">
                <span className="text-lg font-semibold">
                  {primary.values.name}
                </span>
                <span className="text-meta leading-snug text-muted-foreground">
                  {[
                    formatRaceLongDate(primary.values.race_date),
                    formatKm(primary.values.distance_km),
                    primary.values.elevation_gain_m
                      ? `${new Intl.NumberFormat("fr-FR").format(primary.values.elevation_gain_m)} m D+`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            </div>
            <div className="flex items-end justify-between gap-4 max-md:border-t max-md:border-border max-md:pt-3 md:contents">
              <div className="flex flex-col gap-0.75 md:items-end">
                <span className="font-metric text-3xl leading-none font-semibold tabular-nums md:text-[1.625rem]">
                  {primary.values.race_date
                    ? `${daysUntil(primary.values.race_date, today)} jours`
                    : "—"}
                </span>
                {primary.values.target_duration_seconds !== null && (
                  <span className="text-xs text-muted-foreground">
                    Cible {formatTarget(primary.values.target_duration_seconds)}
                  </span>
                )}
              </div>
              <Link
                href={`/races/${primary.id}`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline md:min-h-0"
              >
                Plan de course →
              </Link>
            </div>
          </div>
        </section>
      )}
      <section className="flex flex-col gap-2 md:gap-0">
        <div
          className={cn(
            "hidden gap-4 border-b border-border-strong pb-2.5 font-mono text-micro tracking-wider text-muted uppercase md:grid",
            columns,
          )}
        >
          <span>Prio</span>
          <span>À venir</span>
          <span>Date</span>
          <span>Distance</span>
          <span>Cible</span>
          <span />
        </div>
        <h2 className="px-1.5 font-mono text-micro tracking-wider text-muted uppercase md:hidden">
          À venir
        </h2>
        <div className="flex flex-col overflow-hidden rounded-card border border-border bg-surface md:overflow-visible md:rounded-none md:border-0 md:bg-transparent">
          {upcoming.map((race) => (
            <div
              key={race.id}
              className={cn(
                "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3 pr-2 pl-4 md:gap-4 md:py-4 md:pr-0 md:pl-0",
                columns,
              )}
            >
              <PriorityBadge priority={race.values.priority} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-body font-medium">
                  {race.values.name ?? "Course sans nom"}
                </span>
                <span className="text-meta text-muted-foreground md:hidden">
                  {formatRaceShortDate(race.values.race_date)} ·{" "}
                  {formatRaceDistance(race.values)}
                  {race.values.target_duration_seconds !== null &&
                    ` · cible ${formatTarget(race.values.target_duration_seconds)}`}
                </span>
              </div>
              <span className="hidden text-sm text-muted md:block">
                {formatRaceShortDate(race.values.race_date)}
              </span>
              <span className="hidden font-metric text-lg font-semibold tabular-nums md:block">
                {formatRaceDistance(race.values)}
              </span>
              <span className="hidden font-metric text-lg font-semibold tabular-nums md:block">
                {formatTarget(race.values.target_duration_seconds)}
              </span>
              <Link
                href={`/settings/goals?course=${race.id}`}
                className="inline-flex min-h-11 items-center justify-end px-2.5 text-meta text-muted hover:text-foreground md:min-h-8 md:px-0 md:pr-3.5"
              >
                Modifier
              </Link>
            </div>
          ))}
          {missing.map((priority) => (
            <div
              key={priority}
              className={cn(
                "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3 pr-2 pl-4 last:border-b-0 md:gap-4 md:py-4 md:pr-0 md:pl-0",
                columns,
              )}
            >
              <PriorityBadge priority={priority} dashed />
              <span className="text-sm leading-snug text-muted-foreground md:col-span-4 md:max-w-xl">
                {priorityMissingCopy[priority]}
              </span>
              <Link
                href={`/settings/goals?course=nouvelle&priorite=${priority}`}
                className="inline-flex min-h-11 items-center justify-end px-2.5 text-meta font-medium text-accent hover:underline md:min-h-8 md:px-0 md:pr-3.5"
              >
                Ajouter
              </Link>
            </div>
          ))}
        </div>
      </section>
      {past.length > 0 && (
        <section className="flex flex-col gap-2 md:gap-0">
          <h2 className="px-1.5 font-mono text-micro tracking-wider text-muted uppercase md:border-b md:border-border-strong md:px-0 md:pb-2.5 md:text-label">
            Courses passées
          </h2>
          <div className="flex flex-col overflow-hidden rounded-card border border-border bg-surface md:overflow-visible md:rounded-none md:border-0 md:bg-transparent">
            {past.map((race) => (
              <div
                key={race.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 border-b border-border px-4 py-3 text-body last:border-b-0 md:grid-cols-[minmax(0,1.6fr)_7.5rem_8.75rem_6.875rem] md:gap-4 md:px-0 md:py-3.25 md:text-sm"
              >
                <span className="truncate">
                  {race.values.name ?? "Course sans nom"}
                </span>
                <span className="font-metric text-[1.0625rem] font-semibold md:order-last">
                  {race.values.target_duration_seconds !== null
                    ? formatTarget(race.values.target_duration_seconds)
                    : "Terminé"}
                </span>
                <span className="text-meta text-muted-foreground md:order-2 md:text-sm">
                  {formatRaceShortDate(race.values.race_date)}
                </span>
                <span className="text-right font-metric text-base font-semibold text-muted md:order-3 md:text-left md:text-[1.0625rem] md:text-foreground">
                  {formatKm(race.values.distance_km)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="flex flex-col gap-2 md:gap-3">
        <SectionTitle>Objectif de course</SectionTitle>
        <form
          action={saveSettingsGoal}
          className="flex flex-col gap-3 md:max-w-md"
        >
          <input
            type="hidden"
            name="revision"
            value={goals.goal.revision ?? ""}
          />
          <label htmlFor="focus" className="text-sm font-medium">
            Quel est ton objectif ?
          </label>
          <select
            id="focus"
            name="focus"
            defaultValue={goals.goal.values.focus ?? ""}
            className="h-10 w-full rounded-control border border-border-strong bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
          >
            {goalFocuses.map((focus) => (
              <option key={focus} value={focus}>
                {focusLabels[focus]}
              </option>
            ))}
          </select>
          <Button type="submit" className="self-start">
            Enregistrer l’objectif
          </Button>
        </form>
      </section>
    </div>
  );
}
