export type RawPoint = { lat: number; lon: number; ele: number | null };
export type CoursePoint = readonly [
  lat: number,
  lon: number,
  ele: number | null,
];

export type Course = {
  stepM: number;
  distanceM: number;
  points: CoursePoint[];
  elevationGainM: number | null;
  elevationLossM: number | null;
};

const earthRadiusM = 6_371_008.8;
const maximumPoints = 12_000;
const minimumStepM = 20;
const smoothingRadiusM = 60;
const elevationHysteresisM = 2;

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversine(a: RawPoint, b: RawPoint) {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function validPoint(point: RawPoint) {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lon) <= 180 &&
    !(point.lat === 0 && point.lon === 0)
  );
}

export function cumulativeDistances(points: RawPoint[]) {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1)
    distances.push(
      distances[index - 1] + haversine(points[index - 1], points[index]),
    );
  return distances;
}

function interpolate(a: number, b: number, ratio: number) {
  return a + (b - a) * ratio;
}

function fillElevation(points: RawPoint[]) {
  const known = points.flatMap((point, index) =>
    point.ele === null || !Number.isFinite(point.ele) ? [] : [index],
  );
  if (known.length === 0) return null;
  const values = points.map((point) => point.ele);
  let previous = -1;
  for (const index of known) {
    if (previous === -1)
      for (let fill = 0; fill < index; fill += 1) values[fill] = values[index];
    else
      for (let fill = previous + 1; fill < index; fill += 1)
        values[fill] = interpolate(
          values[previous]!,
          values[index]!,
          (fill - previous) / (index - previous),
        );
    previous = index;
  }
  for (let fill = previous + 1; fill < values.length; fill += 1)
    values[fill] = values[previous];
  return values as number[];
}

export function smoothElevation(values: (number | null)[], stepM: number) {
  if (values.some((value) => value === null)) return values;
  const radius = Math.max(1, Math.round(smoothingRadiusM / stepM));
  const prefix = [0];
  for (const value of values) prefix.push(prefix[prefix.length - 1] + value!);
  return values.map((_, index) => {
    const from = Math.max(0, index - radius);
    const to = Math.min(values.length - 1, index + radius);
    return (prefix[to + 1] - prefix[from]) / (to - from + 1);
  });
}

export function elevationTotals(values: (number | null)[]) {
  if (values.length === 0 || values.some((value) => value === null))
    return { gain: null, loss: null };
  let gain = 0;
  let loss = 0;
  let anchor = values[0]!;
  for (const value of values as number[]) {
    const delta = value - anchor;
    if (delta >= elevationHysteresisM) {
      gain += delta;
      anchor = value;
    } else if (delta <= -elevationHysteresisM) {
      loss -= delta;
      anchor = value;
    }
  }
  return { gain: Math.round(gain), loss: Math.round(loss) };
}

export function buildCourse(raw: RawPoint[]): Course | null {
  const points = raw.filter(validPoint).filter((point, index, all) => {
    if (index === 0) return true;
    const previous = all[index - 1];
    return previous.lat !== point.lat || previous.lon !== point.lon;
  });
  if (points.length < 2) return null;
  const distances = cumulativeDistances(points);
  const total = distances[distances.length - 1];
  if (total < 100) return null;
  const stepM = Math.max(minimumStepM, Math.ceil(total / (maximumPoints - 1)));
  const elevation = fillElevation(points);
  const count = Math.floor(total / stepM) + 1;
  const samples: RawPoint[] = [];
  let cursor = 0;
  for (let sample = 0; sample < count; sample += 1) {
    const target = sample * stepM;
    while (cursor < distances.length - 2 && distances[cursor + 1] < target)
      cursor += 1;
    const span = distances[cursor + 1] - distances[cursor];
    const ratio = span > 0 ? (target - distances[cursor]) / span : 0;
    samples.push({
      lat: interpolate(points[cursor].lat, points[cursor + 1].lat, ratio),
      lon: interpolate(points[cursor].lon, points[cursor + 1].lon, ratio),
      ele: elevation
        ? interpolate(elevation[cursor], elevation[cursor + 1], ratio)
        : null,
    });
  }
  if (count * stepM - stepM < total - 1) {
    const last = points[points.length - 1];
    samples.push({
      ...last,
      ele: elevation ? elevation[elevation.length - 1] : null,
    });
  }
  const smoothed = smoothElevation(
    samples.map((point) => point.ele),
    stepM,
  );
  const totals = elevationTotals(smoothed);
  return {
    stepM,
    distanceM: Math.round(total * 10) / 10,
    points: samples.map((point, index) => [
      Math.round(point.lat * 1e6) / 1e6,
      Math.round(point.lon * 1e6) / 1e6,
      smoothed[index] === null ? null : Math.round(smoothed[index]! * 10) / 10,
    ]),
    elevationGainM: totals.gain,
    elevationLossM: totals.loss,
  };
}

export function pointDistance(course: Course, index: number) {
  return index === course.points.length - 1
    ? course.distanceM
    : Math.min(course.distanceM, index * course.stepM);
}

export function indexAt(course: Course, distanceM: number) {
  const clamped = Math.max(0, Math.min(course.distanceM, distanceM));
  return Math.min(course.points.length - 1, Math.round(clamped / course.stepM));
}

export function positionAt(course: Course, distanceM: number) {
  const [lat, lon, ele] = course.points[indexAt(course, distanceM)];
  return { lat, lon, ele };
}

export function nearestDistance(course: Course, lat: number, lon: number) {
  let best = 0;
  let bestDistance = Infinity;
  course.points.forEach((point, index) => {
    const distance = haversine(
      { lat, lon, ele: null },
      { lat: point[0], lon: point[1], ele: null },
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return { distanceM: pointDistance(course, best), offsetM: bestDistance };
}

export function elevationBetween(course: Course, fromM: number, toM: number) {
  const from = indexAt(course, fromM);
  const to = indexAt(course, toM);
  const values = course.points.slice(from, to + 1).map((point) => point[2]);
  return elevationTotals(values);
}

export function courseBounds(course: Course) {
  const latitudes = course.points.map((point) => point[0]);
  const longitudes = course.points.map((point) => point[1]);
  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLon: Math.min(...longitudes),
    maxLon: Math.max(...longitudes),
  };
}
