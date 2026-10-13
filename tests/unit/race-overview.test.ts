import { describe, expect, it } from "vitest";
import {
  countdownLabel,
  parseRacesView,
  preparationProgress,
  preparationRows,
  seasonTimeline,
  splitRaces,
} from "@/features/races/overview";
import { defaultPlan, type RaceSummary } from "@/features/races/race";

function race(overrides: Partial<RaceSummary>): RaceSummary {
  return {
    id: "race",
    name: "Course",
    kind: "trail",
    date: "2027-03-20",
    distanceKm: 120,
    elevationGainM: 1600,
    priority: "A",
    targetSeconds: 66_600,
    revision: 1,
    ...overrides,
  };
}

const today = "2026-10-13";

describe("races overview", () => {
  it("falls back to the upcoming view for unknown values", () => {
    expect(parseRacesView("past")).toBe("past");
    expect(parseRacesView(["all", "past"])).toBe("all");
    expect(parseRacesView("nope")).toBe("upcoming");
    expect(parseRacesView(undefined)).toBe("upcoming");
  });

  it("splits races and picks the featured one by priority then date", () => {
    const split = splitRaces(
      [
        race({ id: "c", priority: "C", date: "2026-11-22" }),
        race({ id: "a", priority: "A", date: "2027-03-20" }),
        race({ id: "old", priority: "A", date: "2026-09-27" }),
        race({ id: "older", priority: "B", date: "2026-03-21" }),
        race({ id: "undated", priority: "B", date: null }),
      ],
      today,
    );
    expect(split.featured?.id).toBe("a");
    expect(split.upcoming.map((item) => item.id)).toEqual([
      "c",
      "a",
      "undated",
    ]);
    expect(split.calendar.map((item) => item.id)).toEqual(["c", "undated"]);
    expect(split.past.map((item) => item.id)).toEqual(["old", "older"]);
  });

  it("keeps a race happening today upcoming", () => {
    const split = splitRaces([race({ date: today })], today);
    expect(split.upcoming).toHaveLength(1);
    expect(countdownLabel(today, today)).toBe("Jour J");
    expect(countdownLabel("2026-11-28", today)).toBe("J-46");
    expect(countdownLabel("2026-09-01", today)).toBeNull();
  });

  it("scores preparation from persisted facts only", () => {
    const rows = preparationRows({
      race: race({ id: "r1" }),
      plan: { ...defaultPlan, startConfirmed: true },
      course: null,
      waypoints: [],
      checklist: [],
    });
    expect(rows.map((row) => [row.key, row.state])).toEqual([
      ["course", "todo"],
      ["waypoints", "todo"],
      ["target", "done"],
      ["start", "done"],
      ["gear", "todo"],
      ["watch", "todo"],
    ]);
    const progress = preparationProgress(rows);
    expect(progress).toMatchObject({ done: 2, total: 6 });
    expect(progress.next).toContain("GPX");
    expect(progress.nextHref).toBe("/races/r1/course");
  });

  it("skips trail-only steps for road races", () => {
    const rows = preparationRows({
      race: race({ kind: "road" }),
      plan: defaultPlan,
      course: null,
      waypoints: [],
      checklist: [],
    });
    expect(rows.map((row) => row.key)).toEqual(["course", "target", "start"]);
  });

  it("cycles indicative phases toward each A race", () => {
    const timeline = seasonTimeline(
      [
        race({ id: "a1", date: "2027-03-20" }),
        race({ id: "c", priority: "C", date: "2026-11-22" }),
        race({ id: "a2", date: "2027-07-08" }),
      ],
      today,
    )!;
    expect(timeline.phases.map((phase) => phase.key)).toEqual([
      "a1-0",
      "a1-1",
      "a1-2",
      "a1-3",
      "a2-1",
      "a2-2",
      "a2-3",
    ]);
    expect(timeline.phases[0].left).toBe(0);
    const a1 = timeline.markers.find((marker) => marker.id === "a1")!;
    const taper = timeline.phases[3];
    expect(taper.left + taper.width).toBeCloseTo(a1.left, 5);
    expect(timeline.phases[4].left).toBeCloseTo(a1.left, 5);
    expect(timeline.months[0].key).toBe("2026-11");
  });

  it("stacks close race labels on separate lanes", () => {
    const timeline = seasonTimeline(
      [
        race({ id: "one", name: "Ecotrail Paris Automne", date: "2026-10-17" }),
        race({ id: "two", name: "10km Tour Eiffel", date: "2026-12-06" }),
        race({ id: "three", name: "UTMB PDA", date: "2027-07-08" }),
      ],
      today,
    )!;
    const lanes = Object.fromEntries(
      timeline.markers.map((marker) => [marker.id, marker]),
    );
    expect(lanes.one.align).toBe("start");
    expect(lanes.three.align).toBe("end");
    expect(lanes.two.lane).not.toBe(lanes.one.lane);
    expect(timeline.lanes).toBe(2);
  });

  it("returns no timeline without a dated upcoming race", () => {
    expect(seasonTimeline([race({ date: null })], today)).toBeNull();
    expect(seasonTimeline([], today)).toBeNull();
  });
});
