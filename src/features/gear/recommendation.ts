import type { PlanSession } from "@/features/plans/model/plan";
import type { ShoeCategory, ShoeTerrain } from "./model";

type SessionKind = PlanSession["kind"];
type SessionSport = PlanSession["sport"];
type SessionTerrain = NonNullable<PlanSession["terrain"]>;

export type PairFacts = {
  id: string;
  name: string;
  category: ShoeCategory;
  terrain: ShoeTerrain;
  totalKm: number;
  lifespanKm: number;
};

export type SessionNeed = {
  sessionKey: string;
  day: string;
  sport: SessionSport;
  kind: SessionKind;
  terrain: SessionTerrain | null;
  isKey: boolean;
  durationSeconds: number;
  distanceKm: number | null;
  elevationGainM: number | null;
};

export type RaceFacts = {
  name: string;
  date: string;
  terrain: "road" | "trail";
};

export type PairUse = { pairId: string; day: string };

export type PairPreference = { pairId: string; kind: SessionKind };

export type RecommendationInput = {
  session: SessionNeed;
  pairs: PairFacts[];
  uses: PairUse[];
  races: RaceFacts[];
  preferences?: PairPreference[];
};

export type Reason =
  | { code: "kind_fit" }
  | { code: "terrain_fit" }
  | { code: "long_climb" }
  | { code: "rested"; days: number }
  | { code: "rotation"; pair: string }
  | { code: "race_key"; race: string }
  | { code: "break_in"; race: string }
  | { code: "preferred" }
  | { code: "only_option" }
  | { code: "reserved"; race: string }
  | { code: "terrain_mismatch"; terrain: ShoeTerrain }
  | { code: "used_yesterday" }
  | { code: "less_suited" };

export type ReasonCode = Reason["code"];

export type PairOption = {
  pairId: string;
  eligible: boolean;
  reasons: Reason[];
};

export type Recommendation = {
  sessionKey: string;
  pairId: string | null;
  reasons: Reason[];
  alternatives: PairOption[];
};

type Assessment = PairOption & { score: number; fit: number };

const shoeSessionSports = new Set<SessionSport>(["run", "trail"]);
const breakInKm = 60;
const breakInDays = 42;
const longKm = 18;
const longSeconds = 5400;
const climbMeters = 400;
const restedDays = 3;

const kindFit: Partial<Record<SessionKind, Record<ShoeCategory, number>>> = {
  easy: { daily: 3, recovery: 2, tempo: 1, race: 0 },
  long: { daily: 3, recovery: 3, tempo: 0, race: 0 },
  recovery: { recovery: 3, daily: 2, tempo: 0, race: 0 },
  tempo: { tempo: 3, race: 2, daily: 1, recovery: 0 },
  threshold: { tempo: 3, race: 2, daily: 1, recovery: 0 },
  intervals: { tempo: 3, race: 2, daily: 1, recovery: 0 },
  hills: { daily: 2, tempo: 2, recovery: 1, race: 0 },
  race_specific: { race: 3, tempo: 2, daily: 1, recovery: 0 },
  race: { race: 3, tempo: 2, daily: 1, recovery: 0 },
};

export function needsShoes(session: Pick<SessionNeed, "sport" | "kind">) {
  return shoeSessionSports.has(session.sport) && session.kind in kindFit;
}

