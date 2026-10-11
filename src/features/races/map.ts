import { pointDistance, positionAt, type Course } from "./course";
import type { ProfileData, ProfileMarker } from "./profile";

export type MapMarker = ProfileMarker & { lat: number; lon: number };

export type MapData = {
  route: [lat: number, lon: number][];
  distances: number[];
  walk: { fromM: number; toM: number }[];
  night: { fromM: number; toM: number }[];
  rain: { fromM: number; toM: number }[];
  markers: MapMarker[];
  distanceM: number;
};

const mapPoints = 2500;

export function mapData(course: Course, profile: ProfileData): MapData {
  const stride = Math.max(1, Math.ceil(course.points.length / mapPoints));
  const indexes = course.points
    .map((_, index) => index)
    .filter(
      (index) => index % stride === 0 || index === course.points.length - 1,
    );
  return {
    route: indexes.map((index) => [
      course.points[index][0],
      course.points[index][1],
    ]),
    distances: indexes.map((index) => Math.round(pointDistance(course, index))),
    walk: profile.walk,
    night: profile.night.map(({ fromM, toM }) => ({ fromM, toM })),
    rain: profile.rain,
    markers: profile.markers.map((marker) => {
      const position = positionAt(course, marker.distanceM);
      return { ...marker, lat: position.lat, lon: position.lon };
    }),
    distanceM: course.distanceM,
  };
}

export function rangeLines(
  data: MapData,
  ranges: { fromM: number; toM: number }[],
) {
  return ranges
    .map((range) =>
      data.route
        .filter(
          (_, index) =>
            data.distances[index] >= range.fromM - 1 &&
            data.distances[index] <= range.toM + 1,
        )
        .map(([lat, lon]) => [lon, lat] as [number, number]),
    )
    .filter((line) => line.length >= 2);
}

export function nearestRouteDistance(data: MapData, lat: number, lon: number) {
  let best = 0;
  let bestScore = Infinity;
  const cosine = Math.cos((lat * Math.PI) / 180);
  data.route.forEach(([pointLat, pointLon], index) => {
    const score = (pointLat - lat) ** 2 + ((pointLon - lon) * cosine) ** 2;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return {
    distanceM: data.distances[best],
    offsetM: Math.sqrt(bestScore) * 111_195,
  };
}
