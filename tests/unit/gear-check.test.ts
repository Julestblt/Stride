import { describe, expect, it } from "vitest";
import { pairCheck, type PairCheckInput } from "@/features/gear/check";
import { activityPairView, pairQuestion } from "@/features/gear/check-view";

const evo = {
  id: "evo",
  garminGearUuid: "a".repeat(32),
  firstUseDate: "2026-06-02",
};
const zegama = {
  id: "zegama",
  garminGearUuid: "b".repeat(32),
  firstUseDate: "2026-05-01",
};
const fresh = {
  id: "fresh",
  garminGearUuid: "c".repeat(32),
  firstUseDate: "2026-10-20",
};
const local = { id: "local", garminGearUuid: null, firstUseDate: "2026-01-01" };

const input = (overrides: Partial<PairCheckInput>): PairCheckInput => ({
  day: "2026-10-06",
  sessionKey: "s-2026-10-06-1",
  plannedPairId: "evo",
  garminGearUuid: evo.garminGearUuid,
  decision: null,
  pairs: [evo, zegama, fresh, local],
  ...overrides,
});

describe("activity pair check", () => {
  it.each([
    {
      name: "same: Garmin has the planned pair",
      input: input({}),
      state: "same",
      pairId: "evo",
      assign: null,
    },
    {
      name: "different: Garmin has another pair",
      input: input({ garminGearUuid: zegama.garminGearUuid }),
      state: "different",
      pairId: "zegama",
      assign: null,
    },
    {
      name: "different: Garmin has a pair Stride does not know",
      input: input({ garminGearUuid: "d".repeat(32) }),
      state: "different",
      pairId: null,
      assign: null,
    },
    {
      name: "missing: Stride assigns the planned pair",
      input: input({ garminGearUuid: null }),
      state: "missing",
      pairId: null,
      assign: { pairId: "evo", gearUuid: evo.garminGearUuid },
    },
    {
      name: "missing: a pair first used after the run is not assigned",
      input: input({ garminGearUuid: null, plannedPairId: "fresh" }),
      state: "missing",
      pairId: null,
      assign: null,
    },
    {
      name: "missing: a pair outside Garmin is not assigned",
      input: input({ garminGearUuid: null, plannedPairId: "local" }),
      state: "missing",
      pairId: null,
      assign: null,
    },
    {
      name: "missing: an earlier attempt is not repeated",
      input: input({
        garminGearUuid: null,
        decision: { decision: "unassignable", shoeId: "evo" },
      }),
      state: "missing",
      pairId: null,
      assign: null,
    },
    {
      name: "corrected: the athlete's pair wins over any later sync",
      input: input({
        garminGearUuid: zegama.garminGearUuid,
        decision: { decision: "corrected", shoeId: "evo" },
      }),
      state: "corrected",
      pairId: "evo",
      assign: null,
    },
    {
      name: "same: the athlete confirmed Garmin's pair",
      input: input({
        garminGearUuid: zegama.garminGearUuid,
        decision: { decision: "confirmed", shoeId: "zegama" },
      }),
      state: "same",
      pairId: "zegama",
      assign: null,
    },
    {
      name: "unplanned: no card, Garmin's pair is shown",
      input: input({ sessionKey: null, garminGearUuid: zegama.garminGearUuid }),
      state: "unplanned",
      pairId: "zegama",
      assign: null,
    },
    {
      name: "unplanned: nothing is written without a pair",
      input: input({ sessionKey: null, garminGearUuid: null }),
      state: "unplanned",
      pairId: null,
      assign: null,
    },
  ])("$name", ({ input: value, state, pairId, assign }) => {
    const check = pairCheck(value);
    expect(check.state).toBe(state);
    expect(check.pairId).toBe(pairId);
    expect(check.assign).toEqual(assign);
  });

  it("remembers a pair Stride assigned", () => {
    expect(
      pairCheck(input({ decision: { decision: "assigned", shoeId: "evo" } })),
    ).toMatchObject({ state: "same", pairId: "evo", assignedByStride: true });
  });
});

describe("activity pair copy", () => {
  const shoe = (id: string, model: string, version: string | null) => ({
    id,
    spec: {
      brand: id === "evo" ? "Adidas" : "Nike",
      model,
      version,
      category: "daily" as const,
      terrain: "road" as const,
      description: null,
      sizeEu: null,
      lifespanKm: 800,
    },
    suggested: [],
    startingDistanceM: 0,
    firstUseDate: "2026-03-01",
    retiredOn: null,
    garmin: null,
    activities: [],
  });
  const shoes = [
    shoe("evo", "Adizero Evo SL", "3"),
    shoe("zegama", "Zegama", null),
  ];
  const checked = (value: PairCheckInput) => ({
    ...pairCheck(value),
    activityId: "a1",
    day: "2026-10-06",
    distanceM: 11_300,
    sessionTitle: "Footing",
    garminName: null,
  });

  it("describes each state on the activity", () => {
    expect(activityPairView(checked(input({})), shoes)).toMatchObject({
      name: "Adidas Adizero Evo SL 3",
      line: "Garmin · prévue par la séance · 11,3 km ajoutés",
    });
    expect(
      activityPairView(
        checked(input({ garminGearUuid: zegama.garminGearUuid })),
        shoes,
      ).line,
    ).toBe("Garmin · la séance prévoyait les Adizero Evo SL 3");
    expect(
      activityPairView(
        checked(input({ decision: { decision: "corrected", shoeId: "evo" } })),
        shoes,
      ).line,
    ).toBe("Corrigée par toi · 11,3 km ajoutés");
    expect(
      activityPairView(
        checked(input({ sessionKey: null, garminGearUuid: null })),
        shoes,
      ),
    ).toMatchObject({ name: "Aucune paire", line: "sortie hors séance" });
  });

  it("asks only when Garmin and the session disagree", () => {
    expect(pairQuestion(checked(input({})), shoes)).toBeNull();
    expect(
      pairQuestion(
        checked(input({ garminGearUuid: zegama.garminGearUuid })),
        shoes,
      ),
    ).toMatchObject({
      text: "Garmin indique les Zegama, la séance prévoyait les Adizero Evo SL 3.",
      garmin: { id: "zegama", name: "Zegama" },
      planned: { id: "evo", name: "Adizero Evo SL 3" },
    });
  });
});
