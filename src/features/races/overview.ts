import { z } from "zod";
import { pointDistance } from "./course";
import { gearReadiness, type ChecklistItem } from "./checklists";
import { formatDuration } from "./format";
import {
  daysUntil,
  type RacePlan,
  type RaceSummary,
  type StoredCourse,
} from "./race";
import { isStation, type Waypoint } from "./waypoints";
import { courseFromStored } from "./workspace";

export const racesViews = ["upcoming", "past", "all"] as const;
export type RacesView = (typeof racesViews)[number];

export const racesViewLabels: Record<RacesView, string> = {
  upcoming: "À venir",
  past: "Passées",
  all: "Toutes",
};

const viewSchema = z.enum(racesViews).catch("upcoming");

export function parseRacesView(value: unknown): RacesView {
  return viewSchema.parse(Array.isArray(value) ? value[0] : value);
}

export function racesViewHref(view: RacesView) {
  return view === "upcoming" ? "/races" : `/races?view=${view}`;
}

const priorityRank = { A: 0, B: 1, C: 2 } as const;

export function splitRaces(races: RaceSummary[], today: string) {
  const isPast = (race: RaceSummary) => race.date !== null && race.date < today;
  const upcoming = races
    .filter((race) => !isPast(race))
    .sort((a, b) => {
      if (a.date === null || b.date === null)
        return Number(a.date === null) - Number(b.date === null);
      return a.date.localeCompare(b.date);
    });
  const past = races
    .filter(isPast)
    .sort((a, b) => (b.date as string).localeCompare(a.date as string));
  const featured =
    [...upcoming].sort(
      (a, b) => priorityRank[a.priority] - priorityRank[b.priority],
    )[0] ?? null;
  return {
    upcoming,
    past,
    featured,
    calendar: upcoming.filter((race) => race.id !== featured?.id),
  };
}

export const trainingPhases = [
  { label: "Reprise", threshold: 120 },
  { label: "Volume", threshold: 56 },
  { label: "Spécifique", threshold: 14 },
  { label: "Affûtage", threshold: 0 },
] as const;

const dayMs = 86_400_000;

function epoch(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}

const monthLabel = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  timeZone: "UTC",
});

export type SeasonTimeline = {
  months: { key: string; label: string; left: number }[];
  phases: { label: string; left: number; width: number }[];
  markers: {
    id: string;
    name: string;
    priority: RaceSummary["priority"];
    date: string;
    left: number;
  }[];
};

export function seasonTimeline(
  races: RaceSummary[],
  today: string,
  focus: RaceSummary | null,
): SeasonTimeline | null {
  const dated = races.filter(
    (race): race is RaceSummary & { date: string } =>
      race.date !== null && race.date >= today,
  );
  if (dated.length === 0) return null;
  const start = epoch(today);
  const last = Math.max(...dated.map((race) => epoch(race.date)));
  const lastDay = new Date(last);
  const end = Math.max(
    Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth() + 1, 1),
    start + 60 * dayMs,
  );
  const span = end - start;
  const at = (time: number) =>
    Math.min(100, Math.max(0, ((time - start) / span) * 100));
  const months: SeasonTimeline["months"] = [];
  const cursor = new Date(start);
  let month = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
  while (month < end) {
    months.push({
      key: new Date(month).toISOString().slice(0, 7),
      label: monthLabel.format(new Date(month)),
      left: at(month),
    });
    const next = new Date(month);
    month = Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1);
  }
  const phases: SeasonTimeline["phases"] = [];
  if (focus?.date && focus.date >= today) {
    const goal = epoch(focus.date);
    trainingPhases.forEach((phase, index) => {
      const from = index === 0 ? start : goal - phase.threshold * dayMs;
      const next = trainingPhases[index + 1];
      const to = next ? goal - next.threshold * dayMs : goal;
      if (to <= start) return;
      phases.push({
        label: phase.label,
        left: at(Math.max(from, start)),
        width: at(to) - at(Math.max(from, start)),
      });
    });
  }
  return {
    months,
    phases,
    markers: dated.map((race) => ({
      id: race.id,
      name: race.name,
      priority: race.priority,
      date: race.date,
      left: at(epoch(race.date)),
    })),
  };
}

