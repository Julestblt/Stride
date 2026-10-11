import { z } from "zod";
import { parseClock } from "./format";
import {
  guessKind,
  services,
  type Service,
  type WaypointKind,
} from "./waypoints";

export const roadbookCandidateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  km: z.number().min(0).max(1000),
  kind: z.enum(["aid", "water", "base", "summit", "caution", "instruction"]),
  cutoff: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .nullable(),
  services: z.array(z.enum(services)).max(services.length),
});
export type RoadbookCandidate = z.infer<typeof roadbookCandidateSchema>;

export type RoadbookPoint = {
  name: string;
  distanceM: number;
  kind: WaypointKind;
  cutoffMinutes: number | null;
  services: Service[];
  needsReview: boolean;
};

const kmPattern =
  /(?:\bkm\s*(\d{1,3}(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,]\d{1,2})?)\s*km\b)/i;
const clockPattern =
  /\b(?:bh|barri[eè]re|cut[- ]?off|limite)\D{0,12}(\d{1,2})\s*[h:]\s*(\d{2})\b/i;

const serviceWords: [RegExp, Service][] = [
  [/\b(eau|water|boisson)/i, "water"],
  [/\b(sucr[ée]|sweet)/i, "sweet"],
  [/\b(sal[ée]|salty|solide)/i, "salty"],
  [/\b(chaud|soupe|hot)/i, "hot"],
  [/\b(toilettes|wc)/i, "toilets"],
  [/\b(assistance|crew|suiveurs?)/i, "assistance"],
];

function number(value: string) {
  return Number(value.replace(",", "."));
}

export function roadbookLines(text: string): RoadbookCandidate[] {
  const candidates: RoadbookCandidate[] = [];
  for (const line of text
    .split(/\r?\n/)
    .map((item) => item.replace(/\s+/g, " ").trim())) {
    const kind = guessKind(line);
    const km = kmPattern.exec(line);
    if (!kind || kind === "start" || kind === "finish" || !km) continue;
    const cutoff = clockPattern.exec(line);
    const name = line
      .replace(kmPattern, "")
      .replace(clockPattern, "")
      .replace(/[|;•·]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    candidates.push({
      name: name || line.slice(0, 60),
      km: number(km[1] ?? km[2]),
      kind,
      cutoff: cutoff ? `${cutoff[1].padStart(2, "0")}:${cutoff[2]}` : null,
      services: serviceWords
        .filter(([pattern]) => pattern.test(line))
        .map(([, service]) => service),
    });
  }
  return candidates;
}

function normalizedNumbers(text: string) {
  return new Set(
    (text.replace(/(\d),(\d)/g, "$1.$2").match(/\d+(?:\.\d+)?/g) ?? []).map(
      (value) => Number(value),
    ),
  );
}

export function acceptRoadbook(
  candidates: RoadbookCandidate[],
  sourceText: string,
  courseDistanceM: number,
): RoadbookPoint[] {
  const present = normalizedNumbers(sourceText);
  const sorted = [...candidates]
    .filter((candidate) => present.has(candidate.km))
    .sort((a, b) => a.km - b.km);
  const points: RoadbookPoint[] = [];
  for (const candidate of sorted) {
    const distanceM = Math.round(candidate.km * 1000);
    const cutoffMinutes = candidate.cutoff
      ? parseClock(candidate.cutoff)
      : null;
    const duplicate = points.some(
      (point) => Math.abs(point.distanceM - distanceM) < 200,
    );
    if (duplicate) continue;
    const beyond = distanceM > courseDistanceM + 500;
    points.push({
      name: candidate.name,
      distanceM: Math.min(distanceM, courseDistanceM),
      kind: candidate.kind,
      cutoffMinutes,
      services: [...new Set(candidate.services)],
      needsReview:
        beyond || (candidate.cutoff !== null && cutoffMinutes === null),
    });
  }
  return points;
}

export function reviewAgainstGpx(
  points: RoadbookPoint[],
  gpxPoints: { name: string; distanceM: number }[],
) {
  return points.map((point) => {
    const twin = gpxPoints.find(
      (candidate) => candidate.name.toLowerCase() === point.name.toLowerCase(),
    );
    return !twin || Math.abs(twin.distanceM - point.distanceM) > 500
      ? { ...point, needsReview: true }
      : point;
  });
}

export function shapeCandidates(raw: unknown): RoadbookCandidate[] {
  const parsed = z
    .object({ points: z.array(z.unknown()).max(80) })
    .safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.points.flatMap((item) => {
    const candidate = roadbookCandidateSchema.safeParse(item);
    return candidate.success ? [candidate.data] : [];
  });
}
