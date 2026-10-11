import { z } from "zod";
import { formatClock } from "./format";

export const waypointKinds = [
  "start",
  "finish",
  "aid",
  "water",
  "base",
  "summit",
  "caution",
  "instruction",
] as const;
export type WaypointKind = (typeof waypointKinds)[number];

export const editableKinds = [
  "aid",
  "water",
  "base",
  "summit",
  "caution",
  "instruction",
] as const satisfies readonly WaypointKind[];

export const kindLabels: Record<WaypointKind, string> = {
  start: "Départ",
  finish: "Arrivée",
  aid: "Ravitaillement",
  water: "Point d’eau",
  base: "Base de vie",
  summit: "Sommet",
  caution: "Vigilance",
  instruction: "Consigne",
};

export const services = [
  "water",
  "sweet",
  "salty",
  "hot",
  "toilets",
  "assistance",
] as const;
export type Service = (typeof services)[number];

export const serviceLabels: Record<Service, string> = {
  water: "Eau",
  sweet: "Sucré",
  salty: "Salé",
  hot: "Chaud",
  toilets: "Toilettes",
  assistance: "Assistance",
};

export const alertDistances = [0, 200, 500, 1000] as const;
export type AlertDistance = (typeof alertDistances)[number];

export const waypointSources = [
  "gpx",
  "roadbook",
  "athlete",
  "course",
] as const;

export type Waypoint = {
  id: string;
  kind: WaypointKind;
  name: string;
  distanceM: number;
  cutoffMinutes: number | null;
  services: Service[];
  watchLabel: string | null;
  alertDistanceM: AlertDistance;
  voiceNote: string | null;
  todo: string | null;
  nutritionNote: string | null;
  source: (typeof waypointSources)[number];
  needsReview: boolean;
  revision: number;
};

export const waypointColumns =
  "id, kind, name, distance_m, cutoff_time, services, watch_label, alert_distance_m, voice_note, todo, nutrition_note, source, needs_review, revision";

const clockSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/)
  .transform((value) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  });

export const waypointRowSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(waypointKinds),
    name: z.string(),
    distance_m: z.coerce.number(),
    cutoff_time: clockSchema.nullable(),
    services: z.array(z.enum(services)),
    watch_label: z.string().nullable(),
    alert_distance_m: z.union([
      z.literal(0),
      z.literal(200),
      z.literal(500),
      z.literal(1000),
    ]),
    voice_note: z.string().nullable(),
    todo: z.string().nullable(),
    nutrition_note: z.string().nullable(),
    source: z.enum(waypointSources),
    needs_review: z.boolean(),
    revision: z.number().int().positive(),
  })
  .transform((row): Waypoint => ({
    id: row.id,
    kind: row.kind,
    name: row.name,
    distanceM: row.distance_m,
    cutoffMinutes: row.cutoff_time,
    services: row.services,
    watchLabel: row.watch_label,
    alertDistanceM: row.alert_distance_m,
    voiceNote: row.voice_note,
    todo: row.todo,
    nutritionNote: row.nutrition_note,
    source: row.source,
    needsReview: row.needs_review,
    revision: row.revision,
  }));

export const stationKinds: readonly WaypointKind[] = ["aid", "water", "base"];

export function isStation(kind: WaypointKind) {
  return stationKinds.includes(kind);
}

export function isSegmentBoundary(kind: WaypointKind) {
  return kind === "start" || kind === "finish" || isStation(kind);
}

export function sortWaypoints<T extends Pick<Waypoint, "distanceM" | "kind">>(
  waypoints: T[],
) {
  const rank = (kind: WaypointKind) =>
    kind === "start" ? -1 : kind === "finish" ? 1 : 0;
  return [...waypoints].sort(
    (a, b) => a.distanceM - b.distanceM || rank(a.kind) - rank(b.kind),
  );
}

export type WaypointMark =
  | { shape: "circle"; label: string; tone: "start" | "finish" | "station" }
  | { shape: "square"; label: string }
  | { shape: "diamond"; tone: "caution" | "instruction" }
  | { shape: "triangle" };

export function waypointMarks(waypoints: Pick<Waypoint, "kind">[]) {
  let station = 0;
  return waypoints.map((waypoint): WaypointMark => {
    if (waypoint.kind === "start")
      return { shape: "circle", label: "D", tone: "start" };
    if (waypoint.kind === "finish")
      return { shape: "circle", label: "A", tone: "finish" };
    if (waypoint.kind === "water") {
      station += 1;
      return { shape: "square", label: String(station) };
    }
    if (isStation(waypoint.kind)) {
      station += 1;
      return { shape: "circle", label: String(station), tone: "station" };
    }
    if (waypoint.kind === "summit") return { shape: "triangle" };
    return {
      shape: "diamond",
      tone: waypoint.kind === "caution" ? "caution" : "instruction",
    };
  });
}

export function cutoffElapsedMinutes(
  waypoints: Pick<Waypoint, "cutoffMinutes">[],
  startMinutes: number,
) {
  let floor = 0;
  return waypoints.map((waypoint) => {
    if (waypoint.cutoffMinutes === null) return null;
    let elapsed = waypoint.cutoffMinutes - startMinutes;
    while (elapsed < floor) elapsed += 1440;
    floor = elapsed;
    return elapsed;
  });
}

export function defaultWatchLabel(
  waypoint: Pick<Waypoint, "kind" | "name" | "cutoffMinutes">,
  mark: WaypointMark,
) {
  const prefix =
    waypoint.kind === "start"
      ? "Départ"
      : waypoint.kind === "finish"
        ? "Arrivée"
        : mark.shape === "circle" || mark.shape === "square"
          ? `${waypoint.kind === "water" ? "E" : "R"}${mark.label}`
          : waypoint.name;
  const cutoff =
    waypoint.cutoffMinutes === null
      ? ""
      : ` · BH ${formatClock(waypoint.cutoffMinutes).replace(":", "H")}`;
  return `${prefix}${cutoff}`.slice(0, 24);
}

const kindPatterns: [RegExp, WaypointKind][] = [
  [/\b(d[ée]part|start)\b/i, "start"],
  [/\b(arriv[ée]e|finish|end)\b/i, "finish"],
  [/\bbase\s*de\s*vie\b|\blife\s*base\b/i, "base"],
  [/\b(point\s*d.?eau|eau|water|drink)\b/i, "water"],
  [/\b(ravito|ravitaillement|aid|food|refreshment)\w*/i, "aid"],
  [/\b(sommet|summit|col|peak|top)\b/i, "summit"],
  [/\b(danger|vigilance|attention|caution|technique)\b/i, "caution"],
];

export function guessKind(...texts: (string | null)[]): WaypointKind | null {
  const text = texts.filter(Boolean).join(" ");
  return kindPatterns.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

export const waypointInputSchema = z.object({
  kind: z.enum(waypointKinds),
  name: z.string().trim().min(1).max(60),
  distanceM: z.number().min(0).max(1_000_000),
  cutoffMinutes: z.number().int().min(0).max(1439).nullable(),
  services: z.array(z.enum(services)).max(services.length),
  watchLabel: z.string().trim().min(1).max(24).nullable(),
  alertDistanceM: z.union([
    z.literal(0),
    z.literal(200),
    z.literal(500),
    z.literal(1000),
  ]),
  voiceNote: z.string().trim().max(280).nullable(),
  todo: z.string().trim().max(400).nullable(),
  nutritionNote: z.string().trim().max(280).nullable(),
});
export type WaypointInput = z.infer<typeof waypointInputSchema>;