export type PreparationRow = {
  key: string;
  label: string;
  detail: string;
  state: "done" | "partial" | "todo";
  href: string;
};

type OverviewInput = {
  race: RaceSummary;
  plan: RacePlan;
  course: StoredCourse | null;
  waypoints: Waypoint[];
  checklist: ChecklistItem[];
};

export function preparationRows({
  race,
  plan,
  course,
  waypoints,
  checklist,
}: OverviewInput): PreparationRow[] {
  const base = `/races/${race.id}`;
  const trail = race.kind === "trail";
  const stations = waypoints.filter((waypoint) => isStation(waypoint.kind));
  const gear = gearReadiness(checklist);
  const rows: PreparationRow[] = [
    {
      key: "course",
      label: "GPX importé",
      detail: course ? (course.fileName ?? "Parcours importé") : "à importer",
      state: course ? "done" : "todo",
      href: `${base}/course`,
    },
  ];
  if (trail)
    rows.push({
      key: "waypoints",
      label: "Points de passage",
      detail: waypoints.length
        ? `${waypoints.length} dont ${stations.length} ${stations.length > 1 ? "ravitos" : "ravito"}`
        : "à renseigner",
      state: waypoints.length ? "done" : "todo",
      href: `${base}/waypoints`,
    });
  rows.push(
    {
      key: "target",
      label: "Objectif de temps",
      detail: race.targetSeconds
        ? formatDuration(race.targetSeconds)
        : "à définir",
      state: race.targetSeconds ? "done" : "todo",
      href: base,
    },
    {
      key: "start",
      label: "Heure de départ",
      detail: plan.startConfirmed ? "confirmée" : "à confirmer",
      state: plan.startConfirmed ? "done" : "todo",
      href: base,
    },
  );
  if (trail) {
    rows.push(
      {
        key: "gear",
        label: "Équipement",
        detail: gear.total ? `${gear.ready} sur ${gear.total}` : "à préparer",
        state:
          gear.total === 0 || gear.ready === 0
            ? "todo"
            : gear.ready === gear.total
              ? "done"
              : "partial",
        href: `${base}/gear`,
      },
      {
        key: "watch",
        label: "Alertes montre",
        detail: waypoints.some((waypoint) => waypoint.watchLabel)
          ? "configurées"
          : "à configurer",
        state: waypoints.some((waypoint) => waypoint.watchLabel)
          ? "done"
          : "todo",
        href: `${base}/waypoints#montre`,
      },
    );
  }
  return rows;
}

const nextSteps: Record<string, string> = {
  course: "Importe le GPX pour calculer le profil, le dénivelé et la nuit.",
  waypoints: "Place les ravitos et les barrières horaires sur le parcours.",
  target: "Renseigne un temps objectif pour projeter les passages.",
  start: "Confirme l’heure de départ pour fixer la nuit et la météo.",
  gear: "Complète la liste d’équipement avant les sorties de test.",
  watch: "Configure les alertes de ravitos pour la montre.",
};

export function preparationProgress(rows: PreparationRow[]) {
  const done = rows.filter((row) => row.state === "done").length;
  const pending = rows.find((row) => row.state !== "done") ?? null;
  return {
    done,
    total: rows.length,
    next: pending ? (nextSteps[pending.key] ?? null) : null,
    nextHref: pending?.href ?? null,
  };
}

export function elevationSamples(stored: StoredCourse, count = 96) {
  const course = courseFromStored(stored);
  const stride = Math.max(1, Math.floor(course.points.length / count));
  const samples = course.points.flatMap((point, index) =>
    point[2] !== null &&
    (index % stride === 0 || index === course.points.length - 1)
      ? [{ distanceM: pointDistance(course, index), ele: point[2] }]
      : [],
  );
  return samples.length >= 2 ? samples : null;
}

export function countdownLabel(date: string | null, today: string) {
  if (!date) return null;
  const days = daysUntil(date, today);
  if (days < 0) return null;
  return days === 0 ? "Jour J" : `J-${days}`;
}
