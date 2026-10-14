import { describe, expect, it } from "vitest";
import { planAdherence } from "@/features/plans/matching/adherence";
import {
  matchingAlgorithmVersion,
  matchSessions,
  type MatchActivity,
} from "@/features/plans/matching/matching";
import type { PlanSession, SessionContent } from "@/features/plans/model/plan";
import { easyRun } from "./plan-fixture";

const today = "2026-10-15";

function session(
  sessionKey: string,
  scheduledOn: string,
  content: Partial<SessionContent> = {},
): PlanSession {
  return { ...easyRun(40), ...content, sessionKey, scheduledOn };
}

function activity(
  id: string,
  startedAt: string,
  values: Partial<MatchActivity> = {},
): MatchActivity {
  return {
    id,
    type: "running",
    startedAt,
    durationSeconds: 2400,
    distanceMeters: 8000,
    averageHeartRate: null,
    ...values,
  };
}

const heartRateRun = session("hr", "2026-10-13", {
  targets: {
    durationSeconds: 2400,
    distanceMeters: null,
    elevationGainMeters: null,
  },
  structure: [
    {
      type: "work",
      end: { kind: "time", seconds: 1200 },
      target: { kind: "heart_rate_range", minBpm: 130, maxBpm: 140 },
      intensity: "easy",
    },
    {
      type: "work",
      end: { kind: "time", seconds: 1200 },
      target: { kind: "heart_rate_range", minBpm: 150, maxBpm: 160 },
      intensity: "threshold",
    },
  ],
});

describe("session matching", () => {
  it("matches a same-day activity with high confidence", () => {
    const result = matchSessions({
      sessions: [session("a", "2026-10-13")],
      activities: [activity("x", "2026-10-13T07:00:00")],
      overrides: [],
      today,
    });
    expect(result.algorithmVersion).toBe(matchingAlgorithmVersion);
    expect(result.matches).toEqual([
      {
        sessionKey: "a",
        activityId: "x",
        status: "completed",
        confidence: 0.9,
        compliance: { duration: 1, distance: null, intensity: null },
      },
    ]);
  });

  it("marks a short activity as partial", () => {
    const [match] = matchSessions({
      sessions: [session("a", "2026-10-13")],
      activities: [
        activity("x", "2026-10-13T07:00:00", { durationSeconds: 1800 }),
      ],
      overrides: [],
      today,
    }).matches;
    expect(match.status).toBe("partial");
    expect(match.compliance.duration).toBe(0.75);
  });

  it("matches a session moved within its week with lower confidence", () => {
    const moved = matchSessions({
      sessions: [
        session("tue", "2026-10-13"),
        session("a", "2026-10-15"),
        session("b", "2026-10-15"),
      ],
      activities: [
        activity("one", "2026-10-15T07:00:00"),
        activity("two", "2026-10-15T09:00:00"),
        activity("three", "2026-10-15T18:00:00"),
      ],
      overrides: [],
      today,
    }).matches;
    expect(moved.find((match) => match.sessionKey === "tue")).toMatchObject({
      activityId: "three",
      status: "completed",
      confidence: 0.6,
    });
  });

  it("splits a session across same-family activities on combined totals", () => {
    const { matches } = matchSessions({
      sessions: [
        session("a", "2026-10-13", {
          targets: {
            durationSeconds: 2400,
            distanceMeters: 8000,
            elevationGainMeters: null,
          },
        }),
      ],
      activities: [
        activity("am", "2026-10-13T07:00:00", {
          durationSeconds: 1200,
          distanceMeters: 4000,
        }),
        activity("pm", "2026-10-13T18:00:00", {
          durationSeconds: 1200,
          distanceMeters: 4400,
        }),
      ],
      overrides: [],
      today,
    });
    expect(matches).toHaveLength(2);
    for (const match of matches) {
      expect(match.status).toBe("completed");
      expect(match.compliance).toEqual({
        duration: 1,
        distance: 1.05,
        intensity: null,
      });
    }
  });

  it("records a substitution without an intensity ratio", () => {
    const { matches } = matchSessions({
      sessions: [session("a", "2026-10-13")],
      activities: [
        activity("bike", "2026-10-13T07:00:00", {
          type: "cycling",
          averageHeartRate: 140,
        }),
      ],
      overrides: [],
      today,
    });
    expect(matches).toEqual([
      {
        sessionKey: "a",
        activityId: "bike",
        status: "substituted",
        confidence: 0.5,
        compliance: { duration: 1, distance: null, intensity: null },
      },
    ]);
  });

  it("leaves a missed session and rest days unmatched", () => {
    expect(
      matchSessions({
        sessions: [
          session("missed", "2026-10-13"),
          session("rest", "2026-10-14", {
            sport: "rest",
            kind: "rest",
            targets: {
              durationSeconds: 0,
              distanceMeters: null,
              elevationGainMeters: null,
            },
            structure: [],
          }),
        ],
        activities: [
          activity("walk", "2026-10-14T07:00:00", { type: "walking" }),
        ],
        overrides: [],
        today,
      }).matches,
    ).toEqual([]);
  });

  it("uses the heart-rate target for the intensity ratio", () => {
    const [match] = matchSessions({
      sessions: [heartRateRun],
      activities: [
        activity("x", "2026-10-13T07:00:00", { averageHeartRate: 145.8 }),
      ],
      overrides: [],
      today,
    }).matches;
    expect(match.compliance.intensity).toBe(1.01);
  });

  it("skips sessions and activities covered by an athlete override", () => {
    const { matches } = matchSessions({
      sessions: [session("a", "2026-10-13"), session("b", "2026-10-14")],
      activities: [
        activity("x", "2026-10-13T07:00:00"),
        activity("y", "2026-10-14T07:00:00"),
      ],
      overrides: [
        { sessionKey: "a", activityId: null },
        { sessionKey: "c", activityId: "y" },
      ],
      today,
    });
    expect(
      matches.map((match) => [
        match.sessionKey,
        match.activityId,
        match.confidence,
      ]),
    ).toEqual([["b", "x", 0.6]]);
  });

  it("never matches a session scheduled after today", () => {
    expect(
      matchSessions({
        sessions: [session("later", "2026-10-17")],
        activities: [activity("x", "2026-10-13T07:00:00")],
        overrides: [],
        today,
      }).matches,
    ).toEqual([]);
  });

  it("ignores activities after today and is deterministic", () => {
    const input = {
      sessions: [session("b", "2026-10-14"), session("a", "2026-10-13")],
      activities: [
        activity("y", "2026-10-16T07:00:00"),
        activity("x", "2026-10-13T07:00:00"),
      ],
      overrides: [],
      today,
    };
    const first = matchSessions(input);
    expect(first.matches.map((match) => match.activityId)).toEqual(["x"]);
    expect(matchSessions(input)).toEqual(first);
  });
});

