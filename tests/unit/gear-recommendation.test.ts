import { describe, expect, it } from "vitest";
import {
  recommendPair,
  recommendPlan,
  type PairFacts,
  type RaceFacts,
  type SessionNeed,
} from "@/features/gear/recommendation";
import {
  optionSentence,
  recommendationSentence,
} from "@/features/gear/reasons";

const pair = (
  id: string,
  category: PairFacts["category"],
  terrain: PairFacts["terrain"],
  totalKm = 200,
  lifespanKm = 800,
): PairFacts => ({ id, name: id, category, terrain, totalKm, lifespanKm });

const evo = pair("Evo SL 3", "daily", "road", 594);
const speed = pair("Endorphin Speed", "tempo", "road", 120, 700);
const zegama = pair("Zegama", "daily", "trail", 241, 700);
const glide = pair("Ultra Glide 3", "recovery", "trail", 193, 700);
const rocket = pair("Rocket X 2", "race", "road", 88, 400);
const fresh = pair("Rocket X 2", "race", "road", 20, 400);
const worn = pair("Pegasus", "daily", "road", 812, 800);

const session = (overrides: Partial<SessionNeed>): SessionNeed => ({
  sessionKey: "s-2026-10-07-1",
  day: "2026-10-07",
  sport: "run",
  kind: "easy",
  terrain: "road",
  isKey: false,
  durationSeconds: 3000,
  distanceKm: 9.6,
  elevationGainM: null,
  ...overrides,
});

const vincennes: RaceFacts = {
  name: "10K Vincennes",
  date: "2026-10-25",
  terrain: "road",
};

const cases: {
  name: string;
  session: SessionNeed;
  pairs: PairFacts[];
  uses?: { pairId: string; day: string }[];
  races?: RaceFacts[];
  pick: string | null;
  reasons: string[];
  excluded?: Record<string, string>;
  absent?: string[];
}[] = [
  {
    name: "trail long run with D+",
    session: session({
      sport: "trail",
      kind: "long",
      terrain: "trail",
      durationSeconds: 10_800,
      distanceKm: 22,
      elevationGainM: 680,
    }),
    pairs: [evo, zegama, glide, rocket],
    races: [vincennes],
    pick: "Ultra Glide 3",
    reasons: ["terrain_fit", "kind_fit", "long_climb"],
    excluded: { "Evo SL 3": "terrain_mismatch", "Rocket X 2": "reserved" },
  },
  {
    name: "road threshold",
    session: session({ kind: "threshold" }),
    pairs: [evo, speed, zegama],
    pick: "Endorphin Speed",
    reasons: ["terrain_fit", "kind_fit"],
    excluded: { Zegama: "terrain_mismatch" },
  },
  {
    name: "treadmill hills",
    session: session({
      kind: "hills",
      terrain: "treadmill",
      distanceKm: 9,
      elevationGainM: 450,
    }),
    pairs: [evo, glide],
    uses: [{ pairId: "Evo SL 3", day: "2026-10-06" }],
    pick: "Ultra Glide 3",
    reasons: ["long_climb", "rotation"],
  },
  {
    name: "rotation after a run the day before",
    session: session({ kind: "easy" }),
    pairs: [evo, pair("Clifton 9", "daily", "road", 300)],
    uses: [
      { pairId: "Evo SL 3", day: "2026-10-06" },
      { pairId: "Clifton 9", day: "2026-10-01" },
    ],
    pick: "Clifton 9",
    reasons: ["terrain_fit", "kind_fit", "rested", "rotation"],
    excluded: {},
  },
  {
    name: "worn pair",
    session: session({ kind: "easy" }),
    pairs: [worn, speed],
    pick: "Endorphin Speed",
    reasons: ["terrain_fit", "only_option"],
    absent: ["Pegasus"],
  },
  {
    name: "race-reserved pair before its race on a regular session",
    session: session({ kind: "tempo" }),
    pairs: [evo, rocket],
    races: [vincennes],
    pick: "Evo SL 3",
    reasons: ["terrain_fit", "only_option"],
    excluded: { "Rocket X 2": "reserved" },
  },
  {
    name: "race-reserved pair before its race on a key session",
    session: session({ kind: "threshold", isKey: true }),
    pairs: [evo, rocket],
    races: [vincennes],
    pick: "Rocket X 2",
    reasons: ["terrain_fit", "kind_fit", "race_key"],
  },
  {
    name: "race-reserved pair breaking in before its race",
    session: session({ kind: "easy" }),
    pairs: [speed, fresh],
    races: [vincennes],
    pick: "Rocket X 2",
    reasons: ["terrain_fit", "break_in"],
  },
  {
    name: "race pair after its race",
    session: session({ day: "2026-10-28", kind: "tempo" }),
    pairs: [evo, rocket],
    races: [vincennes],
    pick: "Rocket X 2",
    reasons: ["terrain_fit", "kind_fit"],
  },
];

