import "server-only";
import { z } from "zod";
import { addDays, localDate, localMinutes } from "@/features/races/sun";
import {
  summarizeForecast,
  summarizeNormals,
  type RaceWeather,
  type SlotRequest,
  type WeatherSlot,
} from "@/features/races/weather";

const forecastUrl = "https://api.open-meteo.com/v1/forecast";
const archiveUrl = "https://archive-api.open-meteo.com/v1/archive";
const forecastHorizonDays = 15;
const normalYears = 10;
const windowDays = 3;
const timeoutMs = 8000;

const hourlySchema = z.object({
  time: z.array(z.number()),
  temperature_2m: z.array(z.number().nullable()),
  weather_code: z.array(z.number().nullable()),
});
const forecastHourly = hourlySchema.extend({
  apparent_temperature: z.array(z.number().nullable()),
  precipitation_probability: z.array(z.number().nullable()),
  wind_speed_10m: z.array(z.number().nullable()),
  wind_direction_10m: z.array(z.number().nullable()),
  wind_gusts_10m: z.array(z.number().nullable()),
});
const archiveHourly = hourlySchema.extend({
  precipitation: z.array(z.number().nullable()),
});

async function getJson(url: string, revalidate: number) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "Stride/0.1" },
    next: { revalidate },
  });
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
  return response.json() as Promise<unknown>;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function nearestHour(times: number[], epochMs: number) {
  const target = epochMs / 1000;
  let best = 0;
  times.forEach((time, index) => {
    if (Math.abs(time - target) < Math.abs(times[best] - target)) best = index;
  });
  return Math.abs(times[best] - target) <= 5400 ? best : -1;
}

async function forecast(slots: SlotRequest[]): Promise<WeatherSlot[] | null> {
  const locations = [
    ...new Set(slots.map((slot) => `${round(slot.lat)},${round(slot.lon)}`)),
  ];
  const first = Math.min(...slots.map((slot) => slot.epochMs));
  const last = Math.max(...slots.map((slot) => slot.epochMs));
  const params = new URLSearchParams({
    latitude: locations.map((location) => location.split(",")[0]).join(","),
    longitude: locations.map((location) => location.split(",")[1]).join(","),
    hourly:
      "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    timezone: "GMT",
    timeformat: "unixtime",
    start_date: new Date(first - 3_600_000).toISOString().slice(0, 10),
    end_date: new Date(last + 3_600_000).toISOString().slice(0, 10),
  });
  const body = await getJson(`${forecastUrl}?${params}`, 3600);
  const responses = (Array.isArray(body) ? body : [body]).map(
    (item) => z.object({ hourly: forecastHourly }).parse(item).hourly,
  );
  const result: WeatherSlot[] = [];
  for (const slot of slots) {
    const hourly =
      responses[locations.indexOf(`${round(slot.lat)},${round(slot.lon)}`)];
    const index = hourly ? nearestHour(hourly.time, slot.epochMs) : -1;
    const temperature = index >= 0 ? hourly.temperature_2m[index] : null;
    if (index < 0 || temperature === null) return null;
    result.push({
      ...slot,
      temperature,
      precipitationProbability: hourly.precipitation_probability[index] ?? 0,
      code: hourly.weather_code[index] ?? 3,
      apparentTemperature: hourly.apparent_temperature[index],
      windKmh: hourly.wind_speed_10m[index],
      windDirection: hourly.wind_direction_10m[index],
      gustsKmh: hourly.wind_gusts_10m[index],
    });
  }
  return result;
}

function mode(values: number[]) {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ??
    3
  );
}

