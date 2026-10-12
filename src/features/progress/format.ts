const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const monthName = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const dayMonthShort = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const monthShort = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  timeZone: "UTC",
});

function date(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatPace(secondsPerKm: number) {
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

export function formatClock(seconds: number) {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(total % 60)}`
    : `${minutes}:${pad(total % 60)}`;
}

export function formatHoursMinutes(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
}

export function formatInteger(value: number) {
  return integer.format(Math.round(value));
}

export function formatDecimal(value: number) {
  return decimal.format(value);
}

export function formatHours(seconds: number) {
  return `${decimal.format(seconds / 3600)} h`;
}

export function formatKilometers(meters: number) {
  return `${integer.format(Math.round(meters / 1000))} km`;
}

export function formatMonth(day: string) {
  return monthName.format(date(day));
}

export function formatMonthYear(day: string) {
  return monthYear.format(date(day));
}

export function formatDayMonth(day: string) {
  return dayMonth.format(date(day));
}

export function formatDayMonthShort(day: string) {
  return dayMonthShort.format(date(day));
}

export function formatMonthShort(day: string) {
  return monthShort.format(date(day)).replace(".", "");
}

export function ofMonth(day: string) {
  const month = formatMonth(day);
  return /^[aeiouy]/.test(month) ? `d’${month}` : `de ${month}`;
}

export function formatRecordDate(day: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date(day));
}