describe("recommended pair", () => {
  it.each(cases)("$name", (item) => {
    const result = recommendPair({
      session: item.session,
      pairs: item.pairs,
      uses: item.uses ?? [],
      races: item.races ?? [],
    });
    expect(result.pairId).toBe(item.pick);
    expect(result.reasons.map((reason) => reason.code)).toEqual(item.reasons);
    for (const [id, code] of Object.entries(item.excluded ?? {})) {
      const option = result.alternatives.find((entry) => entry.pairId === id);
      expect(option?.eligible).toBe(false);
      expect(option?.reasons[0]?.code).toBe(code);
    }
    for (const id of item.absent ?? [])
      expect(result.alternatives.map((entry) => entry.pairId)).not.toContain(
        id,
      );
  });

  it("recommends nothing for strength sessions or without a usable pair", () => {
    expect(
      recommendPair({
        session: session({ sport: "strength", kind: "strength" }),
        pairs: [evo],
        uses: [],
        races: [],
      }).pairId,
    ).toBeNull();
    const trail = recommendPair({
      session: session({ sport: "trail", terrain: "trail" }),
      pairs: [evo],
      uses: [],
      races: [],
    });
    expect(trail.pairId).toBeNull();
    expect(trail.alternatives[0]).toMatchObject({
      pairId: "Evo SL 3",
      eligible: false,
    });
  });

  it("favours the pair the athlete chose for the same kind of session", () => {
    const clifton = pair("Clifton 9", "daily", "road", 594);
    const input = {
      session: session({ kind: "easy" }),
      pairs: [evo, clifton],
      uses: [],
      races: [],
    };
    expect(recommendPair(input).pairId).toBe("Clifton 9");
    const preferred = recommendPair({
      ...input,
      preferences: [{ pairId: "Evo SL 3", kind: "easy" }],
    });
    expect(preferred.pairId).toBe("Evo SL 3");
    expect(preferred.reasons.map((reason) => reason.code)).toContain(
      "preferred",
    );
  });
});

describe("reason sentences", () => {
  it("renders the reasons of the pick as one French sentence", () => {
    expect(
      recommendationSentence(
        [
          { code: "kind_fit" },
          { code: "rested", days: 6 },
          { code: "rotation", pair: "Zegama" },
        ],
        session({ kind: "threshold" }),
      ),
    ).toBe("Seuil sur route : réactive pour le seuil, reposée depuis 6 jours.");
    expect(recommendationSentence([], session({ kind: "easy" }))).toBe(
      "Footing sur route.",
    );
  });

  it("explains why an alternative is not the pick", () => {
    expect(
      optionSentence({
        pairId: "Rocket X 2",
        eligible: false,
        reasons: [{ code: "reserved", race: "10K Vincennes" }],
      }),
    ).toBe(
      "Réservée à la course 10K Vincennes : gardée pour les séances clés.",
    );
    expect(
      optionSentence({
        pairId: "Zegama",
        eligible: false,
        reasons: [{ code: "terrain_mismatch", terrain: "trail" }],
      }),
    ).toBe("Crampons inutiles sur ce terrain.");
  });
});

describe("plan recommendations", () => {
  const sessions = [
    session({ sessionKey: "s-2026-10-07-1", day: "2026-10-07" }),
    session({ sessionKey: "s-2026-10-08-1", day: "2026-10-08" }),
  ];
  const clifton = pair("Clifton 9", "daily", "road", 300);

  it("rotates pairs across consecutive planned days", () => {
    const plan = recommendPlan({
      sessions,
      pairs: [evo, clifton],
      uses: [],
      races: [],
      overrides: new Map(),
      today: "2026-10-07",
    });
    const first = plan.get("s-2026-10-07-1")?.chosen?.pairId;
    const second = plan.get("s-2026-10-08-1")?.chosen?.pairId;
    expect(first).toBe("Clifton 9");
    expect(second).toBe("Evo SL 3");
  });

  it("keeps the athlete's pair for a session key", () => {
    const plan = recommendPlan({
      sessions,
      pairs: [evo, clifton],
      uses: [],
      races: [],
      overrides: new Map([["s-2026-10-07-1", "Evo SL 3"]]),
      today: "2026-10-07",
    });
    expect(plan.get("s-2026-10-07-1")?.chosen).toEqual({
      pairId: "Evo SL 3",
      overridden: true,
    });
    expect(plan.get("s-2026-10-08-1")?.chosen?.pairId).toBe("Clifton 9");
  });

  it("ignores a choice whose pair was retired", () => {
    const plan = recommendPlan({
      sessions,
      pairs: [clifton],
      uses: [],
      races: [],
      overrides: new Map([["s-2026-10-07-1", "Evo SL 3"]]),
      today: "2026-10-07",
    });
    expect(plan.get("s-2026-10-07-1")?.chosen).toEqual({
      pairId: "Clifton 9",
      overridden: false,
    });
  });
});

describe("alternative order", () => {
  it("explains an ineligible pair by its terrain before its rest", () => {
    const result = recommendPair({
      session: session({ kind: "threshold" }),
      pairs: [evo, zegama],
      uses: [{ pairId: "Zegama", day: "2026-10-06" }],
      races: [],
    });
    expect(result.alternatives[0].reasons.map((reason) => reason.code)).toEqual(
      ["terrain_mismatch", "used_yesterday"],
    );
  });
});
