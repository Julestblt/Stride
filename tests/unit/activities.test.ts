import { describe, expect, it } from "vitest";
import {
  activityKind,
  activityPeriod,
  activityRowSchema,
  activityTitle,
  detailMetrics,
  formatActivityDate,
  formatDistance,
  formatDuration,
  formatPace,
  groupActivities,
  listMetrics,
  parseActivityFilter,
} from "../../src/features/activities/activities";
import {
  localToday,
  shellAthlete,
  shellGoal,
  syncLabel,
} from "../../src/features/app-shell/shell";

const today = "2026-10-07";

function activity(values: Record<string, unknown> = {}) {
  return activityRowSchema.parse({
    id: "4f1c2a8e-0a8b-4d39-9f43-6b1a5d0c7e21",
    activity_type: "running",
    route_name: null,
    started_at: "2026-10-06T05:12:00Z",
    local_started_at: "2026-10-06 07:12:00",
    distance_meters: 8320,
    duration_seconds: 3014,
    elevation_gain_meters: 42,
    average_heart_rate: 141.6,
    ...values,
  });
}

describe("activity rows", () => {
  it("uses the athlete-local day and treats missing or zero measures as absent", () => {
    const row = activity({
      local_started_at: null,
      started_at: "2026-10-05T23:30:00Z",
      distance_meters: "0",
      duration_seconds: null,
      elevation_gain_meters: "abc",
    });
    expect(row.date).toBe("2026-10-05");
    expect(row.distanceMeters).toBeNull();
    expect(row.durationSeconds).toBeNull();
    expect(row.elevationGainMeters).toBeNull();
    expect(activity({ distance_meters: "21400.5" }).distanceMeters).toBe(
      21400.5,
    );
  });

  it("parses filters from the URL and falls back to all", () => {
    expect(parseActivityFilter("trail")).toBe("trail");
    expect(parseActivityFilter("road")).toBe("road");
    expect(parseActivityFilter(["trail"])).toBe("all");
    expect(parseActivityFilter("races")).toBe("all");
    expect(parseActivityFilter(undefined)).toBe("all");
  });

  it("classifies road, trail and other sessions", () => {
    expect(activityKind("treadmill_running")).toBe("road");
    expect(activityKind("ultra_run")).toBe("trail");
    expect(activityKind("strength_training")).toBe("other");
    expect(activityKind(null)).toBe("other");
  });

  it("titles activities from their type and route", () => {
    expect(activityTitle(activity())).toBe("Course à pied");
    expect(
      activityTitle(
        activity({
          activity_type: "trail_running",
          route_name: " Fontainebleau ",
        }),
      ),
    ).toBe("Trail · Fontainebleau");
    expect(activityTitle(activity({ activity_type: "paragliding" }))).toBe(
      "Activité",
    );
  });
});

describe("activity metrics", () => {
  it("formats distance, duration and pace in French conventions", () => {
    expect(formatDistance(8320)).toBe("8,32");
    expect(formatDistance(21_400)).toBe("21,4");
    expect(formatDistance(62_000)).toBe("62,0");
    expect(formatDuration(3520)).toBe("58:40");
    expect(formatDuration(7512)).toBe("2:05:12");
    expect(formatPace(8320, 3014)).toBe("6:02");
  });

  it("adapts the list metrics to road, trail and non-distance sessions", () => {
    expect(listMetrics(activity()).map((metric) => metric.key)).toEqual([
      "distance",
      "pace",
    ]);
    expect(
      listMetrics(
        activity({
          activity_type: "trail_running",
          distance_meters: 21_400,
          elevation_gain_meters: 540,
          duration_seconds: 7500,
        }),
      ).map((metric) => `${metric.value}${metric.unit ?? ""}`),
    ).toEqual(["21,4km", "540m", "2:05:00"]);
    expect(
      listMetrics(
        activity({
          activity_type: "strength_training",
          distance_meters: null,
          elevation_gain_meters: null,
        }),
      ).map((metric) => metric.key),
    ).toEqual(["duration"]);
  });

  it("never shows a pace without distance or for non-running sessions", () => {
    expect(
      listMetrics(activity({ distance_meters: null })).map(
        (metric) => metric.key,
      ),
    ).toEqual(["duration"]);
    expect(
      detailMetrics(activity({ activity_type: "cycling" })).map(
        (metric) => metric.key,
      ),
    ).toEqual(["distance", "duration", "elevation", "heartRate"]);
  });

  it("lists every available headline measure on the detail", () => {
    expect(
      detailMetrics(activity()).map((metric) => [
        metric.label,
        metric.value,
        metric.unit,
      ]),
    ).toEqual([
      ["Distance", "8,32", "km"],
      ["Temps", "50:14", undefined],
      ["Allure", "6:02", "/km"],
      ["D+", "42", "m"],
      ["FC moy.", "142", "bpm"],
    ]);
  });
});

