const zenith = 90.833;
const dayMs = 86_400_000;

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function degrees(value: number) {
  return (value * 180) / Math.PI;
}

function julianCentury(epochMs: number) {
  return (epochMs / dayMs + 2440587.5 - 2451545) / 36525;
}

function solarParameters(epochMs: number) {
  const t = julianCentury(epochMs);
  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const center =
    Math.sin(radians(meanAnomaly)) *
      (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(radians(2 * meanAnomaly)) * (0.019993 - 0.000101 * t) +
    Math.sin(radians(3 * meanAnomaly)) * 0.000289;
  const trueLongitude = meanLongitude + center;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude =
    trueLongitude - 0.00569 - 0.00478 * Math.sin(radians(omega));
  const meanObliquity =
    23 +
    (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(radians(omega));
  const declination = degrees(
    Math.asin(
      Math.sin(radians(obliquity)) * Math.sin(radians(apparentLongitude)),
    ),
  );
  const y = Math.tan(radians(obliquity / 2)) ** 2;
  const equationOfTime =
    4 *
    degrees(
      y * Math.sin(2 * radians(meanLongitude)) -
        2 * eccentricity * Math.sin(radians(meanAnomaly)) +
        4 *
          eccentricity *
          y *
          Math.sin(radians(meanAnomaly)) *
          Math.cos(2 * radians(meanLongitude)) -
        0.5 * y * y * Math.sin(4 * radians(meanLongitude)) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * radians(meanAnomaly)),
    );
  return { declination, equationOfTime };
}

export type SunTimes = { sunrise: number | null; sunset: number | null };

export function sunTimes(
  utcDate: string,
  latitude: number,
  longitude: number,
): SunTimes {
  const midnight = Date.parse(`${utcDate}T00:00:00Z`);
  const estimate = (rising: boolean, noonGuess: number) => {
    const { declination, equationOfTime } = solarParameters(noonGuess);
    const cosHour =
      Math.cos(radians(zenith)) /
        (Math.cos(radians(latitude)) * Math.cos(radians(declination))) -
      Math.tan(radians(latitude)) * Math.tan(radians(declination));
    if (cosHour < -1 || cosHour > 1) return null;
    const hourAngle = degrees(Math.acos(cosHour));
    const minutes =
      720 -
      4 * (longitude + (rising ? hourAngle : -hourAngle)) -
      equationOfTime;
    return midnight + minutes * 60_000;
  };
  const noon = midnight + (720 - 4 * longitude) * 60_000;
  const refine = (rising: boolean) => {
    const first = estimate(rising, noon);
    return first === null ? null : estimate(rising, first);
  };
  return { sunrise: refine(true), sunset: refine(false) };
}

function offsetMinutes(epochMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epochMs));
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const local = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
  return Math.round((local - Math.floor(epochMs / 1000) * 1000) / 60_000);
}

export function zonedEpoch(
  date: string,
  minutesOfDay: number,
  timeZone: string,
) {
  const guess = Date.parse(`${date}T00:00:00Z`) + minutesOfDay * 60_000;
  const first = guess - offsetMinutes(guess, timeZone) * 60_000;
  return guess - offsetMinutes(first, timeZone) * 60_000;
}

export function localMinutes(epochMs: number, timeZone: string) {
  const local = epochMs + offsetMinutes(epochMs, timeZone) * 60_000;
  return Math.floor((((local % dayMs) + dayMs) % dayMs) / 60_000);
}

export function localDate(epochMs: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(
    new Date(epochMs),
  );
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * dayMs)
    .toISOString()
    .slice(0, 10);
}
