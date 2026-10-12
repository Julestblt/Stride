import { describe, expect, it } from "vitest";
import type { WellnessDay } from "@/features/garmin/wellness";
import { healthModel } from "@/features/progress/health";
import {
  dayWindow,
  episodes,
  formatClock,
  healthDayModel,
  parseHealthDate,
  stressLevel,
  zonedEpoch,
} from "@/features/progress/health-day";
import { healthDayView } from "@/features/progress/health-day-view";
import { wellnessDaySchema } from "@/server/garmin/contract";
import { wellnessDay } from "../fixtures/garmin-service.mjs";

const day = "2026-10-12";

function fixtureDay(date = day): WellnessDay {
  return wellnessDaySchema.parse(wellnessDay(date));
}

describe("health day time", () => {
  it("anchors the window on Paris time across daylight saving changes", () => {
    expect(new Date(zonedEpoch("2026-10-12", 0)).toISOString()).toBe(
      "2026-10-11T22:00:00.000Z",
    );
    expect(new Date(zonedEpoch("2026-12-01", 0)).toISOString()).toBe(
      "2026-11-30T23:00:00.000Z",
    );
    const { start, end } = dayWindow("2026-10-25");
    expect(new Date(start).toISOString()).toBe("2026-10-24T20:00:00.000Z");
    expect(new Date(end).toISOString()).toBe("2026-10-25T21:00:00.000Z");
    expect(formatClock(start)).toBe("22:00");
  });

  it("accepts only past days within two years", () => {
    expect(parseHealthDate("2026-10-10", day)).toBe("2026-10-10");
    expect(parseHealthDate("2026-10-13", day)).toBe(day);
    expect(parseHealthDate("2023-01-01", day)).toBe(day);
    expect(parseHealthDate("hier", day)).toBe(day);
  });

  it("maps Garmin stress categories", () => {
    expect(stressLevel(25)).toBe("rest");
    expect(stressLevel(50)).toBe("low");
    expect(stressLevel(51)).toBe("high");
  });
});

describe("stress episodes", () => {
  const minute = 60_000;
  const series = (values: (number | null)[]): [number, number | null][] =>
    values.map((value, index) => [index * 3 * minute, value]);

  it("keeps sustained episodes and ignores short spikes", () => {
    const found = episodes(
      series([20, 60, 70, 20, ...Array(12).fill(65), 30]),
      (value) => value > 50,
      30,
      () => false,
    );
    expect(found).toHaveLength(1);
    expect(found[0].start).toBe(4 * 3 * minute);
    expect(found[0].end - found[0].start).toBe(36 * minute);
    expect(found[0].average).toBe(65);
  });

  it("does not break an episode on a missing sample", () => {
    const found = episodes(
      series([...Array(6).fill(70), null, ...Array(6).fill(70)]),
      (value) => value > 50,
      30,
      () => false,
    );
    expect(found).toHaveLength(1);
  });
});

describe("health day model", () => {
  const now = zonedEpoch(day, 14 * 60 + 30);

  it("builds slots, moments and a reading from Garmin curves", () => {
    const model = healthDayModel({
      day,
      current: fixtureDay(),
      previous: fixtureDay("2026-10-11"),
      activities: [
        {
          startedAt: zonedEpoch(day, 8 * 60 + 5),
          name: "Course à pied",
          durationSeconds: 2100,
        },
      ],
      now,
    });
    expect(model.now).toBe(now);
    expect(model.slots.at(-1)!.start).toBeLessThan(now);
    expect(model.heartRate.every(([at]) => at < now)).toBe(true);
    expect(model.stressPeak).toMatchObject({ average: 66 });
    expect(formatClock(model.stressPeak!.start)).toBe("10:30");
    const titles = model.moments.map((moment) => moment.title);
    expect(titles[0]).toBe("Coucher");
    expect(titles).toContain("Lever · Body Battery 61");
    expect(titles).toContain("Course à pied · 35 min");
    expect(titles).toContain("Stress élevé · 1h15");
    const view = healthDayView(
      model,
      healthModel({ days: [], view: "week", today: day }),
      "Nuit du 11 au 12",
    );
    expect(view.kpis.find((kpi) => kpi.key === "sleep")).toMatchObject({
      value: "5h52",
      detail: "23:40 → 05:46 · 1 éveil",
    });
    expect(view.kpis.find((kpi) => kpi.key === "steps")?.detail).toBe(
      "Objectif 8\u202f000 · 76 %",
    );
    expect(view.headline).toBe(
      "Bonne nuit, mais un pic de stress dans la journée.",
    );
    expect(view.paragraph).toContain("entre 10:30 et 11:45");
    expect(view.night?.note).toContain("41 %");
  });

  it("keeps a past day whole", () => {
    const model = healthDayModel({
      day: "2026-10-10",
      current: fixtureDay("2026-10-10"),
      previous: null,
      activities: [],
      now,
    });
    expect(model.now).toBeNull();
    expect(model.slots).toHaveLength(144);
  });

  it("rejects malformed Garmin payloads", () => {
    expect(wellnessDaySchema.safeParse({ date: day }).success).toBe(false);
    const parsed = wellnessDaySchema.parse({
      ...wellnessDay(day),
      heart_rate: "invalid",
      sleep: { start: "x" },
    });
    expect(parsed.heartRate).toEqual([]);
    expect(parsed.sleep).toBeNull();
  });
});
