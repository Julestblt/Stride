import { describe, expect, it } from "vitest";
import type { ProgramOverview } from "@/features/plans/view/program";
import type { RaceSummary } from "@/features/races/race";
import {
  garminPredictions,
  type GarminPrediction,
} from "@/features/progress/garmin-predictions";
import { goalCard, goalSummary, ultraNote } from "@/features/progress/goal";
import { addDays } from "@/features/progress/period";

const today = "2026-10-14";

function race(values: Partial<RaceSummary> = {}): RaceSummary {
  return {
    id: "eco",
    name: "EcoTrail Paris 120K",
    kind: "trail",
    date: "2027-03-21",
    distanceKm: 120,
    elevationGainM: 1800,
    priority: "A",
    targetSeconds: 68_400,
    revision: 1,
    ...values,
  };
}

function program(): ProgramOverview {
  const blocks = [
    { blockKey: "lead", name: "Reprise", count: 2 },
    { blockKey: "volume", name: "Volume", count: 4 },
    { blockKey: "taper", name: "Affûtage", count: 2 },
  ];
  let number = 0;
  const built = blocks.map((block) => ({
    blockKey: block.blockKey,
    name: block.name,
    weeks: Array.from({ length: block.count }, (_, index) => {
      number += 1;
      return {
        weekKey: `w${number}`,
        weekStart: addDays("2026-09-28", 7 * (number - 1)),
        number,
        numberInBlock: index + 1,
        blockName: block.name,
      };
    }),
  }));
  return {
    programs: [],
    blocks: built,
    weeks: built.flatMap((block) => block.weeks),
    currentWeekKey: "w3",
  } as unknown as ProgramOverview;
}

const predictions: GarminPrediction[] = garminPredictions(
  [
    {
      metric: "race_prediction_10k_seconds",
      observed_on: "2026-10-13",
      value_numeric: 2_702,
    },
    {
      metric: "race_prediction_10k_seconds",
      observed_on: "2026-09-10",
      value_numeric: "2720",
    },
    {
      metric: "race_prediction_marathon_seconds",
      observed_on: "2026-10-13",
      value_numeric: 12_820,
    },
  ],
  today,
);

describe("Garmin predictions", () => {
  it("keeps the latest value and the one at least four weeks older", () => {
    expect(predictions.find((item) => item.key === "10k")).toMatchObject({
      label: "10K",
      seconds: 2_702,
      asOf: "2026-10-13",
      previous: { seconds: 2_720, asOf: "2026-09-10" },
    });
    expect(
      predictions.find((item) => item.key === "marathon")?.previous,
    ).toBeNull();
  });
});

describe("goal card", () => {
  const base = {
    today,
    predictions,
    longestRunMeters: 80_400,
    maxWeeklyGainMeters: 3_240,
    preparation: { done: 4, total: 6 },
    program: program(),
    blockKinds: { lead: "lead_in", volume: "build", taper: "taper" } as const,
  };

  it("follows trail preparation without a predicted time", () => {
    const card = goalCard({ ...base, races: [race()], primaryRaceId: null })!;
    expect(card).toMatchObject({
      name: "EcoTrail Paris 120K",
      date: "21 mars",
      countdown: "J-158",
      target: "19:00",
      road: null,
      preparation: {
        longest: "80",
        distance: "120",
        weeklyGain: "3\u202f240",
        preparation: { done: 4, total: 6 },
      },
      note: ultraNote,
    });
    expect(goalSummary(card)).toBe(
      "Plus longue sortie : 80 km sur 120. Objectif 19:00, préparation 4 sur 6.",
    );
  });

  it("reads the plan phase from the active plan weeks", () => {
    const card = goalCard({ ...base, races: [race()], primaryRaceId: null })!;
    expect(card.phase).toEqual({
      label: "Volume · semaine 3 sur 8",
      taper: "Affûtage le 9 novembre",
      segments: [
        { key: "lead", name: "Reprise", weeks: 2, state: "past", progress: 1 },
        {
          key: "volume",
          name: "Volume",
          weeks: 4,
          state: "current",
          progress: 0.25,
        },
        {
          key: "taper",
          name: "Affûtage",
          weeks: 2,
          state: "future",
          progress: 0,
        },
      ],
    });
  });

  it("compares a road goal with the Garmin prediction", () => {
    const road = race({
      id: "paris",
      name: "10 km de Paris",
      kind: "road",
      distanceKm: 10,
      targetSeconds: 2_700,
    });
    const card = goalCard({
      ...base,
      races: [road],
      primaryRaceId: null,
      program: null,
    })!;
    expect(card.road).toEqual({
      prediction: "45:02",
      verdict: "+0:02 sur ton objectif",
      tone: "warning",
    });
    expect(card.phase).toBeNull();
    expect(card.note).toBeNull();
    expect(
      goalCard({
        ...base,
        races: [{ ...road, targetSeconds: 2_760 }],
        primaryRaceId: null,
      })!.road?.verdict,
    ).toBe("Dans les temps");
  });

  it("prefers the plan goal and ignores C races and past races", () => {
    const races = [
      race({ id: "past", date: "2026-09-01" }),
      race({ id: "c", priority: "C", date: "2026-11-01" }),
      race({ id: "b", priority: "B", date: "2027-01-10" }),
    ];
    expect(goalCard({ ...base, races, primaryRaceId: null })?.id).toBe("b");
    expect(goalCard({ ...base, races, primaryRaceId: "c" })?.id).toBe("c");
    expect(
      goalCard({ ...base, races: races.slice(0, 2), primaryRaceId: null }),
    ).toBeNull();
  });
});
