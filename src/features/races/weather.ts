export type WeatherIcon =
  "clear" | "partly" | "cloudy" | "fog" | "rain" | "showers" | "snow" | "storm";

export type SlotRequest = {
  elapsedSeconds: number;
  epochMs: number;
  clockMinutes: number;
  distanceM: number;
  lat: number;
  lon: number;
  night: boolean;
};

export type WeatherSlot = SlotRequest & {
  temperature: number;
  precipitationProbability: number;
  code: number;
  apparentTemperature: number | null;
  windKmh: number | null;
  windDirection: number | null;
  gustsKmh: number | null;
};

export type RaceWeather = {
  mode: "forecast" | "normals";
  slots: WeatherSlot[];
  title: string;
  detail: string;
  facts: string[];
  source: string;
  rainyDayShare: number | null;
  forecastFrom: string;
};

const slotSteps = [1, 2, 3, 4, 6];
const maximumSlots = 11;

export function slotTimes(startMinutes: number, durationSeconds: number) {
  const hours = durationSeconds / 3600;
  const step = slotSteps.find((value) => hours / value < maximumSlots) ?? 6;
  const first = Math.floor(startMinutes / 60 / step) * step * 60 - startMinutes;
  const times: number[] = [];
  for (
    let offset = Math.max(0, first);
    offset * 60 <= durationSeconds + step * 1800;
    offset += step * 60
  )
    times.push(offset * 60);
  if (first < 0) times.unshift(0);
  return times
    .map((seconds) => Math.min(seconds, durationSeconds))
    .filter((seconds, index, all) => all.indexOf(seconds) === index)
    .slice(0, maximumSlots + 1);
}

export function iconFor(code: number): WeatherIcon {
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 80 && code <= 82) return "showers";
  if (code >= 51) return "rain";
  return "cloudy";
}

export function wet(code: number) {
  const icon = iconFor(code);
  return (
    icon === "rain" || icon === "showers" || icon === "storm" || icon === "snow"
  );
}

const cardinals = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

export function cardinal(degrees: number) {
  return cardinals[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function period(clockMinutes: number) {
  const hour = Math.floor((((clockMinutes % 1440) + 1440) % 1440) / 60);
  if (hour >= 5 && hour < 12) return "le matin";
  if (hour >= 12 && hour < 18) return "l’après-midi";
  if (hour >= 18 && hour < 22) return "en soirée";
  return "la nuit";
}

function temperatureWord(max: number) {
  if (max < 10) return "Froid";
  if (max < 17) return "Frais";
  if (max < 25) return "Doux";
  return "Chaud";
}

function skyWord(slots: WeatherSlot[]) {
  const icons = slots.map((slot) => iconFor(slot.code));
  const cloudy = icons.filter(
    (icon) => icon === "cloudy" || icon === "fog",
  ).length;
  const clear = icons.filter((icon) => icon === "clear").length;
  if (cloudy >= slots.length / 2) return "souvent nuageux";
  if (clear >= slots.length / 2) return "plutôt dégagé";
  return "ciel variable";
}

const temperatureFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

export function formatTemperature(value: number) {
  return temperatureFormat.format(Math.round(value) === 0 ? 0 : value);
}

export function temperatureRange(slots: WeatherSlot[]) {
  const values = slots.map((slot) => slot.temperature);
  return {
    min: Math.round(Math.min(...values)),
    max: Math.round(Math.max(...values)),
  };
}

export function rainWindows(slots: WeatherSlot[], threshold = 50) {
  const windows: { from: WeatherSlot; to: WeatherSlot }[] = [];
  slots.forEach((slot) => {
    if (slot.precipitationProbability < threshold) return;
    const last = windows[windows.length - 1];
    if (last && slots.indexOf(last.to) === slots.indexOf(slot) - 1)
      last.to = slot;
    else windows.push({ from: slot, to: slot });
  });
  return windows;
}

export function rainName(code: number) {
  const icon = iconFor(code);
  if (icon === "storm") return "Orages";
  if (icon === "snow") return "Neige";
  if (icon === "showers") return "Averses";
  return "Pluie";
}

function share(value: number) {
  if (value <= 0.05) return "rarement de pluie";
  return `pluie 1 jour sur ${Math.max(2, Math.round(1 / value))}`;
}

export function summarizeNormals(slots: WeatherSlot[], rainyDayShare: number) {
  const { min, max } = temperatureRange(slots);
  return {
    title: `${temperatureWord(max)}, ${skyWord(slots)}`,
    detail: `${min} → ${max} °C · ${share(rainyDayShare)}`,
    facts: [] as string[],
  };
}

export function summarizeForecast(slots: WeatherSlot[]) {
  const { min, max } = temperatureRange(slots);
  const windows = rainWindows(slots);
  const wettest = [...slots].sort(
    (a, b) => b.precipitationProbability - a.precipitationProbability,
  )[0];
  const start = slots[0];
  const title = windows.length
    ? `${rainName(windows[0].from.code)} ${period(windows[0].from.clockMinutes)}`
    : `${temperatureWord(max)}, ${skyWord(slots)}`;
  const feels =
    start.apparentTemperature !== null
      ? ` · ressenti ${formatTemperature(start.apparentTemperature)} °C au départ`
      : "";
  const windiest = [...slots].sort(
    (a, b) => (b.windKmh ?? 0) - (a.windKmh ?? 0),
  )[0];
  const facts = [
    `${Math.round(wettest.precipitationProbability)} % à ${Math.floor((((wettest.clockMinutes % 1440) + 1440) % 1440) / 60)}h`,
    windiest.windKmh !== null
      ? `${Math.round(windiest.windKmh)} km/h${windiest.windDirection !== null ? ` ${cardinal(windiest.windDirection)}` : ""}`
      : null,
    windiest.gustsKmh !== null
      ? `rafales ${Math.round(windiest.gustsKmh)}`
      : null,
  ].filter((fact): fact is string => fact !== null);
  return { title, detail: `${min} → ${max} °C${feels}`, facts };
}

export type Glyph = "moon" | "sun" | "partly" | "cloud" | "rain";

export function glyphFor(code: number, night: boolean): Glyph {
  const icon = iconFor(code);
  if (
    icon === "rain" ||
    icon === "showers" ||
    icon === "storm" ||
    icon === "snow"
  )
    return "rain";
  if (night) return "moon";
  if (icon === "clear") return "sun";
  if (icon === "partly") return "partly";
  return "cloud";
}
