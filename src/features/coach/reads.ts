const customLabels: Record<string, string> = {
  read_athlete_context: "Profil et contexte",
  read_health_reports: "Signalements",
  read_active_plan: "Plan",
  read_plan_progress: "Suivi du plan",
  read_plan_history: "Historique du plan",
};

const garminLabels: Record<string, string> = {
  get_activities: "Activités",
  get_activity: "Activité",
  get_activity_splits: "Intervalles",
  get_training_status: "État de forme",
  get_sleep_data: "Sommeil",
  get_hrv_data: "VFC",
  get_training_readiness: "Disponibilité",
  get_rhr_day: "FC au repos",
};

function numberField(input: unknown, key: string) {
  if (typeof input !== "object" || input === null) return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

export function readLabel(
  source: "custom" | "garmin",
  tool: string,
  input: unknown,
): string | null {
  if (source === "garmin") return `Garmin · ${garminLabels[tool] ?? "Données"}`;
  const label = customLabels[tool];
  if (!label) return null;
  const days = numberField(input, "days");
  return days ? `${label} · ${days} jours` : label;
}
