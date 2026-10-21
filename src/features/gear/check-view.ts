import type { PairCheck, PairCheckState } from "./check";
import { categoryLabels } from "./model";
import { pairWear } from "./mileage";
import { formatDay, modelName, type ShoeInput } from "./view";

export type CheckedActivity = PairCheck & {
  activityId: string;
  day: string;
  distanceM: number;
  sessionTitle: string | null;
  garminName: string | null;
};

export type PairChoice = { id: string; name: string; detail: string };

export type ActivityPairView = {
  activityId: string;
  state: PairCheckState;
  name: string;
  line: string;
  context: string;
  selectedId: string | null;
  options: PairChoice[];
};

export type PairQuestion = {
  activityId: string;
  title: string;
  text: string;
  garmin: { id: string | null; name: string };
  planned: { id: string; name: string };
  context: string;
  options: PairChoice[];
};

const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function choices(shoes: ShoeInput[]): PairChoice[] {
  return shoes
    .filter((shoe) => shoe.retiredOn === null)
    .filter(
      (shoe) =>
        !pairWear({
          startingDistanceM: shoe.startingDistanceM,
          garminDistanceM: shoe.garmin?.totalDistanceM ?? 0,
          lifespanKm: shoe.spec.lifespanKm,
        }).worn,
    )
    .map((shoe) => ({
      id: shoe.id,
      name: modelName(shoe.spec),
      detail: `${shoe.spec.brand} · ${categoryLabels[shoe.spec.category].toLowerCase()}`,
    }));
}

function shortName(shoes: ShoeInput[], id: string | null) {
  const shoe = id ? shoes.find((item) => item.id === id) : null;
  return shoe ? modelName(shoe.spec) : null;
}

function fullName(shoes: ShoeInput[], id: string | null) {
  const shoe = id ? shoes.find((item) => item.id === id) : null;
  return shoe ? `${shoe.spec.brand} ${modelName(shoe.spec)}` : null;
}

function context(check: CheckedActivity) {
  return [
    formatDay(check.day),
    check.sessionTitle,
    check.distanceM > 0 ? `${decimal.format(check.distanceM / 1000)} km` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function activityPairView(
  check: CheckedActivity,
  shoes: ShoeInput[],
): ActivityPairView {
  const added =
    check.distanceM > 0
      ? `${decimal.format(check.distanceM / 1000)} km ajoutés`
      : null;
  const planned = shortName(shoes, check.plannedPairId);
  const name =
    fullName(shoes, check.pairId) ??
    (check.garminGearUuid
      ? (check.garminName ?? "Paire Garmin inconnue")
      : "Aucune paire");
  const parts: Record<PairCheckState, (string | null)[]> = {
    same: [
      check.assignedByStride ? "Attribuée par Stride" : "Garmin",
      check.plannedPairId === null
        ? null
        : check.pairId === check.plannedPairId
          ? "prévue par la séance"
          : "confirmée par toi",
      added,
    ],
    different: [
      "Garmin",
      planned ? `la séance prévoyait les ${planned}` : null,
    ],
    missing: [
      "Aucune paire liée dans Garmin",
      planned ? `la séance prévoyait les ${planned}` : null,
    ],
    corrected: ["Corrigée par toi", added],
    unplanned: [
      check.pairId || check.garminName ? "Garmin" : null,
      "sortie hors séance",
    ],
  };
  return {
    activityId: check.activityId,
    state: check.state,
    name,
    line: parts[check.state].filter(Boolean).join(" · "),
    context: context(check),
    selectedId: check.pairId,
    options: choices(shoes),
  };
}

export function pairQuestion(
  check: CheckedActivity,
  shoes: ShoeInput[],
): PairQuestion | null {
  if (check.state !== "different" || !check.plannedPairId) return null;
  const garmin =
    shortName(shoes, check.garminPairId) ??
    check.garminName ??
    "Paire inconnue";
  const planned = shortName(shoes, check.plannedPairId);
  if (!planned) return null;
  return {
    activityId: check.activityId,
    title: `Paire à confirmer · ${check.sessionTitle ?? "séance"} du ${formatDay(check.day)}`,
    text: `Garmin indique les ${garmin}, la séance prévoyait les ${planned}.`,
    garmin: { id: check.garminPairId, name: garmin },
    planned: { id: check.plannedPairId, name: planned },
    context: context(check),
    options: choices(shoes),
  };
}

export function pairQuestions(
  checks: Iterable<CheckedActivity>,
  shoes: ShoeInput[],
) {
  return [...checks]
    .sort((first, second) => second.day.localeCompare(first.day))
    .flatMap((check) => {
      const question = pairQuestion(check, shoes);
      return question ? [question] : [];
    });
}
