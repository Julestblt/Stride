import { pointDistance, positionAt } from "./course";
import { encodeFitCourse, type FitCoursePoint } from "./fit";
import { escapeXml } from "./gpx";
import { elapsedAt } from "./simulation";
import {
  serviceLabels,
  defaultWatchLabel,
  kindLabels,
  type Waypoint,
} from "./waypoints";
import type { CourseModel, RacePlanModel } from "./workspace";

const maximumRecords = 6000;

function fitPointType(waypoint: Waypoint): FitCoursePoint["type"] {
  switch (waypoint.kind) {
    case "aid":
    case "base":
      return "food";
    case "water":
      return "water";
    case "summit":
      return "summit";
    case "caution":
      return "danger";
    default:
      return "generic";
  }
}

export function watchLabels(model: CourseModel) {
  return model.waypoints.map(
    (waypoint, index) =>
      waypoint.watchLabel ?? defaultWatchLabel(waypoint, model.marks[index]),
  );
}

function alertName(distanceM: number, label: string) {
  const prefix = `${distanceM} m > `;
  return `${prefix}${label.split(" · ")[0].slice(0, 15 - prefix.length)}`;
}

export function fitCourse(
  name: string,
  model: CourseModel,
  planned: RacePlanModel | null,
  fallbackStartMs: number,
) {
  const { course } = model;
  const stride = Math.max(1, Math.ceil(course.points.length / maximumRecords));
  const indexes = course.points
    .map((_, index) => index)
    .filter(
      (index) => index % stride === 0 || index === course.points.length - 1,
    );
  const elapsed = (distanceM: number) =>
    planned
      ? elapsedAt(course, planned.simulation, distanceM)
      : (distanceM / 1000) * 600;
  const labels = watchLabels(model);
  const points: FitCoursePoint[] = model.waypoints.flatMap(
    (waypoint, index) => {
      const position = positionAt(course, waypoint.distanceM);
      const point: FitCoursePoint = {
        elapsedSeconds: elapsed(waypoint.distanceM),
        lat: position.lat,
        lon: position.lon,
        distanceM: waypoint.distanceM,
        type: fitPointType(waypoint),
        name: labels[index],
      };
      const alertAt = waypoint.distanceM - waypoint.alertDistanceM;
      if (
        waypoint.alertDistanceM === 0 ||
        alertAt <= 0 ||
        waypoint.kind === "start"
      )
        return [point];
      const alert = positionAt(course, alertAt);
      return [
        {
          elapsedSeconds: elapsed(alertAt),
          lat: alert.lat,
          lon: alert.lon,
          distanceM: alertAt,
          type: "generic" as const,
          name: alertName(waypoint.alertDistanceM, labels[index]),
        },
        point,
      ];
    },
  );
  return encodeFitCourse({
    name,
    startEpochMs: planned?.startEpochMs ?? fallbackStartMs,
    records: indexes.map((index) => {
      const distanceM = pointDistance(course, index);
      const [lat, lon, ele] = course.points[index];
      return { elapsedSeconds: elapsed(distanceM), lat, lon, ele, distanceM };
    }),
    points: points.sort((a, b) => a.distanceM - b.distanceM),
    ascentM: course.elevationGainM,
    descentM: course.elevationLossM,
  });
}

function gpxType(waypoint: Waypoint) {
  return kindLabels[waypoint.kind];
}

export function enrichedGpx(name: string, model: CourseModel) {
  const { course } = model;
  const labels = watchLabels(model);
  const waypoints = model.waypoints.map((waypoint, index) => {
    const position = positionAt(course, waypoint.distanceM);
    const description = [
      `km ${(waypoint.distanceM / 1000).toFixed(1)}`,
      waypoint.services.length
        ? waypoint.services.map((service) => serviceLabels[service]).join(", ")
        : null,
      waypoint.todo,
      waypoint.voiceNote,
    ]
      .filter(Boolean)
      .join(" · ");
    return [
      `  <wpt lat="${position.lat}" lon="${position.lon}">`,
      position.ele === null ? null : `    <ele>${position.ele}</ele>`,
      `    <name>${escapeXml(labels[index])}</name>`,
      `    <cmt>${escapeXml(waypoint.name)}</cmt>`,
      `    <desc>${escapeXml(description)}</desc>`,
      `    <type>${escapeXml(gpxType(waypoint))}</type>`,
      "  </wpt>",
    ]
      .filter(Boolean)
      .join("\n");
  });
  const track = course.points
    .map(([lat, lon, ele]) =>
      ele === null
        ? `      <trkpt lat="${lat}" lon="${lon}"/>`
        : `      <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`,
    )
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Stride" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapeXml(name)}</name></metadata>`,
    ...waypoints,
    `  <trk><name>${escapeXml(name)}</name><trkseg>`,
    track,
    "  </trkseg></trk>",
    "</gpx>",
    "",
  ].join("\n");
}

export function exportFileName(name: string, extension: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "course"}.${extension}`;
}
