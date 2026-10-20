export type PairDistances = {
  startingDistanceM: number;
  garminDistanceM: number;
  lifespanKm: number;
};

export type DatedDistance = { day: string; distanceM: number };

export type Wear = {
  totalKm: number;
  startingKm: number;
  garminKm: number;
  lifespanKm: number;
  percent: number;
  remainingKm: number;
  worn: boolean;
};

const projectionWeeks = 8;
const warnPercent = 70;

export function pairWear({
  startingDistanceM,
  garminDistanceM,
  lifespanKm,
}: PairDistances): Wear {
  const startingKm = startingDistanceM / 1000;
  const garminKm = Math.max(garminDistanceM, 0) / 1000;
  const totalKm = startingKm + garminKm;
  return {
    totalKm,
    startingKm,
    garminKm,
    lifespanKm,
    percent: Math.round((totalKm / lifespanKm) * 100),
    remainingKm: Math.max(lifespanKm - totalKm, 0),
    worn: totalKm >= lifespanKm,
  };
}

export function wearIsHigh(wear: Wear) {
  return wear.percent >= warnPercent;
}

export function startingDistanceFor(
  currentKm: number,
  garminDistanceM: number,
) {
  return Math.max(Math.round(currentKm * 1000 - garminDistanceM), 0);
}

export function garminLimitMeters(
  lifespanKm: number,
  startingDistanceM: number,
) {
  return Math.max(lifespanKm * 1000 - startingDistanceM, 1000);
}

function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weeklyKm(activities: DatedDistance[], today: string) {
  const from = addDays(today, -projectionWeeks * 7);
  const total = activities
    .filter(({ day }) => day > from && day <= today)
    .reduce((sum, { distanceM }) => sum + distanceM, 0);
  return total / 1000 / projectionWeeks;
}

export function replacementDate(
  wear: Wear,
  activities: DatedDistance[],
  today: string,
): string | null {
  if (wear.worn) return today;
  const perWeek = weeklyKm(activities, today);
  if (perWeek < 1) return null;
  return addDays(today, Math.ceil((wear.remainingKm / perWeek) * 7));
}
