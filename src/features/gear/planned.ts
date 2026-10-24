import { addDays, mondayOf } from "@/features/plans/model/dates";
import type { PlanSession } from "@/features/plans/model/plan";
import type { IntensityPaces } from "@/features/plans/model/structure";
import { sessionDistance } from "@/features/plans/model/volume";
import { terrainLabels as sessionTerrainLabels } from "@/features/plans/view/format";
import { categoryLabels } from "./model";
import { pairWear } from "./mileage";
import {
  needsShoes,
  recommendPlan,
  sessionGround,
  type PairFacts,
  type PairUse,
  type PlannedPair,
  type RaceFacts,
  type Recommendation,
  type SessionNeed,
} from "./recommendation";
import { optionSentence, recommendationSentence } from "./reasons";
import {
  formatDay,
  formatKm,
  modelName,
  theModel,
  type ShoeInput,
} from "./view";

export type PlanShoesInput = {
  sessions: PlanSession[];
  shoes: ShoeInput[];
  races: RaceFacts[];
  overrides: Map<string, string>;
  paces: IntensityPaces | null;
  today: string;
};

export type PlanShoes = {
  today: string;
  needs: Map<string, SessionNeed>;
  pairs: Map<string, ShoeInput>;
  results: Map<
    string,
    { recommendation: Recommendation; chosen: PlannedPair | null }
  >;
};

export type ShoeOptionView = {
  id: string;
  name: string;
  detail: string;
  sentence: string;
  badge: "Conseillée" | "Réservée" | null;
};

export type SessionShoesView = {
  sessionKey: string;
  context: string;
  hasPairs: boolean;
  chosen: {
    id: string;
    name: string;
    fullName: string;
    km: string;
    badge: "Conseillée" | "Ton choix";
  } | null;
  sentence: string;
  chip: string | null;
  options: ShoeOptionView[];
};

const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

const kindNames: Partial<Record<PlanSession["kind"], string>> = {
  easy: "footing",
  long: "sortie longue",
  recovery: "récup",
  tempo: "tempo",
  threshold: "seuil",
  intervals: "fractionné",
  hills: "côtes",
  fartlek: "fartlek",
  race_specific: "allure course",
  race: "course",
};

function wearOf(shoe: ShoeInput) {
  return pairWear({
    startingDistanceM: shoe.startingDistanceM,
    garminDistanceM: shoe.garmin?.totalDistanceM ?? 0,
    lifespanKm: shoe.spec.lifespanKm,
  });
}

export function pairFacts(shoe: ShoeInput): PairFacts {
  return {
    id: shoe.id,
    name: modelName(shoe.spec),
    category: shoe.spec.category,
    terrain: shoe.spec.terrain,
    totalKm: wearOf(shoe).totalKm,
    lifespanKm: shoe.spec.lifespanKm,
  };
}

export function sessionNeed(
  session: PlanSession,
  paces: IntensityPaces | null,
): SessionNeed {
  const distance = sessionDistance(session, paces);
  return {
    sessionKey: session.sessionKey,
    day: session.scheduledOn,
    sport: session.sport,
    kind: session.kind,
    terrain: session.terrain,
    isKey: session.isKey,
    durationSeconds: session.targets.durationSeconds,
    distanceKm: distance ? distance.meters / 1000 : null,
    elevationGainM: session.targets.elevationGainMeters,
  };
}

export function pairUses(shoes: ShoeInput[]): PairUse[] {
  return shoes.flatMap((shoe) =>
    shoe.activities.map((activity) => ({ pairId: shoe.id, day: activity.day })),
  );
}

export function planShoes(input: PlanShoesInput): PlanShoes {
  const active = input.shoes.filter((shoe) => shoe.retiredOn === null);
  const needs = new Map(
    input.sessions.map((session) => [
      session.sessionKey,
      sessionNeed(session, input.paces),
    ]),
  );
  return {
    today: input.today,
    needs,
    pairs: new Map(active.map((shoe) => [shoe.id, shoe])),
    results: recommendPlan({
      sessions: [...needs.values()],
      pairs: active.map(pairFacts),
      uses: pairUses(input.shoes),
      races: input.races,
      overrides: input.overrides,
      today: input.today,
    }),
  };
}

function fullName(shoe: ShoeInput) {
  return `${shoe.spec.brand} ${modelName(shoe.spec)}`;
}

