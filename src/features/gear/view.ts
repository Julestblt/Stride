import { formatFrenchDate } from "@/features/onboarding/dates";
import {
  categoryLabels,
  terrainLabels,
  type ShoeSpec,
  type SuggestedField,
} from "./model";
import {
  pairWear,
  replacementDate,
  wearIsHigh,
  type DatedDistance,
  type Wear,
} from "./mileage";

export type ShoeInput = {
  id: string;
  spec: ShoeSpec;
  suggested: SuggestedField[];
  startingDistanceM: number;
  firstUseDate: string;
  retiredOn: string | null;
  garmin: {
    totalDistanceM: number;
    totalActivities: number;
    isDefault?: boolean;
  } | null;
  activities: (DatedDistance & {
    activityId: string;
    name: string | null;
  })[];
};

export type PairCardView = {
  id: string;
  brand: string;
  model: string;
  category: string;
  terrain: string;
  wear: Wear;
  high: boolean;
  totalKm: string;
  lifespanKm: string;
  percent: string;
  remaining: string;
  specs: string;
  lastRun: string | null;
  garminLinked: boolean;
};

const kmFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});
const shortDay = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

export function formatKm(value: number) {
  return kmFormat.format(Math.round(value));
}

export function formatDay(day: string) {
  return shortDay.format(new Date(`${day}T00:00:00Z`));
}

export function theModel(name: string) {
  return /^[aeiouyàâéèêëîïôûùh]/i.test(name) ? `l’${name}` : `la ${name}`;
}

export function modelName(spec: Pick<ShoeSpec, "model" | "version">) {
  return [spec.model, spec.version].filter(Boolean).join(" ");
}

function wearOf(shoe: ShoeInput) {
  return pairWear({
    startingDistanceM: shoe.startingDistanceM,
    garminDistanceM: shoe.garmin?.totalDistanceM ?? 0,
    lifespanKm: shoe.spec.lifespanKm,
  });
}

function remainingText(wear: Wear, replacement: string | null) {
  if (wear.worn) return "Durée de vie atteinte";
  const left = `${formatKm(wear.remainingKm)} km restants`;
  return replacement
    ? `${left} · à remplacer vers le ${formatFrenchDate(replacement)}`
    : left;
}

export function pairCard(shoe: ShoeInput, today: string): PairCardView {
  const wear = wearOf(shoe);
  const replacement = replacementDate(wear, shoe.activities, today);
  const last = shoe.activities[0];
  return {
    id: shoe.id,
    brand: shoe.spec.brand,
    model: modelName(shoe.spec),
    category: `${categoryLabels[shoe.spec.category]} · ${terrainLabels[shoe.spec.terrain]}`,
    terrain: terrainLabels[shoe.spec.terrain],
    wear,
    high: wearIsHigh(wear),
    totalKm: formatKm(wear.totalKm),
    lifespanKm: formatKm(wear.lifespanKm),
    percent: `${wear.percent} %`,
    remaining: remainingText(wear, replacement),
    specs: shoe.spec.description ?? "",
    lastRun: last
      ? `${formatDay(last.day)} · ${last.name ?? "Sortie"} ${decimalFormat.format(last.distanceM / 1000)} km`
      : null,
    garminLinked: shoe.garmin !== null,
  };
}

export type PairListView = {
  active: PairCardView[];
  retired: { id: string; name: string; km: string; retiredOn: string }[];
  totalKm: string;
};

export function pairList(shoes: ShoeInput[], today: string): PairListView {
  const active = shoes.filter((shoe) => shoe.retiredOn === null);
  const cards = active.map((shoe) => pairCard(shoe, today));
  return {
    active: cards,
    retired: shoes
      .filter((shoe) => shoe.retiredOn !== null)
      .map((shoe) => ({
        id: shoe.id,
        name: `${shoe.spec.brand} ${modelName(shoe.spec)}`,
        km: `${formatKm(wearOf(shoe).totalKm)} km`,
        retiredOn: formatFrenchDate(shoe.retiredOn),
      })),
    totalKm: formatKm(cards.reduce((sum, card) => sum + card.wear.totalKm, 0)),
  };
}

export type SpecRow = {
  label: string;
  value: string | null;
  source: "manual" | "estimate";
};

export function specRows(
  spec: ShoeSpec,
  suggested: SuggestedField[],
): SpecRow[] {
  const source = (field: SuggestedField) =>
    suggested.includes(field) ? ("estimate" as const) : ("manual" as const);
  return [
    {
      label: "Type",
      value: categoryLabels[spec.category],
      source: source("category"),
    },
    {
      label: "Terrain",
      value: terrainLabels[spec.terrain],
      source: source("terrain"),
    },
    {
      label: "Durée de vie",
      value: `${formatKm(spec.lifespanKm)} km`,
      source: "manual",
    },
    {
      label: "Pointure",
      value: spec.sizeEu === null ? null : decimalFormat.format(spec.sizeEu),
      source: "manual",
    },
  ];
}

export type PairSummary = { id: string; name: string; line: string };

export function pairSummaries(shoes: ShoeInput[]): PairSummary[] {
  return shoes
    .filter((shoe) => shoe.retiredOn === null)
    .map((shoe) => {
      const longest = Math.max(
        0,
        ...shoe.activities.map((activity) => activity.distanceM),
      );
      return {
        id: shoe.id,
        name: `${shoe.spec.brand} ${modelName(shoe.spec)}`,
        line: [
          `${formatKm(wearOf(shoe).totalKm)} km`,
          longest > 0
            ? `plus longue sortie ${decimalFormat.format(longest / 1000)} km`
            : "aucune sortie enregistrée",
        ].join(" · "),
      };
    });
}
