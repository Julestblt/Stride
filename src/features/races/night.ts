import { addDays, sunTimes, zonedEpoch } from "./sun";

export type NightWindow = { fromSeconds: number; toSeconds: number };

export type NightPlan = {
  sunrise: number | null;
  sunset: number | null;
  windows: NightWindow[];
  totalSeconds: number;
};

export function nightPlan({
  date,
  startMinutes,
  durationSeconds,
  latitude,
  longitude,
  timeZone,
}: {
  date: string;
  startMinutes: number;
  durationSeconds: number;
  latitude: number;
  longitude: number;
  timeZone: string;
}): NightPlan {
  const start = zonedEpoch(date, startMinutes, timeZone);
  const end = start + durationSeconds * 1000;
  const days = Math.ceil(durationSeconds / 86_400) + 2;
  const suns = Array.from({ length: days + 1 }, (_, index) =>
    sunTimes(addDays(date, index - 1), latitude, longitude),
  );
  const windows: NightWindow[] = [];
  for (let index = 0; index < suns.length - 1; index += 1) {
    const dusk = suns[index].sunset;
    const dawn = suns[index + 1].sunrise;
    if (dusk === null || dawn === null) continue;
    const from = Math.max(dusk, start);
    const to = Math.min(dawn, end);
    if (to > from)
      windows.push({
        fromSeconds: Math.round((from - start) / 1000),
        toSeconds: Math.round((to - start) / 1000),
      });
  }
  const sunrise =
    suns
      .map((sun) => sun.sunrise)
      .find((value) => value !== null && value >= start) ?? null;
  const sunset =
    suns
      .map((sun) => sun.sunset)
      .find((value) => value !== null && value >= start) ?? null;
  return {
    sunrise,
    sunset,
    windows,
    totalSeconds: windows.reduce(
      (sum, window) => sum + window.toSeconds - window.fromSeconds,
      0,
    ),
  };
}

export function isNightAt(plan: NightPlan, seconds: number) {
  return plan.windows.some(
    (window) => seconds >= window.fromSeconds && seconds <= window.toSeconds,
  );
}

export function nightOverlap(
  plan: NightPlan,
  fromSeconds: number,
  toSeconds: number,
) {
  return plan.windows.reduce(
    (sum, window) =>
      sum +
      Math.max(
        0,
        Math.min(window.toSeconds, toSeconds) -
          Math.max(window.fromSeconds, fromSeconds),
      ),
    0,
  );
}
