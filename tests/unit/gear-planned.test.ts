import { describe, expect, it } from "vitest";
import {
  planShoes,
  rotation,
  sessionShoesView,
  weekShoes,
} from "@/features/gear/planned";
import type { ShoeInput } from "@/features/gear/view";
import { planState } from "./plan-fixture";

const shoe = (
  id: string,
  model: string,
  category: ShoeInput["spec"]["category"],
  km: number,
  activities: ShoeInput["activities"] = [],
): ShoeInput => ({
  id,
  spec: {
    brand: "Marque",
    model,
    version: null,
    category,
    terrain: "road",
    description: null,
    sizeEu: null,
    lifespanKm: 800,
  },
  suggested: [],
  startingDistanceM: km * 1000,
  firstUseDate: "2026-03-01",
  retiredOn: null,
  garmin: null,
  activities,
});

const shoes = [
  shoe("daily", "Clifton", "daily", 300, [
    { activityId: "a1", name: null, day: "2026-10-19", distanceM: 8200 },
  ]),
  shoe("tempo", "Speed", "tempo", 120),
];

describe("planned pairs", () => {
  it("gives every running session of the current plan a pair without changing the plan", () => {
    const state = planState();
    const before = structuredClone(state);
    const plan = planShoes({
      sessions: state.sessions,
      shoes,
      races: [],
      overrides: new Map(),
      paces: null,
      today: "2026-10-20",
    });
    expect(state).toEqual(before);
    for (const session of state.sessions)
      expect(plan.results.get(session.sessionKey)?.chosen).not.toBeNull();
    expect(plan.results.get("s-2026-10-22-1")?.chosen?.pairId).toBe("tempo");
    expect(plan.results.get("s-2026-10-20-1")?.chosen?.pairId).toBe("tempo");
  });

  it("describes the athlete's choice and lists the other pairs", () => {
    const plan = planShoes({
      sessions: planState().sessions,
      shoes,
      races: [],
      overrides: new Map([["s-2026-10-22-1", "daily"]]),
      paces: null,
      today: "2026-10-20",
    });
    const view = sessionShoesView(plan, "s-2026-10-22-1");
    expect(view?.chosen).toMatchObject({
      name: "Clifton",
      badge: "Ton choix",
    });
    expect(view?.sentence).toBe(
      "Tu as choisi cette paire pour la séance. Stride conseillait la Speed.",
    );
    expect(view?.options.map((option) => [option.name, option.badge])).toEqual([
      ["Speed", "Conseillée"],
      ["Clifton", null],
    ]);
  });

  it("lists this week's sessions from today and the last two weeks of runs", () => {
    const state = planState();
    const plan = planShoes({
      sessions: state.sessions,
      shoes,
      races: [],
      overrides: new Map(),
      paces: null,
      today: "2026-10-20",
    });
    expect(
      weekShoes(plan, state.sessions).map((row) => [row.sessionKey, row.pair]),
    ).toEqual([
      ["s-2026-10-20-1", "Speed"],
      ["s-2026-10-22-1", "Speed"],
      ["s-2026-10-25-1", "Clifton"],
    ]);
    const strip = rotation(shoes, "2026-10-20");
    expect(strip.days).toHaveLength(14);
    expect(strip.range).toBe("06/10 → 19/10");
    expect(strip.rows[0].cells.find((cell) => cell.km !== null)).toMatchObject({
      day: "2026-10-19",
      km: 8.2,
    });
  });
});
