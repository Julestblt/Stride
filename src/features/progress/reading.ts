import { coachRequestHref } from "@/features/coach/request";
import { shareLabel } from "@/features/insights/facts";
import { isRunning, isTrailRun, type ProgressActivity } from "./history";
import type { LoadChart } from "./load";
import type { FitnessMeasures } from "./measures";
import {
  formatDayMonth,
  formatDecimal,
  formatMonth,
  formatPace,
  formatInteger,
} from "./format";
import { daysBetween } from "./period";

export type FitnessReading = { headline: string; summary: string };

const significantGap = 0.15;
const nearPeak = 0.02;

function weeklyHours(
  activities: ProgressActivity[],
  start: string,
  today: string,
) {
  const inRange = activities.filter(
    (activity) => activity.day >= start && activity.day <= today,
  );
  const seconds = inRange.reduce(
    (sum, activity) => sum + (activity.duration ?? 0),
    0,
  );
  const weeks = Math.max(1, (daysBetween(start, today) + 1) / 7);
  const running = inRange.filter((activity) => isRunning(activity.type));
  const runningSeconds = running.reduce(
    (sum, activity) => sum + (activity.duration ?? 0),
    0,
  );
  const trailSeconds = running
    .filter((activity) => isTrailRun(activity.type))
    .reduce((sum, activity) => sum + (activity.duration ?? 0), 0);
  return {
    hours: seconds / 3600 / weeks,
    trailShare: runningSeconds > 0 ? trailSeconds / runningSeconds : 0,
    count: inRange.length,
  };
}

function headline(
  measures: FitnessMeasures,
  load: LoadChart | null,
  periodPhrase: string,
) {
  const { efficiency } = measures;
  if (efficiency.trend === "improving") return "Ton endurance progresse.";
  if (efficiency.trend === "watch") return "Ton efficacité aérobie recule.";
  if (load && load.gapToPeak >= significantGap)
    return `Ta condition a reculé depuis son pic du ${formatDayMonth(load.peak.day)}.`;
  if (load && load.points[0].condition > 0) {
    const growth = load.current.condition / load.points[0].condition - 1;
    if (growth >= 0.1)
      return `Ta condition monte depuis ${formatMonth(load.start)}.`;
  }
  return `Ta forme est stable sur ${periodPhrase}.`;
}