describe("activity periods", () => {
  it("formats short French dates and adds the year outside the current one", () => {
    expect(formatActivityDate("2026-10-06", today)).toBe("mar. 6 oct.");
    expect(formatActivityDate("2025-09-13", today)).toBe("sam. 13 sept. 2025");
  });

  it("groups by Monday-based weeks, then by month", () => {
    expect(activityPeriod("2026-10-05", today)).toBe("Cette semaine");
    expect(activityPeriod("2026-10-04", today)).toBe("Semaine dernière");
    expect(activityPeriod("2026-09-28", today)).toBe("Semaine dernière");
    expect(activityPeriod("2026-09-27", today)).toBe("Septembre");
    expect(activityPeriod("2025-12-31", today)).toBe("Décembre 2025");
  });

  it("keeps the newest-first order and merges consecutive periods", () => {
    const groups = groupActivities(
      [
        activity({ id: "a", local_started_at: "2026-10-06 07:00:00" }),
        activity({ id: "b", local_started_at: "2026-10-04 08:00:00" }),
        activity({ id: "c", local_started_at: "2026-10-01 18:00:00" }),
        activity({ id: "d", local_started_at: "2026-09-13 06:00:00" }),
        activity({ id: "e", local_started_at: "2026-09-02 06:00:00" }),
      ],
      today,
    );
    expect(
      groups.map((group) => [
        group.label,
        group.activities.map((item) => item.id),
      ]),
    ).toEqual([
      ["Cette semaine", ["a"]],
      ["Semaine dernière", ["b", "c"]],
      ["Septembre", ["d", "e"]],
    ]);
  });
});

describe("application shell", () => {
  it("leads with the next priority race and counts the days to it", () => {
    expect(
      shellGoal(
        [
          { name: "10K tune-up", priority: "B", raceDate: "2026-11-01" },
          { name: "Old race", priority: "A", raceDate: "2026-03-01" },
          {
            name: "EcoTrail Paris 120K",
            priority: "A",
            raceDate: "2027-03-20",
          },
          { name: "Undated", priority: "A", raceDate: null },
        ],
        "trail",
        today,
      ),
    ).toEqual({ name: "EcoTrail Paris 120K", detail: "Course A · J-164" });
  });

  it("falls back to the goal focus, then to nothing", () => {
    expect(shellGoal([], "ultra_trail", today)).toEqual({
      name: "Ultra-trail",
      detail: "Objectif",
    });
    expect(shellGoal([], null, today)).toBeNull();
  });

  it("names the athlete from the profile, then the email", () => {
    expect(shellAthlete("jules", "jules@example.com")).toEqual({
      name: "jules",
      initials: "J",
      detail: "jules@example.com",
    });
    expect(shellAthlete(null, "runner@example.com").name).toBe("runner");
  });

  it("shows sync freshness in Paris time with a French date when older", () => {
    const now = new Date("2026-10-10T10:00:00Z");
    expect(syncLabel("2026-10-10T04:12:00Z", now)).toBe("Synchronisé 06:12");
    expect(syncLabel("2026-10-08T21:30:00Z", now)).toBe(
      "Synchronisé le 08/10/2026",
    );
    expect(syncLabel(null, now)).toBeNull();
    expect(syncLabel("not a date", now)).toBeNull();
    expect(localToday(new Date("2026-10-09T22:30:00Z"))).toBe("2026-10-10");
  });
});
