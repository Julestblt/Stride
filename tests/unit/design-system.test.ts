import { describe, expect, it } from "vitest";
import { summarizeSession } from "../../src/components/stride/session-blocks";
import { describeProgress } from "../../src/components/stride/steps";

describe("session shape summary", () => {
  it("describes kept volume, peak zone and removed work", () => {
    expect(
      summarizeSession([
        { minutes: 15, zone: 2 },
        { minutes: 6, zone: 4 },
        { minutes: 2, zone: 1 },
        { minutes: 6, zone: 4 },
        { minutes: 8, zone: 5, removed: true },
        { minutes: 10, zone: 2 },
      ]),
    ).toBe(
      "Session shape: 39 minutes, peaking in zone 4, 1 block removed (8 minutes)",
    );
  });

  it("ignores negative durations and handles an empty session", () => {
    expect(summarizeSession([{ minutes: -5, zone: 3 }])).toBe(
      "Session shape: 0 minutes, peaking in zone 3",
    );
    expect(summarizeSession([])).toBe("Session shape: 0 minutes");
  });
});

describe("onboarding progress", () => {
  it("reports the current step even when an earlier step runs in the background", () => {
    expect(
      describeProgress([
        "done",
        "done",
        "background",
        "current",
        "upcoming",
        "upcoming",
      ]),
    ).toEqual({ position: 4, total: 6, label: "Step 4 of 6" });
  });

  it("falls back to the step after the completed ones", () => {
    expect(describeProgress(["done", "upcoming", "upcoming"]).label).toBe(
      "Step 2 of 3",
    );
    expect(describeProgress(["done", "done"]).label).toBe("Step 2 of 2");
  });
});