function sessionContext(need: SessionNeed) {
  const ground = sessionTerrainLabels[sessionGround(need)].toLowerCase();
  return [
    formatDay(need.day),
    kindNames[need.kind] ?? null,
    ground,
    need.distanceKm !== null ? `${decimal.format(need.distanceKm)} km` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function chipDetail(sentence: string, need: SessionNeed) {
  const ground = sessionTerrainLabels[sessionGround(need)].toLowerCase();
  const reason = sentence.split(" : ")[1]?.replace(/\.$/, "").split(", ")[0];
  return reason ? `${ground} · ${reason}` : ground;
}

export function sessionShoesView(
  plan: PlanShoes,
  sessionKey: string,
): SessionShoesView | null {
  const need = plan.needs.get(sessionKey);
  if (!need || !needsShoes(need)) return null;
  const result = plan.results.get(sessionKey);
  const recommendation = result?.recommendation ?? null;
  const chosenPair = result?.chosen
    ? (plan.pairs.get(result.chosen.pairId) ?? null)
    : null;
  const recommended = recommendation?.pairId
    ? (plan.pairs.get(recommendation.pairId) ?? null)
    : null;
  const order = [
    recommendation?.pairId,
    ...(recommendation?.alternatives.map((item) => item.pairId) ?? []),
  ];
  const rank = (id: string) =>
    order.includes(id) ? order.indexOf(id) : order.length;
  const options: ShoeOptionView[] = [...plan.pairs.values()]
    .filter((shoe) => !wearOf(shoe).worn)
    .sort((first, second) => rank(first.id) - rank(second.id))
    .map((shoe) => {
      const facts = pairFacts(shoe);
      const option =
        recommendation?.alternatives.find((item) => item.pairId === shoe.id) ??
        null;
      const isRecommended = recommendation?.pairId === shoe.id;
      return {
        id: shoe.id,
        name: facts.name,
        detail: `${shoe.spec.brand} · ${categoryLabels[shoe.spec.category].toLowerCase()} · ${formatKm(facts.totalKm)} km`,
        sentence:
          isRecommended && recommendation
            ? recommendationSentence(recommendation.reasons, need)
            : option
              ? optionSentence(option)
              : "Possible aussi pour cette séance.",
        badge: isRecommended
          ? "Conseillée"
          : option?.reasons[0]?.code === "reserved"
            ? "Réservée"
            : null,
      };
    });
  const overridden = result?.chosen?.overridden ?? false;
  const sentence = chosenPair
    ? overridden
      ? recommended
        ? `Tu as choisi cette paire pour la séance. Stride conseillait ${theModel(modelName(recommended.spec))}.`
        : "Tu as choisi cette paire pour la séance."
      : recommendationSentence(recommendation?.reasons ?? [], need)
    : plan.pairs.size === 0
      ? "Ajoute tes chaussures pour que Stride conseille une paire à chaque séance."
      : `Aucune paire active ne convient ${sessionGround(need) === "trail" ? "au trail" : "à ce terrain"}.`;
  const wear = chosenPair ? wearOf(chosenPair) : null;
  return {
    sessionKey,
    context: sessionContext(need),
    hasPairs: plan.pairs.size > 0,
    chosen:
      chosenPair && wear
        ? {
            id: chosenPair.id,
            name: modelName(chosenPair.spec),
            fullName: fullName(chosenPair),
            km: `${formatKm(wear.totalKm)} km · ${formatKm(wear.remainingKm)} km restants`,
            badge: overridden ? "Ton choix" : "Conseillée",
          }
        : null,
    sentence,
    chip: chosenPair
      ? overridden
        ? `${sessionTerrainLabels[sessionGround(need)].toLowerCase()} · ton choix`
        : chipDetail(sentence, need)
      : null,
    options,
  };
}

export type WeekShoeRow = {
  sessionKey: string;
  day: string;
  title: string;
  detail: string;
  pair: string | null;
  href: string;
};

export function weekShoes(
  plan: PlanShoes,
  sessions: PlanSession[],
): WeekShoeRow[] {
  const end = addDays(mondayOf(plan.today), 6);
  return sessions
    .filter(
      (session) =>
        session.scheduledOn >= plan.today &&
        session.scheduledOn <= end &&
        needsShoes(session),
    )
    .sort(
      (first, second) =>
        first.scheduledOn.localeCompare(second.scheduledOn) ||
        first.sessionKey.localeCompare(second.sessionKey),
    )
    .map((session) => {
      const need = plan.needs.get(session.sessionKey)!;
      const view = sessionShoesView(plan, session.sessionKey);
      const reason = view?.chosen
        ? view.chosen.badge === "Ton choix"
          ? "ton choix"
          : (view.sentence.split(" : ")[1]?.replace(/\.$/, "") ?? null)
        : null;
      return {
        sessionKey: session.sessionKey,
        day: formatDay(session.scheduledOn),
        title: session.title,
        detail: [
          sessionTerrainLabels[sessionGround(need)],
          need.distanceKm !== null
            ? `${decimal.format(need.distanceKm)} km`
            : null,
          need.elevationGainM ? `${formatKm(need.elevationGainM)} m D+` : null,
          reason,
        ]
          .filter(Boolean)
          .join(" · "),
        pair: view?.chosen?.name ?? null,
        href: `/plan?session=${encodeURIComponent(session.sessionKey)}`,
      };
    });
}

export type RotationView = {
  days: { day: string; letter: string; label: string }[];
  range: string;
  rows: {
    id: string;
    name: string;
    cells: {
      day: string;
      km: number | null;
      label: string | null;
      pending: boolean;
    }[];
  }[];
};

const rotationDays = 14;
const letters = ["D", "L", "M", "M", "J", "V", "S"];
const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

export function rotation(
  shoes: ShoeInput[],
  today: string,
  pending: { pairId: string; day: string }[] = [],
): RotationView {
  const days = Array.from({ length: rotationDays }, (_, index) =>
    addDays(today, index - rotationDays),
  );
  const active = shoes.filter((shoe) => shoe.retiredOn === null);
  return {
    days: days.map((day) => ({
      day,
      letter: letters[new Date(`${day}T00:00:00Z`).getUTCDay()],
      label: formatDay(day),
    })),
    range: `${dayMonth.format(new Date(`${days[0]}T00:00:00Z`))} → ${dayMonth.format(new Date(`${days.at(-1)}T00:00:00Z`))}`,
    rows: active.map((shoe) => ({
      id: shoe.id,
      name: modelName(shoe.spec),
      cells: days.map((day) => {
        const meters = shoe.activities
          .filter((activity) => activity.day === day)
          .reduce((sum, activity) => sum + activity.distanceM, 0);
        const unconfirmed = pending.some(
          (item) => item.pairId === shoe.id && item.day === day,
        );
        return meters > 0
          ? {
              day,
              km: meters / 1000,
              label: `${formatDay(day)} · ${decimal.format(meters / 1000)} km${unconfirmed ? " · à confirmer" : ""}`,
              pending: unconfirmed,
            }
          : { day, km: null, label: null, pending: false };
      }),
    })),
  };
}