export function fitnessReading({
  activities,
  measures,
  load,
  start,
  today,
  periodPhrase,
}: {
  activities: ProgressActivity[];
  measures: FitnessMeasures;
  load: LoadChart | null;
  start: string;
  today: string;
  periodPhrase: string;
}): FitnessReading {
  const volume = weeklyHours(activities, start, today);
  const hasMeasures = [
    measures.efficiency,
    measures.climbing,
    measures.drift,
  ].some((measure) => measure.value !== null);
  if (volume.count === 0 && !load && !hasMeasures)
    return {
      headline: "Pas encore assez d’historique pour lire ta forme.",
      summary:
        "Stride affichera tes tendances dès que Garmin aura importé des sorties et des charges d’entraînement sur la période.",
    };
  const sentences: string[] = [];
  if (volume.count > 0) {
    const trail =
      volume.trailShare >= 0.2
        ? `, dont ${shareLabel(volume.trailShare)} du temps de course en trail`
        : "";
    sentences.push(
      `${capitalize(periodPhrase)} à ${formatDecimal(volume.hours)} h d’entraînement par semaine en moyenne${trail}.`,
    );
  }
  const { efficiency, referenceHeartRate } = measures;
  if (
    efficiency.value !== null &&
    efficiency.baseline !== null &&
    referenceHeartRate !== null
  ) {
    const delta = Math.round(efficiency.baseline - efficiency.value);
    if (efficiency.trend === "improving")
      sentences.push(
        `À ${referenceHeartRate} bpm sur le plat, tu cours ${delta} s/km plus vite qu’en ${formatMonth(efficiency.since!)}.`,
      );
    else if (efficiency.trend === "watch")
      sentences.push(
        `À ${referenceHeartRate} bpm sur le plat, tu cours ${-delta} s/km moins vite qu’en ${formatMonth(efficiency.since!)}.`,
      );
    else
      sentences.push(
        `Ton allure à ${referenceHeartRate} bpm sur le plat reste stable.`,
      );
  }
  return {
    headline: headline(measures, load, periodPhrase),
    summary: sentences.slice(0, 3).join(" "),
  };
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function loadNote(load: LoadChart) {
  const recent =
    load.recentChange === null
      ? ""
      : load.recentChange >= 0.03
        ? " Elle remonte depuis deux semaines."
        : load.recentChange <= -0.03
          ? " Elle baisse depuis deux semaines."
          : " Elle est stable depuis deux semaines.";
  const fatigue =
    load.current.fatigue > load.current.condition * 1.3
      ? " Ta fatigue de la semaine dépasse nettement ta condition : surveille ta récupération."
      : "";
  if (load.gapToPeak <= nearPeak)
    return `Ta condition est à son plus haut niveau sur la période.${fatigue}`;
  return `Ta condition est ${formatInteger(load.gapToPeak * 100)} % sous son pic du ${formatDayMonth(load.peak.day)}.${recent}${fatigue}`;
}

export function coachNote(measures: FitnessMeasures) {
  const { drift, efficiency, referenceHeartRate } = measures;
  if (drift.trend === "investigate" || drift.trend === "watch") {
    const recent = drift.runs.slice(-5);
    const high = recent.filter((run) => run.drift > 5).length;
    const scope =
      recent.length === 1
        ? `sur ta dernière sortie longue, en ${formatMonth(recent[0].day)}`
        : `sur ${high} de tes ${recent.length} dernières sorties longues depuis ${formatMonth(recent[0].day)}`;
    return `La dérive cardiaque dépasse 5 % ${scope}. Avant d’y voir un manque de condition, regarde la chaleur et ta prise de glucides ${recent.length === 1 ? "ce jour-là" : "sur ces sorties"}.`;
  }
  if (
    efficiency.trend === "improving" &&
    efficiency.value !== null &&
    efficiency.baseline !== null &&
    referenceHeartRate !== null
  )
    return `À ${referenceHeartRate} bpm sur le plat, ton allure est passée de ${formatPace(efficiency.baseline)} à ${formatPace(efficiency.value)} /km depuis ${formatMonth(efficiency.since!)}.`;
  return null;
}

export type LoadAction = { label: string; href: string };

export type LoadAdvice = { text: string; actions: LoadAction[] };

export type LoadPlanContext = {
  currentWeekStart: string;
  nextLightWeekStart: string | null;
  currentLight: boolean;
} | null;

export function loadAdvice(load: LoadChart, plan: LoadPlanContext): LoadAdvice {
  const { current, overloadDays } = load;
  if (overloadDays === 0 || current.condition <= 0)
    return { text: loadNote(load), actions: [] };
  const gap = Math.round((current.fatigue / current.condition - 1) * 100);
  const since =
    overloadDays === 1
      ? "aujourd’hui"
      : `depuis ${formatInteger(overloadDays)} jours`;
  const planSentence = !plan
    ? " Garde des séances faciles jusqu’à ce qu’elle repasse sous ta condition."
    : plan.currentLight
      ? " Ta semaine allégée tombe au bon moment."
      : plan.nextLightWeekStart
        ? ` Ton plan prévoit une semaine allégée à partir du ${formatDayMonth(plan.nextLightWeekStart)}.`
        : " Ton plan ne prévoit pas de semaine allégée d’ici là.";
  return {
    text: `Fatigue ${formatInteger(gap)} % au-dessus de ta condition ${since}.${planSentence}`,
    actions: [
      ...(plan
        ? [
            {
              label: "Voir la semaine",
              href: `/plan?week=${plan.currentWeekStart}`,
            },
          ]
        : []),
      {
        label: "Alléger ma semaine",
        href: coachRequestHref(
          `Ma fatigue dépasse ma condition de ${formatInteger(gap)} % ${since}. Peux-tu alléger ma semaine ?`,
        ),
      },
    ],
  };
}
