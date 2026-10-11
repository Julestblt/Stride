import { describe, expect, it } from "vitest";
import {
  buildCourse,
  elevationBetween,
  nearestDistance,
  type RawPoint,
} from "@/features/races/course";
import { parseGpx } from "@/features/races/gpx";
import { walkPortions, walkSummary } from "@/features/races/grade";

const metersPerDegree = 111_195;

function line(
  lengthM: number,
  elevation: (distanceM: number) => number,
  stepM = 10,
): RawPoint[] {
  return Array.from(
    { length: Math.floor(lengthM / stepM) + 1 },
    (_, index) => ({
      lat: 48 + (index * stepM) / metersPerDegree,
      lon: 2,
      ele: elevation(index * stepM),
    }),
  );
}

describe("course building", () => {
  it("measures distance and elevation totals of a single hill", () => {
    const course = buildCourse(
      line(10_000, (d) =>
        d < 5000 ? 100 + d * 0.04 : 300 - (d - 5000) * 0.04,
      ),
    )!;
    expect(course.distanceM).toBeGreaterThan(9_950);
    expect(course.distanceM).toBeLessThan(10_050);
    expect(course.elevationGainM).toBeGreaterThan(190);
    expect(course.elevationGainM).toBeLessThan(205);
    expect(course.elevationLossM).toBeGreaterThan(190);
    expect(course.points[course.points.length - 1][0]).toBeCloseTo(
      48 + 10_000 / metersPerDegree,
      4,
    );
  });

  it("ignores GPS noise below the hysteresis on flat ground", () => {
    const course = buildCourse(line(5000, (d) => 50 + ((d / 10) % 2) * 0.8))!;
    expect(course.elevationGainM).toBeLessThan(5);
  });

  it("keeps courses without elevation and rejects tiny or invalid tracks", () => {
    const flat = buildCourse(
      line(2000, () => Number.NaN).map((point) => ({ ...point, ele: null })),
    )!;
    expect(flat.elevationGainM).toBeNull();
    expect(flat.points[0][2]).toBeNull();
    expect(buildCourse(line(50, () => 0))).toBeNull();
    expect(
      buildCourse([
        { lat: 0, lon: 0, ele: 1 },
        { lat: 0, lon: 0, ele: 1 },
      ]),
    ).toBeNull();
  });

  it("caps the stored point count on very long courses", () => {
    const course = buildCourse(line(400_000, () => 100, 50))!;
    expect(course.points.length).toBeLessThanOrEqual(12_001);
    expect(course.stepM).toBeGreaterThan(20);
  });

  it("finds the closest course distance for a coordinate and partial elevation", () => {
    const course = buildCourse(line(10_000, (d) => d * 0.01))!;
    const { distanceM, offsetM } = nearestDistance(
      course,
      48 + 4000 / metersPerDegree,
      2.0001,
    );
    expect(distanceM).toBeGreaterThan(3_960);
    expect(distanceM).toBeLessThan(4_040);
    expect(offsetM).toBeLessThan(20);
    expect(elevationBetween(course, 0, 5000).gain).toBeGreaterThan(45);
  });
});

describe("GPX parsing", () => {
  it("reads track points, waypoints, names and entities", () => {
    const parsed = parseGpx(`<?xml version="1.0"?>
      <gpx version="1.1" creator="test"><metadata><name>EcoTrail &amp; Paris</name></metadata>
      <wpt lat="48.1" lon="2.1"><name>Ravito 1 &#8211; Buc</name><desc>Eau, sucré</desc><type>Food</type></wpt>
      <wpt lat="48.2" lon="2.2"/>
      <trk><name>Trace</name><trkseg>
        <trkpt lon="2.0" lat="48.0"><ele>100.5</ele></trkpt>
        <!-- <trkpt lat="1" lon="1"/> -->
        <trkpt lat='48.001' lon='2.0'/>
        <gpxtpx:trkpt lat="48.002" lon="2.0"><ele>101</ele></gpxtpx:trkpt>
      </trkseg></trk></gpx>`);
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.name).toBe("EcoTrail & Paris");
    expect(parsed.points).toEqual([
      { lat: 48, lon: 2, ele: 100.5 },
      { lat: 48.001, lon: 2, ele: null },
      { lat: 48.002, lon: 2, ele: 101 },
    ]);
    expect(parsed.waypoints).toEqual([
      {
        lat: 48.1,
        lon: 2.1,
        name: "Ravito 1 – Buc",
        description: "Eau, sucré",
        type: "Food",
      },
    ]);
  });

  it("falls back to route points and reports unusable files", () => {
    const route = parseGpx(
      `<gpx><rte><rtept lat="1" lon="1"/><rtept lat="1.1" lon="1"/></rte></gpx>`,
    );
    expect(typeof route === "string" ? route : route.points.length).toBe(2);
    expect(parseGpx("<html></html>")).toBe("not-gpx");
    expect(
      parseGpx(
        `<gpx><trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>`,
      ),
    ).toBe("no-track");
  });
});

describe("walking portions", () => {
  const course = buildCourse(
    line(6000, (d) =>
      d >= 2000 && d < 2400 ? 100 + (d - 2000) * 0.15 : d >= 2400 ? 160 : 100,
    ),
  )!;

  it("finds steep portions above the chosen grade", () => {
    const portions = walkPortions(course, 10);
    expect(portions).toHaveLength(1);
    expect(portions[0].fromM).toBeGreaterThan(1_900);
    expect(portions[0].toM).toBeLessThan(2_500);
    expect(walkSummary(portions).distanceM).toBeGreaterThan(250);
  });

  it("returns nothing when the threshold exceeds the steepest grade", () => {
    expect(walkPortions(course, 20)).toEqual([]);
  });
});
