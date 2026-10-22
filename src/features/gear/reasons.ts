import type { ShoeTerrain } from "./model";
import {
  sessionGround,
  type PairOption,
  type Reason,
  type SessionNeed,
} from "./recommendation";

const kindLeads: Partial<Record<SessionNeed["kind"], string>> = {
  easy: "Footing",
  long: "Sortie longue",
  recovery: "Récup",
  tempo: "Tempo",
  threshold: "Seuil",
  intervals: "Fractionné",
  hills: "Côtes",
  fartlek: "Fartlek",
  race_specific: "Allure course",
  race: "Course",
};

const groundLabels: Record<ReturnType<typeof sessionGround>, string> = {
  road: "sur route",
  trail: "en trail",
  track: "sur piste",
  treadmill: "sur tapis",
  mixed: "sur terrain mixte",
};

const kindFitParts: Partial<Record<SessionNeed["kind"], string>> = {
  easy: "polyvalente pour le footing",
  long: "confortable sur la durée",
  recovery: "amortie pour récupérer",
  tempo: "réactive pour le rythme",
  threshold: "réactive pour le seuil",
  intervals: "réactive pour le fractionné",
  hills: "stable en côte",
  fartlek: "polyvalente pour les relances",
  race_specific: "faite pour l’allure course",
  race: "faite pour le jour J",
};

const mismatchSentences: Record<ShoeTerrain, string> = {
  trail: "Crampons inutiles sur ce terrain.",
  road: "Pas assez d’accroche pour le trail.",
  mixed: "Terrain peu adapté à cette séance.",
};

function part(reason: Reason, session: SessionNeed) {
  switch (reason.code) {
    case "race_key":
      return `séance clé avant la course ${reason.race}`;
    case "break_in":
      return `rodage avant la course ${reason.race}`;
    case "kind_fit":
      return kindFitParts[session.kind] ?? null;
    case "terrain_fit":
      return sessionGround(session) === "trail"
        ? "accroche pour le trail"
        : null;
    case "long_climb":
      return "confort pour la distance et le D+";
    case "rested":
      return `reposée depuis ${reason.days} jours`;
    case "rotation":
      return `laisse ${reason.pair} récupérer`;
    case "preferred":
      return "ton choix habituel pour cette séance";
    case "only_option":
      return "seule paire adaptée";
    default:
      return null;
  }
}

const priority: Reason["code"][] = [
  "race_key",
  "break_in",
  "kind_fit",
  "long_climb",
  "rested",
  "rotation",
  "preferred",
  "terrain_fit",
  "only_option",
];

const sentenceParts = 2;

export function recommendationSentence(
  reasons: Reason[],
  session: SessionNeed,
) {
  const lead = `${kindLeads[session.kind] ?? "Séance"} ${groundLabels[sessionGround(session)]}`;
  const parts = [...reasons]
    .sort(
      (first, second) =>
        priority.indexOf(first.code) - priority.indexOf(second.code),
    )
    .map((reason) => part(reason, session))
    .filter((text): text is string => text !== null)
    .slice(0, sentenceParts);
  return parts.length > 0 ? `${lead} : ${parts.join(", ")}.` : `${lead}.`;
}

export function optionSentence(option: PairOption) {
  const [first] = option.reasons;
  switch (first?.code) {
    case "reserved":
      return `Réservée à la course ${first.race} : gardée pour les séances clés.`;
    case "terrain_mismatch":
      return mismatchSentences[first.terrain];
    case "used_yesterday":
      return "A couru la veille : mieux vaut la laisser récupérer.";
    case "less_suited":
      return "Possible, mais moins adaptée à cette séance.";
    default:
      return option.eligible
        ? "Possible aussi pour cette séance."
        : "Peu adaptée à cette séance.";
  }
}
