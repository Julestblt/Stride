export const productCarbs = { gel: 25, compote: 15, bar: 25 } as const;
export const caffeineGelThreshold = 0.5;

export type NutritionSettings = {
  carbsPerHourG: number;
  waterMlPerHour: number;
  sodiumMgPerHour: number;
  alarmMinutes: number;
  nightCaffeine: boolean;
};

export type NutritionItems = {
  gels: number;
  compotes: number;
  bars: number;
  caffeineGels: number;
};

export type NutritionSegment = {
  movingSeconds: number;
  carbsG: number;
  waterL: number;
  items: NutritionItems;
};

export function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

export function segmentItems(
  carbsG: number,
  hours: number,
  night: boolean,
  caffeine: boolean,
) {
  const bars = hours >= 1 ? 1 : 0;
  const compotes = Math.round((carbsG * 0.25) / productCarbs.compote);
  const remaining =
    carbsG - bars * productCarbs.bar - compotes * productCarbs.compote;
  let gels = Math.max(0, Math.round(remaining / productCarbs.gel));
  const caffeineGels = night && caffeine && gels > 0 ? 1 : 0;
  gels -= caffeineGels;
  return { gels, compotes, bars, caffeineGels };
}

export function nutritionSegment(
  movingSeconds: number,
  nightFraction: number,
  settings: NutritionSettings,
): NutritionSegment {
  const hours = movingSeconds / 3600;
  const carbsG = roundTo(hours * settings.carbsPerHourG, 5);
  return {
    movingSeconds,
    carbsG,
    waterL: Math.round((hours * settings.waterMlPerHour) / 100) / 10,
    items: segmentItems(
      carbsG,
      hours,
      nightFraction >= caffeineGelThreshold,
      settings.nightCaffeine,
    ),
  };
}

export function nutritionTotals(
  segments: NutritionSegment[],
  settings: NutritionSettings,
) {
  const seconds = segments.reduce(
    (sum, segment) => sum + segment.movingSeconds,
    0,
  );
  const carbsG = segments.reduce((sum, segment) => sum + segment.carbsG, 0);
  return {
    carbsG,
    gelEquivalents: Math.round(carbsG / productCarbs.gel),
    waterL: Math.round(((seconds / 3600) * settings.waterMlPerHour) / 1000),
  };
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

export function describeItems(items: NutritionItems) {
  return [
    items.gels > 0 && plural(items.gels, "gel", "gels"),
    items.compotes > 0 && plural(items.compotes, "compote", "compotes"),
    items.bars > 0 && plural(items.bars, "barre", "barres"),
    items.caffeineGels > 0 &&
      plural(items.caffeineGels, "gel caféiné", "gels caféinés"),
  ]
    .filter(Boolean)
    .join(" · ");
}