async function normals(
  slots: SlotRequest[],
  date: string,
  timeZone: string,
  now: Date,
): Promise<{
  slots: WeatherSlot[];
  rainyDayShare: number;
  years: [number, number];
} | null> {
  const latitude =
    slots.reduce((sum, slot) => sum + slot.lat, 0) / slots.length;
  const longitude =
    slots.reduce((sum, slot) => sum + slot.lon, 0) / slots.length;
  const lastYear = now.getUTCFullYear() - 1;
  const years = Array.from(
    { length: normalYears },
    (_, index) => lastYear - index,
  );
  const monthDay = date.slice(4);
  const samples = await Promise.all(
    years.map(async (year) => {
      const center = `${year}${monthDay === "-02-29" ? "-02-28" : monthDay}`;
      const params = new URLSearchParams({
        latitude: round(latitude).toString(),
        longitude: round(longitude).toString(),
        hourly: "temperature_2m,precipitation,weather_code",
        timezone: "GMT",
        timeformat: "unixtime",
        start_date: addDays(center, -windowDays - 1),
        end_date: addDays(center, windowDays + 2),
      });
      const body = await getJson(`${archiveUrl}?${params}`, 604_800);
      return z.object({ hourly: archiveHourly }).parse(body).hourly;
    }),
  );
  const offsets = slots.map((slot) => {
    const day = localDate(slot.epochMs, timeZone);
    return Math.round(
      (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) /
        86_400_000,
    );
  });
  const buckets = slots.map(() => ({
    temperatures: [] as number[],
    wet: 0,
    total: 0,
    codes: [] as number[],
  }));
  const dayTotals = new Map<string, number>();
  samples.forEach((hourly, yearIndex) => {
    const center = `${years[yearIndex]}${monthDay === "-02-29" ? "-02-28" : monthDay}`;
    hourly.time.forEach((time, index) => {
      const epoch = time * 1000;
      const day = localDate(epoch, timeZone);
      const dayOffset = Math.round(
        (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${center}T00:00:00Z`)) /
          86_400_000,
      );
      const precipitation = hourly.precipitation[index] ?? 0;
      if (Math.abs(dayOffset) <= windowDays)
        dayTotals.set(
          `${yearIndex}:${day}`,
          (dayTotals.get(`${yearIndex}:${day}`) ?? 0) + precipitation,
        );
      const minutes = localMinutes(epoch, timeZone);
      slots.forEach((slot, slotIndex) => {
        const relative = dayOffset - offsets[slotIndex];
        if (Math.abs(relative) > windowDays) return;
        if (
          Math.floor(minutes / 60) !==
          Math.floor((((slot.clockMinutes % 1440) + 1440) % 1440) / 60)
        )
          return;
        const temperature = hourly.temperature_2m[index];
        if (temperature === null) return;
        const bucket = buckets[slotIndex];
        bucket.temperatures.push(temperature);
        bucket.total += 1;
        if (precipitation >= 0.1) bucket.wet += 1;
        const code = hourly.weather_code[index];
        if (code !== null) bucket.codes.push(code);
      });
    });
  });
  if (buckets.some((bucket) => bucket.total === 0)) return null;
  const days = [...dayTotals.values()];
  return {
    slots: slots.map((slot, index) => {
      const bucket = buckets[index];
      return {
        ...slot,
        temperature:
          bucket.temperatures.reduce((sum, value) => sum + value, 0) /
          bucket.total,
        precipitationProbability: Math.round((bucket.wet / bucket.total) * 100),
        code: mode(
          bucket.codes.map((code) =>
            code >= 51 && bucket.wet / bucket.total < 0.3 ? 3 : code,
          ),
        ),
        apparentTemperature: null,
        windKmh: null,
        windDirection: null,
        gustsKmh: null,
      };
    }),
    rainyDayShare: days.length
      ? days.filter((total) => total >= 1).length / days.length
      : 0,
    years: [years[years.length - 1], years[0]],
  };
}

const updated = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export async function raceWeather({
  slots,
  date,
  timeZone,
  now,
}: {
  slots: SlotRequest[];
  date: string;
  timeZone: string;
  now: Date;
}): Promise<RaceWeather | null> {
  if (slots.length === 0) return null;
  const forecastFrom = addDays(date, -forecastHorizonDays);
  const today = localDate(now.getTime(), timeZone);
  const inRange = today >= forecastFrom && today <= addDays(date, 1);
  if (inRange) {
    const values = await forecast(slots).catch(() => null);
    if (values) {
      const summary = summarizeForecast(values);
      return {
        mode: "forecast",
        slots: values,
        ...summary,
        source: `Open-Meteo · mis à jour ${updated.format(now).replace(".", "")}`,
        rainyDayShare: null,
        forecastFrom,
      };
    }
  }
  const values = await normals(slots, date, timeZone, now).catch(() => null);
  if (!values) return null;
  return {
    mode: "normals",
    slots: values.slots,
    ...summarizeNormals(values.slots, values.rainyDayShare),
    source: `Normales ${values.years[0]}–${values.years[1]} · Open-Meteo · consulté ${updated.format(now).replace(".", "")}`,
    rainyDayShare: values.rainyDayShare,
    forecastFrom,
  };
}
