import { describe, expect, it } from "vitest";
import { buildCourse } from "@/features/races/course";
import {
  enrichedGpx,
  exportFileName,
  fitCourse,
} from "@/features/races/export";
import { encodeFitCourse, fitCrc, semicircles } from "@/features/races/fit";
import { parseGpx } from "@/features/races/gpx";
import { defaultPlan } from "@/features/races/race";
import { courseModel } from "@/features/races/workspace";
import type { Waypoint } from "@/features/races/waypoints";

type Decoded = { global: number; fields: Map<number, number | string> };

function decodeFit(file: Uint8Array) {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const headerSize = view.getUint8(0);
  const dataSize = view.getUint32(4, true);
  const definitions = new Map<
    number,
    { global: number; fields: [number, number, number][] }
  >();
  const messages: Decoded[] = [];
  let offset = headerSize;
  while (offset < headerSize + dataSize) {
    const header = view.getUint8(offset);
    offset += 1;
    const local = header & 0x0f;
    if (header & 0x40) {
      const global = view.getUint16(offset + 2, true);
      const count = view.getUint8(offset + 4);
      const fields: [number, number, number][] = [];
      for (let index = 0; index < count; index += 1)
        fields.push([
          view.getUint8(offset + 5 + index * 3),
          view.getUint8(offset + 6 + index * 3),
          view.getUint8(offset + 7 + index * 3),
        ]);
      definitions.set(local, { global, fields });
      offset += 5 + count * 3;
      continue;
    }
    const definition = definitions.get(local)!;
    const fields = new Map<number, number | string>();
    for (const [number, size, type] of definition.fields) {
      if (type === 0x07)
        fields.set(
          number,
          new TextDecoder()
            .decode(file.subarray(offset, offset + size))
            .replace(/\0.*$/, ""),
        );
      else if (size === 1) fields.set(number, view.getUint8(offset));
      else if (size === 2) fields.set(number, view.getUint16(offset, true));
      else
        fields.set(
          number,
          type === 0x85
            ? view.getInt32(offset, true)
            : view.getUint32(offset, true),
        );
      offset += size;
    }
    messages.push({ global: definition.global, fields });
  }
  return messages;
}

const course = buildCourse(
  Array.from({ length: 501 }, (_, index) => ({
    lat: 48 + index * 0.0001,
    lon: 2,
    ele: 100 + index * 0.1,
  })),
)!;

function waypoint(
  id: string,
  kind: Waypoint["kind"],
  distanceM: number,
  name: string,
): Waypoint {
  return {
    id,
    kind,
    name,
    distanceM,
    cutoffMinutes: kind === "aid" ? 13 * 60 + 30 : null,
    services: kind === "aid" ? ["water", "salty"] : [],
    watchLabel: null,
    alertDistanceM: kind === "aid" ? 500 : 0,
    voiceNote: kind === "aid" ? "Remplis les flasques" : null,
    todo: null,
    nutritionNote: null,
    source: "athlete",
    needsReview: false,
    revision: 1,
  };
}

const model = courseModel(
  {
    source: "gpx",
    fileName: "test.gpx",
    sourceActivityId: null,
    timeZone: "Europe/Paris",
    distanceM: course.distanceM,
    elevationGainM: course.elevationGainM,
    elevationLossM: course.elevationLossM,
    stepM: course.stepM,
    points: course.points,
    importedAt: "2026-10-11T10:00:00Z",
  },
  [waypoint("r1", "aid", 3000, "Ravito 1 & Buc")],
  defaultPlan,
);

describe("FIT course export", () => {
  it("writes a valid header and file CRC", () => {
    const file = encodeFitCourse({
      name: "Test",
      startEpochMs: Date.UTC(2027, 2, 20, 5),
      records: [
        { elapsedSeconds: 0, lat: 48, lon: 2, ele: 100, distanceM: 0 },
        { elapsedSeconds: 60, lat: 48.001, lon: 2, ele: null, distanceM: 111 },
      ],
      points: [],
      ascentM: 10,
      descentM: null,
    });
    expect(new TextDecoder().decode(file.subarray(8, 12))).toBe(".FIT");
    expect(fitCrc(file.subarray(0, 14))).toBe(0);
    expect(fitCrc(file)).toBe(0);
    expect(file.length).toBe(
      14 + new DataView(file.buffer).getUint32(4, true) + 2,
    );
  });

  it("contains the course, records and course points with alerts", () => {
    const messages = decodeFit(
      fitCourse("EcoTrail Paris 120K", model, null, Date.UTC(2027, 2, 20, 5)),
    );
    expect(messages[0].global).toBe(0);
    expect(messages[0].fields.get(0)).toBe(6);
    expect(
      messages.find((message) => message.global === 31)?.fields.get(5),
    ).toBe("EcoTrail Paris 120K");
    const records = messages.filter((message) => message.global === 20);
    expect(records.length).toBe(course.points.length);
    expect(records[0].fields.get(0)).toBe(semicircles(48));
    const points = messages.filter((message) => message.global === 32);
    expect(points.map((point) => point.fields.get(6))).toEqual([
      "Départ",
      "500 m > R1",
      "R1 · BH 13H30",
      "Arrivée",
    ]);
    expect(points[2].fields.get(5)).toBe(4);
  });
});

describe("enriched GPX export", () => {
  it("round-trips the track and describes waypoints", () => {
    const xml = enrichedGpx("EcoTrail <120K>", model);
    const parsed = parseGpx(xml);
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.name).toBe("EcoTrail <120K>");
    expect(parsed.points).toHaveLength(course.points.length);
    expect(parsed.waypoints.map((item) => item.name)).toEqual([
      "Départ",
      "R1 · BH 13H30",
      "Arrivée",
    ]);
    expect(parsed.waypoints[1].description).toBe(
      "km 3.0 · Eau, Salé · Remplis les flasques",
    );
  });

  it("builds safe file names", () => {
    expect(exportFileName("EcoTrail Paris 120K", "fit")).toBe(
      "ecotrail-paris-120k.fit",
    );
    expect(exportFileName("Été / Nuit", "gpx")).toBe("ete-nuit.gpx");
  });
});
