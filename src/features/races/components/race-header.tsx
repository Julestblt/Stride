import Link from "next/link";
import { DownloadIcon, MapPinIcon, UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import {
  formatClock,
  formatDuration,
  formatInteger,
  formatKm,
} from "../format";
import {
  daysUntil,
  defaultStartMinutes,
  formatRaceDate,
  formatShortDate,
  formatWeekday,
  type RacePlan,
  type RaceSummary,
  type StoredCourse,
} from "../race";
import { RaceSettingsDialog } from "./race-settings-dialog";

function Countdown({
  race,
  plan,
  today,
}: {
  race: RaceSummary;
  plan: RacePlan;
  today: string;
}) {
  const start = formatClock(plan.startMinutes ?? defaultStartMinutes);
  const startText =
    plan.startMinutes === null
      ? "Heure de départ à définir"
      : `Départ ${start}${plan.startConfirmed ? "" : " · à confirmer"}`;
  if (!race.date)
    return (
      <p className="text-sm text-muted-foreground">Date de course à définir</p>
    );
  const days = daysUntil(race.date, today);
  const close = days >= 0 && days <= 7;
  const value =
    days < 0
      ? null
      : days === 0
        ? "Jour J"
        : close
          ? `J-${days}`
          : String(days);
  if (value === null)
    return (
      <p className="text-sm text-muted-foreground">
        Course terminée le {formatShortDate(race.date)}
      </p>
    );
  return (
    <div className="flex items-end gap-3">
      <span
        className={cn(
          "font-metric text-[4rem] leading-[0.8] font-semibold tracking-[-0.01em] tabular-nums",
          close && "text-accent",
        )}
      >
        {value}
      </span>
      <div className="flex flex-col gap-0.75 pb-0.5">
        <span className="text-sm">
          {close
            ? `${formatWeekday(race.date)}, départ ${start}`
            : days === 1
              ? "jour restant"
              : "jours restants"}
        </span>
        <span className="text-xs text-muted-foreground">
          {close
            ? plan.startConfirmed
              ? "Heure confirmée"
              : "Heure à confirmer"
            : startText}
        </span>
      </div>
    </div>
  );
}

const importedDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

function CourseStatus({
  course,
  compact = false,
}: {
  course: StoredCourse;
  compact?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-meta text-muted">
      <PulseDot tone="success" breathing={false} />
      <MonoLabel size="micro" tone="secondary" className="truncate">
        {course.fileName ??
          (course.source === "activity" ? "Activité Garmin" : "parcours.gpx")}
      </MonoLabel>
      <span className="shrink-0">
        · {compact ? "" : "importé le "}
        {importedDate.format(new Date(course.importedAt)).replace(".", "")}
      </span>
    </span>
  );
}

type Stat = {
  key: string;
  value: string;
  label: string;
  detail: React.ReactNode;
  edit?: boolean;
};

function stats(
  race: RaceSummary,
  plan: RacePlan,
  course: StoredCourse | null,
): Stat[] {
  const announcedKm = race.distanceKm;
  const announcedGain = race.elevationGainM;
  const start = plan.startMinutes ?? defaultStartMinutes;
  const scenarios = [
    plan.ambitiousSeconds &&
      `ambitieux ${formatDuration(plan.ambitiousSeconds)}`,
    plan.cautiousSeconds && `prudent ${formatDuration(plan.cautiousSeconds)}`,
  ].filter(Boolean);
  return [
    {
      key: "distance",
      value: course
        ? `${formatKm(course.distanceM)} km`
        : announcedKm
          ? `${formatInteger(announcedKm)} km`
          : "—",
      label: "Distance",
      detail: course
        ? `GPX${announcedKm ? ` · annoncé ${formatInteger(announcedKm)} km` : ""}`
        : "annoncé",
    },
    {
      key: "gain",
      value:
        course?.elevationGainM != null
          ? `${formatInteger(course.elevationGainM)} m`
          : announcedGain !== null
            ? `${formatInteger(announcedGain)} m`
            : "—",
      label: "D+",
      detail:
        course?.elevationGainM != null
          ? `GPX${announcedGain !== null ? ` · annoncé ${formatInteger(announcedGain)} m` : ""}`
          : "annoncé",
    },
    {
      key: "loss",
      value:
        course?.elevationLossM != null
          ? `${formatInteger(course.elevationLossM)} m`
          : "—",
      label: "D−",
      detail: course ? "GPX" : "avec le GPX",
    },
    {
      key: "start",
      value: formatClock(start),
      label: "Départ",
      detail:
        plan.startMinutes === null
          ? "par défaut"
          : plan.startConfirmed
            ? "confirmé"
            : "à confirmer",
      edit: true,
    },
    {
      key: "target",
      value: race.targetSeconds ? formatDuration(race.targetSeconds) : "—",
      label: "Objectif",
      detail: scenarios.length ? scenarios.join(" · ") : "à définir",
      edit: true,
    },
    {
      key: "cutoff",
      value: plan.cutoffSeconds ? formatDuration(plan.cutoffSeconds) : "—",
      label: "Barrière",
      detail: plan.cutoffSeconds
        ? `arrivée avant ${formatClock(start + plan.cutoffSeconds / 60)}`
        : "à renseigner",
      edit: true,
    },
  ];
}

export function RaceHeader({
  race,
  plan,
  course,
  waypointCount,
  today,
}: {
  race: RaceSummary;
  plan: RacePlan;
  course: StoredCourse | null;
  waypointCount: number;
  today: string;
}) {
  const base = `/races/${race.id}`;
  const meta = [
    `Course ${race.priority}`,
    race.date ? formatRaceDate(race.date) : null,
    ...plan.labels,
  ].filter(Boolean);
  const editTrigger = (children: React.ReactNode) => (
    <RaceSettingsDialog
      raceId={race.id}
      raceRevision={race.revision}
      targetSeconds={race.targetSeconds}
      plan={plan}
    >
      {children}
    </RaceSettingsDialog>
  );
  return (
    <div className="flex flex-col gap-5 sm:gap-7">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-3">
          <MonoLabel className="text-micro sm:text-label">
            {meta.join(" · ")}
          </MonoLabel>
          <h1 className="text-[2.125rem] leading-none font-semibold tracking-[-0.03em] text-balance sm:text-[clamp(2.125rem,4vw,3rem)]">
            {race.name}
          </h1>
          <Countdown race={race} plan={plan} today={today} />
        </div>
        {course ? (
          <div className="hidden flex-col items-end gap-2.5 sm:flex">
            <CourseStatus course={course} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                asChild
                variant="outline"
                size="md"
                className="rounded-surface text-meta"
              >
                <Link href={`${base}/course`}>
                  <UploadIcon className="size-3.5" />
                  Remplacer le GPX
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="md"
                className="rounded-surface text-meta"
              >
                <Link href={`${base}/waypoints`}>
                  <MapPinIcon className="size-3.5" />
                  Points de passage · {waypointCount}
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="md"
                className="rounded-surface text-meta"
              >
                <Link href={`${base}/waypoints#montre`}>
                  <DownloadIcon className="size-3.5" />
                  Exporter pour la montre
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="hidden flex-col items-end gap-2.5 sm:flex">
            <span className="inline-flex items-center gap-2 text-meta text-warning">
              <PulseDot tone="warning" breathing={false} />
              Aucun GPX pour cette course
            </span>
            <Button asChild size="md" className="rounded-surface text-meta">
              <Link href={`${base}/course`}>
                <UploadIcon className="size-3.5" />
                Ajouter le GPX
              </Link>
            </Button>
          </div>
        )}
      </section>
      <dl className="grid grid-cols-3 overflow-hidden rounded-panel border border-border bg-surface sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {stats(race, plan, course).map((stat, index) => (
          <div
            key={stat.key}
            className={cn(
              "flex min-w-0 flex-col gap-1 border-border px-3.5 py-3 sm:border-r sm:px-4.5 sm:py-4 sm:last:border-r-0",
              index % 3 !== 2 && "border-r",
              index < 3 && "max-sm:border-b",
            )}
          >
            <dd className="order-1 font-metric text-xl leading-none font-semibold tracking-[-0.01em] tabular-nums sm:text-[1.75rem]">
              {stat.value}
            </dd>
            <MonoLabel size="micro" asChild className="order-2">
              <dt>{stat.label}</dt>
            </MonoLabel>
            <dd className="order-3 hidden text-xs text-muted-foreground sm:block">
              {stat.detail}
              {stat.edit &&
                editTrigger(
                  <button
                    type="button"
                    className="ml-1 rounded-tag text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    · modifier
                  </button>,
                )}
            </dd>
          </div>
        ))}
      </dl>
      {course ? (
        <div className="flex flex-col gap-3 sm:hidden">
          <CourseStatus course={course} compact />
          <div className="grid grid-cols-3 gap-2">
            <Button
              asChild
              variant="outline"
              size="md"
              className="rounded-surface"
            >
              <Link href={`${base}/course`}>
                <UploadIcon className="size-3.5" />
                Remplacer
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="md"
              className="rounded-surface"
            >
              <Link href={`${base}/waypoints`}>
                <MapPinIcon className="size-3.5" />
                Points · {waypointCount}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="md"
              className="rounded-surface"
            >
              <Link href={`${base}/waypoints#montre`}>
                <DownloadIcon className="size-3.5" />
                Montre
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <span className="inline-flex items-center gap-2 text-meta text-warning sm:hidden">
          <PulseDot tone="warning" breathing={false} />
          Aucun GPX pour cette course
        </span>
      )}
      {editTrigger(
        <Button variant="outline" size="sm" className="self-start sm:hidden">
          Modifier départ, objectif et barrière
        </Button>,
      )}
    </div>
  );
}