describe("plan adherence", () => {
  const sessions = [
    session("k1", "2026-10-05", { isKey: true }),
    session("k2", "2026-10-07", { isKey: true }),
    session("e1", "2026-10-08"),
    session("e2", "2026-10-10"),
    session("sub", "2026-10-12"),
    session("dismissed", "2026-10-13"),
    session("today", "2026-10-15"),
    session("future", "2026-10-17"),
  ];

  it("counts due, done, substituted and missed sessions over the period", () => {
    const adherence = planAdherence({
      sessions,
      matches: [
        { sessionKey: "k1", status: "completed" },
        { sessionKey: "k2", status: "partial" },
        { sessionKey: "e1", status: "completed" },
        { sessionKey: "sub", status: "substituted" },
        { sessionKey: "dismissed", status: "dismissed" },
      ],
      start: "2026-10-01",
      today,
      windows: [
        { from: "2026-10-01", to: "2026-10-08" },
        { from: "2026-10-09", to: "2026-10-15" },
        { from: "2026-10-16", to: "2026-10-20" },
      ],
    });
    expect(adherence).toMatchObject({
      due: 6,
      done: 3,
      substituted: 1,
      missed: 2,
      keyDue: 2,
      keyDone: 2,
      share: 0.5,
      keyShare: 1,
    });
    expect(adherence.windows).toEqual([1, 0, null]);
  });

  it("counts today only once it is matched", () => {
    const adherence = planAdherence({
      sessions,
      matches: [{ sessionKey: "today", status: "completed" }],
      start: "2026-10-15",
      today,
      windows: [],
    });
    expect([adherence.due, adherence.done]).toEqual([1, 1]);
  });
});
