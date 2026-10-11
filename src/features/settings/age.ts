export function ageOn(birthDate: string | null, today: string): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const age = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return age - Number(today.slice(5) < birthDate.slice(5));
}
