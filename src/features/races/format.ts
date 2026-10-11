const decimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formatKm(meters: number) {
  return decimal.format(meters / 1000);
}

export function formatInteger(value: number) {
  return integer.format(Math.round(value));
}

export function formatDecimal(value: number) {
  return decimal.format(value);
}

export function formatMeters(value: number) {
  return `${integer.format(Math.round(value))} m`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatClock(minutesOfDay: number) {
  const total = ((Math.round(minutesOfDay) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours}h` : `${hours}h${pad(rest)}`;
}

export function formatElapsed(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

export function formatPace(secondsPerKm: number) {
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

export function formatMargin(seconds: number) {
  const sign = seconds < 0 ? "−" : "+";
  return `${sign}${formatElapsed(Math.abs(seconds))}`;
}

export function parseClock(value: string) {
  const match = /^(\d{1,2})[:hH](\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

export function parseHoursMinutes(value: string) {
  const minuteMatch = /^(\d{1,3})\s*min$/i.exec(value.trim());
  if (minuteMatch) return Number(minuteMatch[1]) * 60;
  const match = /^(\d{1,3})\s*[:hH]\s*(\d{0,2})$/.exec(value.trim());
  if (!match) return null;
  const minutes = match[2] ? Number(match[2]) : 0;
  return minutes < 60 ? (Number(match[1]) * 60 + minutes) * 60 : null;
}

export function clockFromSql(value: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes)
    ? hours * 60 + minutes
    : null;
}

export function clockToSql(minutes: number) {
  return `${formatClock(minutes)}:00`;
}

export function parseKm(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized) * 1000;
}
