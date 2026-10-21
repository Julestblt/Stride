export const pairDecisions = [
  "confirmed",
  "corrected",
  "assigned",
  "unassignable",
] as const;

export type PairDecision = (typeof pairDecisions)[number];

export type PairCheckState =
  "same" | "different" | "missing" | "corrected" | "unplanned";

export type CheckPair = {
  id: string;
  garminGearUuid: string | null;
  firstUseDate: string;
};

export type PairCheckInput = {
  day: string;
  sessionKey: string | null;
  plannedPairId: string | null;
  garminGearUuid: string | null;
  decision: { decision: PairDecision; shoeId: string | null } | null;
  pairs: CheckPair[];
};

export type PairCheck = {
  state: PairCheckState;
  pairId: string | null;
  garminPairId: string | null;
  plannedPairId: string | null;
  garminGearUuid: string | null;
  assignedByStride: boolean;
  assign: { pairId: string; gearUuid: string } | null;
};

export function pairCheck(input: PairCheckInput): PairCheck {
  const byUuid = new Map(
    input.pairs.flatMap((pair) =>
      pair.garminGearUuid ? [[pair.garminGearUuid, pair] as const] : [],
    ),
  );
  const garminPairId = input.garminGearUuid
    ? (byUuid.get(input.garminGearUuid)?.id ?? null)
    : null;
  const planned =
    input.sessionKey && input.plannedPairId
      ? (input.pairs.find((pair) => pair.id === input.plannedPairId) ?? null)
      : null;
  const base = {
    garminPairId,
    plannedPairId: planned?.id ?? null,
    garminGearUuid: input.garminGearUuid,
    assignedByStride: input.decision?.decision === "assigned",
    assign: null,
  };
  const decision = input.decision?.decision ?? null;
  if (decision === "corrected")
    return {
      ...base,
      state: "corrected",
      pairId: input.decision?.shoeId ?? null,
    };
  if (!input.sessionKey)
    return { ...base, state: "unplanned", pairId: garminPairId };
  if (!input.garminGearUuid) {
    const assignable =
      decision === null &&
      planned !== null &&
      planned.garminGearUuid !== null &&
      planned.firstUseDate <= input.day;
    return {
      ...base,
      state: "missing",
      pairId: null,
      assign:
        assignable && planned?.garminGearUuid
          ? { pairId: planned.id, gearUuid: planned.garminGearUuid }
          : null,
    };
  }
  if (decision === "confirmed" || !planned || garminPairId === planned.id)
    return { ...base, state: "same", pairId: garminPairId };
  return { ...base, state: "different", pairId: garminPairId };
}

export function needsAnswer(check: PairCheck) {
  return check.state === "different";
}
