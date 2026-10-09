import {
  isSyncActive,
  type GarminSyncCategory,
  type GarminSyncCategoryStatus,
  type GarminSyncStatus,
} from "@/features/garmin/sync";

export type TimelineYear = { year: number; fill: number };
export type Timeline = { years: TimelineYear[]; reading: string | null };
export type CategoryTone = "muted" | "accent" | "success" | "warning";
export type CategoryView = {
  value: string;
  tone: CategoryTone;
  detail: string;
  bar: "empty" | "active" | "full" | "attention";
};
export type ImportNotice = "paused" | "slow" | "partial" | null;

export const timelineSpan = 9;

const day = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const month = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const count = new Intl.NumberFormat("fr-FR");

function date(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function formatMonth(value: string) {
  return month.format(date(value));
}

export function buildTimeline(
  observation: GarminSyncStatus | null,
  today: Date,
): Timeline {
  const current = today.getUTCFullYear();
  const oldest = observation?.categories.activities.oldestSynchronizedDate;
  const complete = observation?.categories.activities.state === "complete";
  const oldestYear = oldest ? date(oldest).getUTCFullYear() : null;
  const first =
    complete && oldestYear !== null
      ? oldestYear
      : Math.min(current - timelineSpan + 1, oldestYear ?? current);
  const years = Array.from({ length: current - first + 1 }, (_, index) => {
    const year = first + index;
    if (!oldest || oldestYear === null || year < oldestYear)
      return { year, fill: 0 };
    if (year > oldestYear) return { year, fill: 1 };
    const start = Date.UTC(year, 0, 1);
    const end = Date.UTC(year + 1, 0, 1);
    return { year, fill: (end - date(oldest).getTime()) / (end - start) };
  });
  return {
    years,
    reading: oldest && !complete ? formatMonth(oldest) : null,
  };
}

const unavailableDetail = "En attente de Garmin";

export function categoryView(
  category: GarminSyncCategory,
  status: GarminSyncCategoryStatus,
): CategoryView {
  const since = status.oldestSynchronizedDate;
  const activities =
    status.activityCount === null ? null : count.format(status.activityCount);
  const value =
    category === "activities" && activities !== null
      ? activities
      : {
          pending: "En attente",
          running: "En cours",
          partial: "En cours",
          complete: "Terminé",
          failed: "Incomplet",
        }[status.state];
  const tone: CategoryTone =
    status.state === "complete"
      ? "success"
      : status.state === "failed"
        ? "warning"
        : status.state === "pending"
          ? "muted"
          : "accent";
  const bar =
    status.state === "complete"
      ? "full"
      : status.state === "failed"
        ? "attention"
        : status.state === "pending"
          ? "empty"
          : "active";
  const detail = (() => {
    if (category === "patterns")
      return status.state === "pending"
        ? "Après les premières activités"
        : status.state === "complete"
          ? "D’après tout ton historique d’activités"
          : "D’après les activités déjà lues";
    if (!since)
      return status.state === "failed"
        ? "Garmin n’a pas renvoyé ces données"
        : unavailableDetail;
    if (category === "activities")
      return status.state === "complete"
        ? `Historique lu depuis le ${day.format(date(since))}`
        : `Lecture · ${day.format(date(since))}`;
    return `Depuis ${formatMonth(since)}`;
  })();
  return { value, tone, detail, bar };
}

export function importNotice(
  observation: GarminSyncStatus | null,
  {
    reconnect,
    unavailable,
  }: {
    reconnect: boolean;
    unavailable: boolean;
  },
): ImportNotice {
  if (reconnect) return "paused";
  if (unavailable) return "slow";
  if (
    observation &&
    Object.values(observation.categories).some(
      (category) => category.state === "failed",
    )
  )
    return "partial";
  return null;
}

export function isImportRunning(observation: GarminSyncStatus | null) {
  return observation === null || !observation.started
    ? true
    : isSyncActive(observation);
}
