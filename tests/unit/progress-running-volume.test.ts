import { describe, expect, it } from "vitest";
import type { ProgressActivity } from "@/features/progress/history";
import { runningVolume } from "@/features/progress/running-volume";

const today = "2026-10-14";

function run(
  id: string,
  day: string,
  distance: number,
  type = "running",
): ProgressActivity {
  return { id, day, type, name: null, distance, duration: 3600, gain: 0 };
}

describe("running volume", () => {
  it("sums running km per Monday week against the plan", () => {
    const volume = runningVolume(
      [
        run("a", "2026-10-12", 12_000),
        run("b", "2026-10-13", 8_000, "trail_running"),
        run("bike", "2026-10-13", 40_000, "cycling"),
        run("c", "2026-10-06", 30_000),
        run("d", "2026-09-29", 20_000),
        run("future", "2026-10-15", 10_000),
      ],
      [
        { weekStart: "2026-10-12", meters: 50_000, estimated: false },
        { weekStart: "2026-10-05", meters: 30_000, estimated: true },
        { weekStart: "2026-09-28", meters: 25_000, estimated: false },
      ],
      today,
    );
    expect(volume.weeks).toHaveLength(12);
    expect(volume.weeks.at(-1)).toEqual({
      start: "2026-10-12",
      doneMeters: 20_000,
      plannedMeters: 50_000,
      plannedEstimated: false,
      current: true,
    });
    expect(volume.weeks.at(-2)?.doneMeters).toBe(30_000);
    expect(volume.plannedShare).toBeCloseTo(50 / 55);
    expect(volume.summary).toBe(
      "Cette semaine : 20 km sur 50 prévus. Moyenne 11 sem. : 5 km, 91 % du prévu.",
    );
  });

  it("shows done km only without a plan", () => {
    const volume = runningVolume([run("a", today, 5_000)], null, today);
    expect(volume.plannedShare).toBeNull();
    expect(volume.weeks.every((week) => week.plannedMeters === null)).toBe(
      true,
    );
    expect(volume.summary).toBe(
      "Cette semaine : 5 km. Moyenne 11 sem. : 0 km.",
    );
  });
});
