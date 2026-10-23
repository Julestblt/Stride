import { timeInZones, type ZoneBounds } from "@/features/activities/track";
import { formatInteger } from "./format";
import { addDays } from "./period";

export const intensityDays = 28;
export const easyRunHardShare = 0.1;
export const driftTempoShare = 0.2;

export type IntensityRun = {
  activityId: string;
  day: string;
  histogram: readonly [number, number][];
};

export type IntensityKey = "easy" | "tempo" | "hard";

export type IntensityShare = {
  key: IntensityKey;
  label: string;
  share: number;
  target: string;
  onTarget: boolean;
};

export type IntensityDistribution = {
  runs: number;
  shares: IntensityShare[];
  drift: { count: number; easyRuns: number; bpm: number; note: string } | null;
};

const definitions: {
  key: IntensityKey;
  label: string;
  zones: number[];
  target: string;
  onTarget: (share: number) => boolean;
}[] = [
  {
    key: "easy",
    label: "Facile · Z1–Z2",
    zones: [1, 2],
    target: "cible ≥ 80 %",
    onTarget: (share) => share >= 0.8,
  },
  {
    key: "tempo",
    label: "Tempo · Z3",
    zones: [3],
    target: "cible ≤ 5 %",
    onTarget: (share) => share <= 0.05,
  },
  {
    key: "hard",
    label: "Dur · Z4–Z5",
    zones: [4, 5],
    target: "cible 15 %",
    onTarget: (share) => share >= 0.1 && share <= 0.2,
  },
];

function zoneSeconds(histogram: IntensityRun["histogram"], zones: ZoneBounds) {
  const split = timeInZones(histogram, zones);
  if (!split) return null;
  const total = split.reduce((sum, item) => sum + item.seconds, 0);
  if (total <= 0) return null;
  const of = (wanted: number[]) =>
    split
      .filter((item) => wanted.includes(item.zone))
      .reduce((sum, item) => sum + item.seconds, 0);
  return { total, of };
}

export function intensityDistribution(
  runs: IntensityRun[],
  zones: ZoneBounds | null,
  today: string,
): IntensityDistribution | null {
  if (!zones || zones.length !== 5) return null;
  const from = addDays(today, -(intensityDays - 1));
  const measured = runs
    .filter((run) => run.day >= from && run.day <= today)
    .flatMap((run) => {
      const seconds = zoneSeconds(run.histogram, zones);
      return seconds ? [seconds] : [];
    });
  if (measured.length === 0) return null;
  const total = measured.reduce((sum, run) => sum + run.total, 0);
  const shares = definitions.map((definition) => {
    const share =
      measured.reduce((sum, run) => sum + run.of(definition.zones), 0) / total;
    return {
      key: definition.key,
      label: definition.label,
      share,
      target: definition.target,
      onTarget: definition.onTarget(share),
    };
  });
  const easy = measured.filter(
    (run) => run.of([4, 5]) / run.total <= easyRunHardShare,
  );
  const drifting = easy.filter(
    (run) => run.of([3]) / run.total >= driftTempoShare,
  );
  const bpm = zones[2].lower;
  return {
    runs: measured.length,
    shares,
    drift:
      drifting.length >= 2
        ? {
            count: drifting.length,
            easyRuns: easy.length,
            bpm,
            note: `Tes footings glissent en Z3 : ${formatInteger(drifting.length)} sorties faciles sur ${formatInteger(easy.length)} passent plus de 20 % du temps au-dessus de ${formatInteger(bpm)} bpm.`,
          }
        : null,
  };
}