export function sessionGround(
  session: Pick<SessionNeed, "sport" | "terrain">,
): SessionTerrain {
  return session.terrain ?? (session.sport === "trail" ? "trail" : "road");
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

function terrainScore(ground: SessionTerrain, terrain: ShoeTerrain) {
  if (ground === "trail")
    return terrain === "trail" ? 2 : terrain === "mixed" ? 1 : null;
  if (ground === "road" || ground === "track")
    return terrain === "road" ? 2 : terrain === "mixed" ? 1 : null;
  if (ground === "treadmill") return terrain === "trail" ? 0 : 1;
  return terrain === "mixed" ? 2 : 1;
}

function reservation(pair: PairFacts, races: RaceFacts[], day: string) {
  if (pair.category !== "race") return null;
  return (
    races
      .filter(
        (race) =>
          race.date >= day &&
          (pair.terrain === "mixed" || pair.terrain === race.terrain),
      )
      .sort((first, second) => first.date.localeCompare(second.date))[0] ?? null
  );
}

function isLongOrClimb(session: SessionNeed) {
  return (
    session.kind === "long" ||
    (session.distanceKm ?? 0) >= longKm ||
    session.durationSeconds >= longSeconds ||
    (session.elevationGainM ?? 0) >= climbMeters
  );
}

function assess(
  input: RecommendationInput,
  pair: PairFacts,
  lastUse: Map<string, string>,
): Assessment {
  const { session } = input;
  const ground = sessionGround(session);
  const reasons: Reason[] = [];
  let eligible = true;
  let score = 0;

  const terrain = terrainScore(ground, pair.terrain);
  if (terrain === null) {
    eligible = false;
    reasons.push({ code: "terrain_mismatch", terrain: pair.terrain });
  } else {
    score += terrain;
    if (terrain === 2) reasons.push({ code: "terrain_fit" });
  }

  const fit = kindFit[session.kind]?.[pair.category] ?? 0;
  score += fit * 2;
  if (fit >= 2) reasons.push({ code: "kind_fit" });

  const race = reservation(pair, input.races, session.day);
  if (race) {
    const keySession =
      session.isKey ||
      session.kind === "race" ||
      session.kind === "race_specific";
    const breakIn =
      pair.totalKm < breakInKm &&
      daysBetween(session.day, race.date) <= breakInDays &&
      session.kind !== "recovery";
    if (keySession) {
      score += 4;
      reasons.push({ code: "race_key", race: race.name });
    } else if (breakIn) {
      score += 2;
      reasons.push({ code: "break_in", race: race.name });
    } else {
      eligible = false;
      reasons.unshift({ code: "reserved", race: race.name });
    }
  }

  if (isLongOrClimb(session)) {
    if (pair.category === "recovery" || pair.terrain === "trail") {
      score += 2;
      reasons.push({ code: "long_climb" });
    }
    if (pair.category === "race") score -= 3;
    if (pair.category === "tempo") score -= 2;
  }

  const last = lastUse.get(pair.id);
  const rest = last ? daysBetween(last, session.day) : null;
  if (rest !== null && rest <= 1) {
    score -= 5;
    if (eligible) reasons.unshift({ code: "used_yesterday" });
    else reasons.push({ code: "used_yesterday" });
  } else if (rest !== null && rest >= restedDays) {
    score += 1;
    reasons.push({ code: "rested", days: rest });
  }

  const liked = (input.preferences ?? []).filter(
    (item) => item.pairId === pair.id && item.kind === session.kind,
  ).length;
  if (liked > 0) {
    score += Math.min(liked, 2);
    reasons.push({ code: "preferred" });
  }

  score -= pair.totalKm / pair.lifespanKm;
  return { pairId: pair.id, eligible, reasons, score, fit };
}

function byScore(
  first: Assessment,
  second: Assessment,
  names: Map<string, string>,
) {
  return (
    Number(second.eligible) - Number(first.eligible) ||
    second.score - first.score ||
    (names.get(first.pairId) ?? "").localeCompare(
      names.get(second.pairId) ?? "",
    ) ||
    first.pairId.localeCompare(second.pairId)
  );
}

export function recommendPair(input: RecommendationInput): Recommendation {
  const { session } = input;
  const pairs = input.pairs.filter((pair) => pair.totalKm < pair.lifespanKm);
  if (!needsShoes(session) || pairs.length === 0)
    return {
      sessionKey: session.sessionKey,
      pairId: null,
      reasons: [],
      alternatives: [],
    };
  const lastUse = new Map<string, string>();
  for (const use of input.uses)
    if (use.day < session.day && (lastUse.get(use.pairId) ?? "") < use.day)
      lastUse.set(use.pairId, use.day);
  const names = new Map(pairs.map((pair) => [pair.id, pair.name]));
  const ranked = pairs
    .map((pair) => assess(input, pair, lastUse))
    .sort((first, second) => byScore(first, second, names));
  const [best, ...rest] = ranked;
  const alternatives = rest.map(({ pairId, eligible, reasons, fit }) => ({
    pairId,
    eligible,
    reasons:
      eligible && fit < best.fit && reasons[0]?.code !== "used_yesterday"
        ? [{ code: "less_suited" as const }, ...reasons]
        : reasons,
  }));
  if (!best.eligible)
    return {
      sessionKey: session.sessionKey,
      pairId: null,
      reasons: [],
      alternatives: ranked.map(({ pairId, eligible, reasons }) => ({
        pairId,
        eligible,
        reasons,
      })),
    };
  const reasons = best.reasons.filter(
    (reason) => reason.code !== "used_yesterday",
  );
  const rotated = rest.find(
    (item) =>
      item.reasons[0]?.code === "used_yesterday" &&
      item.eligible &&
      item.fit >= best.fit,
  );
  if (rotated)
    reasons.push({ code: "rotation", pair: names.get(rotated.pairId) ?? "" });
  if (!rest.some((item) => item.eligible))
    reasons.push({ code: "only_option" });
  return {
    sessionKey: session.sessionKey,
    pairId: best.pairId,
    reasons,
    alternatives,
  };
}

export type PlannedPair = { pairId: string; overridden: boolean };

export type PlanRecommendationInput = {
  sessions: SessionNeed[];
  pairs: PairFacts[];
  uses: PairUse[];
  races: RaceFacts[];
  overrides: Map<string, string>;
  today: string;
};

export function recommendPlan(input: PlanRecommendationInput) {
  const active = new Set(input.pairs.map((pair) => pair.id));
  const preferences: PairPreference[] = input.sessions.flatMap((session) => {
    const pairId = input.overrides.get(session.sessionKey);
    return pairId && active.has(pairId) ? [{ pairId, kind: session.kind }] : [];
  });
  const past = input.uses.filter((use) => use.day < input.today);
  const planned: PairUse[] = [];
  const results = new Map<
    string,
    { recommendation: Recommendation; chosen: PlannedPair | null }
  >();
  const ordered = [...input.sessions]
    .filter(needsShoes)
    .sort(
      (first, second) =>
        first.day.localeCompare(second.day) ||
        first.sessionKey.localeCompare(second.sessionKey),
    );
  for (const session of ordered) {
    const uses = session.day < input.today ? input.uses : [...past, ...planned];
    const recommendation = recommendPair({
      session,
      pairs: input.pairs,
      uses,
      races: input.races,
      preferences: preferences.filter(
        (item) => input.overrides.get(session.sessionKey) !== item.pairId,
      ),
    });
    const override = input.overrides.get(session.sessionKey);
    const chosen: PlannedPair | null =
      override && active.has(override)
        ? { pairId: override, overridden: override !== recommendation.pairId }
        : recommendation.pairId
          ? { pairId: recommendation.pairId, overridden: false }
          : null;
    if (chosen && session.day >= input.today)
      planned.push({ pairId: chosen.pairId, day: session.day });
    results.set(session.sessionKey, { recommendation, chosen });
  }
  return results;
}
