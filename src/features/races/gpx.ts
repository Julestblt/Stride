import type { RawPoint } from "./course";

export type GpxWaypoint = {
  lat: number;
  lon: number;
  name: string;
  description: string | null;
  type: string | null;
};

export type ParsedGpx = {
  name: string | null;
  points: RawPoint[];
  waypoints: GpxWaypoint[];
};

export type GpxError = "not-gpx" | "no-track";

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X"))
        return String.fromCodePoint(parseInt(entity.slice(2), 16));
      if (entity.startsWith("#"))
        return String.fromCodePoint(Number(entity.slice(1)));
      return entities[entity.toLowerCase()] ?? match;
    })
    .trim();
}

function attribute(attributes: string, name: string) {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(
    attributes,
  );
  return match ? Number(match[1]) : Number.NaN;
}

function child(body: string, name: string) {
  const match = new RegExp(
    `<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`,
    "i",
  ).exec(body);
  return match ? decodeXml(match[1]) : null;
}

function pointsOf(xml: string, tag: string) {
  const pattern = new RegExp(
    `<(?:[\\w-]+:)?${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>)`,
    "gi",
  );
  const points: RawPoint[] = [];
  for (const match of xml.matchAll(pattern)) {
    const body = match[2] ?? "";
    const elevation = child(body, "ele");
    const ele = elevation === null ? null : Number(elevation.replace(",", "."));
    points.push({
      lat: attribute(match[1], "lat"),
      lon: attribute(match[1], "lon"),
      ele: ele !== null && Number.isFinite(ele) ? ele : null,
    });
  }
  return points;
}

export function parseGpx(xml: string): ParsedGpx | GpxError {
  if (!/<(?:[\w-]+:)?gpx\b/i.test(xml)) return "not-gpx";
  const withoutComments = xml.replace(/<!--[\s\S]*?-->/g, "");
  const track = pointsOf(withoutComments, "trkpt");
  const points = track.length >= 2 ? track : pointsOf(withoutComments, "rtept");
  if (points.length < 2) return "no-track";
  const waypointPattern =
    /<(?:[\w-]+:)?wpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w-]+:)?wpt>)/gi;
  const waypoints: GpxWaypoint[] = [];
  for (const match of withoutComments.matchAll(waypointPattern)) {
    const body = match[2] ?? "";
    const name = child(body, "name");
    const lat = attribute(match[1], "lat");
    const lon = attribute(match[1], "lon");
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    waypoints.push({
      lat,
      lon,
      name: name.slice(0, 60),
      description: child(body, "desc") ?? child(body, "cmt"),
      type: child(body, "type") ?? child(body, "sym"),
    });
  }
  const metadata =
    /<(?:[\w-]+:)?metadata\b[\s\S]*?<\/(?:[\w-]+:)?metadata>/i.exec(
      withoutComments,
    );
  const trackBlock = /<(?:[\w-]+:)?(?:trk|rte)\b[\s\S]*?>/i.exec(
    withoutComments,
  );
  const trackName = trackBlock
    ? child(withoutComments.slice(trackBlock.index), "name")
    : null;
  return {
    name: (metadata ? child(metadata[0], "name") : null) ?? trackName,
    points,
    waypoints,
  };
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
