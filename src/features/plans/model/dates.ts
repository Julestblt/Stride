export function parseIsoDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number) {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isMonday(iso: string) {
  return parseIsoDate(iso).getUTCDay() === 1;
}

export function mondayOf(iso: string) {
  const day = parseIsoDate(iso).getUTCDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
}

export function isoWeekday(iso: string) {
  const day = parseIsoDate(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

export function daysBetween(from: string, to: string) {
  return Math.round(
    (parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000,
  );
}
