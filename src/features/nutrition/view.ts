import type {
  NutritionDayResult,
  NutritionDayType,
  NutritionMissingField,
  NutritionRange,
  NutritionResult,
} from "./calculator";

export type NutritionSessionLabel = {
  date: string;
  title: string;
  durationSeconds: number;
};

export const dayTypeLabels: Record<NutritionDayType, string> = {
  rest: "Repos",
  easy: "Facile",
  moderate: "Modérée",
  long_or_hard: "Longue ou intense",
  pre_race: "Veille de course",
  race: "Course",
};

const dayTypeReasons: Record<NutritionDayType, string> = {
  rest: "Journée sans séance : les glucides restent à 3–5 g par kg.",
  easy: "Séance facile : les glucides restent à 3–5 g par kg.",
  moderate: "Séance modérée : les glucides montent à 5–7 g par kg.",
  long_or_hard:
    "Journée longue ou intense : les glucides montent à 6–10 g par kg.",
  pre_race:
    "Veille de course longue : la charge glucidique monte à 8–12 g par kg.",
  race: "Jour de course : la charge glucidique reste haute et le ravitaillement compte autant que les repas.",
};

const missingLabels: Record<NutritionMissingField, string> = {
  birthDate: "Date de naissance",
  sex: "Sexe",
  heightCm: "Taille",
  weightKg: "Poids",
};

const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const weekdayDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

export function formatKcal(value: number) {
  return integer.format(value).replace(/\u202f/g, "\u00a0");
}

export function formatRange({ min, max }: NutritionRange, digits = 0) {
  const format = digits ? decimal : integer;
  return `${format.format(min)}–${format.format(max)}`;
}

export function formatDayLabel(iso: string) {
  return weekdayDate.format(new Date(`${iso}T00:00:00Z`));
}

export function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

function sessionLine(sessions: NutritionSessionLabel[], date: string) {
  const day = sessions.filter((session) => session.date === date);
  if (!day.length) return "Repos";
  return day
    .map((session) =>
      session.durationSeconds
        ? `${session.title} · ${formatDuration(session.durationSeconds)}`
        : session.title,
    )
    .join(" + ");
}

export type NutritionTodayView = {
  dateLabel: string;
  headline: string;
  summary: string;
  energy: { value: string; detail: string };
  carbs: { value: string; detail: string };
  protein: { value: string; detail: string };
  fat: { value: string; detail: string };
  fueling: { perHour: string; total: string; duration: string } | null;
  recovery: { withinHours: number; perIntake: string; intakes: string } | null;
  method: { label: string; value: string; estimated: boolean }[];
  neatEstimated: boolean;
};

export type NutritionRowView = {
  date: string;
  dateLabel: string;
  today: boolean;
  session: string;
  dayType: NutritionDayType;
  dayTypeLabel: string;
  energy: string;
  carbs: string;
  protein: string;
};

export type NutritionView =
  | { status: "missing"; missing: string[] }
  | {
      status: "ready";
      today: NutritionTodayView;
      days: NutritionRowView[];
    };

function todayView(
  result: NutritionDayResult,
  sessions: NutritionSessionLabel[],
): NutritionTodayView {
  const { energy, inputsUsed: inputs } = result;
  const fueling = result.fueling[0] ?? null;
  const neatEstimated = inputs.neat.source === "default";
  const sessionDistance = inputs.sessions.reduce(
    (sum, session) => sum + (session.distanceKm ?? 0),
    0,
  );
  const sessionGain = inputs.sessions.reduce(
    (sum, session) => sum + (session.elevationGainM ?? 0),
    0,
  );
  const line = sessionLine(sessions, result.date);
  return {
    dateLabel: formatDayLabel(result.date),
    headline: `Environ ${formatKcal(energy.displayKcal)} kcal aujourd’hui.`,
    summary: `${dayTypeReasons[result.dayType]} Les chiffres suivent tes séances prévues, pas la montre d’hier.`,
    energy: {
      value: formatKcal(energy.displayKcal),
      detail: `Repos ${formatKcal(energy.restingKcal)} · activité ${formatKcal(energy.neatKcal)} · séances ${formatKcal(energy.trainingKcal)}`,
    },
    carbs: {
      value: formatRange(result.carbs.grams),
      detail: `${formatRange(result.carbs.gPerKg)} g/kg · ${dayTypeLabels[result.dayType].toLowerCase()}`,
    },
    protein: {
      value: formatRange(result.protein.grams),
      detail: `${formatRange(result.protein.gPerKg, 1)} g/kg · ${formatRange(result.protein.intakes)} prises`,
    },
    fat: {
      value: `≈ ${integer.format(result.fat.grams)}`,
      detail: `Le reste · au moins ${decimal.format(0.8)} g/kg`,
    },
    fueling: fueling
      ? {
          perHour: formatRange(fueling.gramsPerHour),
          total: formatRange(fueling.totalGrams),
          duration: formatDuration(fueling.durationSeconds),
        }
      : null,
    recovery:
      result.protein.recoveryIntakeWithinHours === null
        ? null
        : {
            withinHours: result.protein.recoveryIntakeWithinHours,
            perIntake: formatRange(result.protein.gramsPerIntake),
            intakes: formatRange(result.protein.intakes),
          },
    method: [
      {
        label: `Métabolisme de repos · ${inputs.ageYears} ans, ${integer.format(inputs.weightKg)} kg, ${integer.format(inputs.heightCm)} cm`,
        value: `${formatKcal(energy.restingKcal)} kcal`,
        estimated: false,
      },
      {
        label: "Digestion · 10 % du repos",
        value: `${formatKcal(energy.digestionKcal)} kcal`,
        estimated: false,
      },
      {
        label: "Activité hors entraînement",
        value: `${formatKcal(energy.neatKcal)} kcal`,
        estimated: neatEstimated,
      },
      {
        label:
          line === "Repos"
            ? "Séances prévues · aucune"
            : sessionDistance
              ? `Séances prévues · ${decimal.format(sessionDistance)} km, ${integer.format(sessionGain)} m D+`
              : `Séances prévues · ${line}`,
        value: `${formatKcal(energy.trainingKcal)} kcal`,
        estimated: result.estimations.some(
          (estimation) => typeof estimation.target === "number",
        ),
      },
    ],
    neatEstimated,
  };
}

export function nutritionView(
  results: NutritionResult[],
  sessions: NutritionSessionLabel[],
  today: string,
): NutritionView {
  const first = results[0];
  if (!first || !first.ok)
    return {
      status: "missing",
      missing:
        first && !first.ok
          ? first.missing.map((field) => missingLabels[field])
          : [],
    };
  return {
    status: "ready",
    today: todayView(first, sessions),
    days: results.flatMap((result) =>
      result.ok
        ? [
            {
              date: result.date,
              dateLabel: formatDayLabel(result.date),
              today: result.date === today,
              session: sessionLine(sessions, result.date),
              dayType: result.dayType,
              dayTypeLabel: dayTypeLabels[result.dayType],
              energy: formatKcal(result.energy.displayKcal),
              carbs: `${formatRange(result.carbs.grams)} g`,
              protein: `${formatRange(result.protein.grams)} g`,
            },
          ]
        : [],
    ),
  };
}
