import { formatDecimal, formatInteger } from "./format";
import { loadZone, type HealthDay, type HealthModel } from "./health";
import { addDays } from "./period";
import type { Checkin, Legs, Readiness, RecoveryModel } from "./recovery";
import { formatSleep, legsLabels } from "./recovery-view";

export type FactorTone = "danger" | "warning" | "muted" | "success";

export type ReadinessFactor = {
  key: "sleep" | "load" | "legs" | "hrv" | "resting";
  label: string;
  value: string;
  tone: FactorTone;
  reason: string;
};

export type TodaySession = {
  sessionKey: string;
  title: string;
  hard: boolean;
};

export type ReadinessAdvice = {
  text: string;
  lighter: boolean;
};

export type ReadinessSummary = {
  score: number;
  level: string;
  gap: string | null;
  tone: "success" | "warning" | "danger";
};

const levelLabels: Record<Readiness["level"], string> = {
  high: "Élevé",
  moderate: "Modéré",
  low: "Bas",
  poor: "Faible",
};

const levelTones: Record<Readiness["level"], ReadinessSummary["tone"]> = {
  high: "success",
  moderate: "warning",
  low: "warning",
  poor: "danger",
};

export function readinessSummary(
  readiness: Readiness | null,
): ReadinessSummary | null {
  if (!readiness) return null;
  const gap =
    readiness.average === null
      ? null
      : Math.round(readiness.today - readiness.average);
  return {
    score: readiness.today,
    level: levelLabels[readiness.level],
    gap:
      gap === null
        ? null
        : gap === 0
          ? "dans ta moyenne"
          : `${formatInteger(Math.abs(gap))} ${gap < 0 ? "sous" : "au-dessus de"} ta moyenne`,
    tone: levelTones[readiness.level],
  };
}

function belowUsual(readiness: Readiness) {
  return (
    readiness.trend === "watch" ||
    readiness.level === "low" ||
    readiness.level === "poor"
  );
}

export function readinessAdvice(
  readiness: Readiness | null,
  session: TodaySession | null,
): ReadinessAdvice | null {
  if (!readiness) return null;
  const low = belowUsual(readiness);
  if (!session)
    return {
      text:
        readiness.level === "poor"
          ? "Laisse ton corps récupérer aujourd’hui."
          : low
            ? "Privilégie une sortie facile si tu t’entraînes."
            : "Pas de séance prévue : profite de ta forme sans forcer.",
      lighter: false,
    };
  if (!session.hard)
    return {
      text: low
        ? "Séance facile : garde-la vraiment à l’aise, quitte à la raccourcir."
        : "Séance facile : déroule-la à l’aise.",
      lighter: false,
    };
  if (readiness.level === "poor")
    return {
      text: "Remplace-la par un footing facile ou du repos : ton corps n’est pas prêt pour l’intensité.",
      lighter: true,
    };
  if (low)
    return {
      text: "Faisable : garde un échauffement long et coupe la dernière fraction si l’allure ne vient pas.",
      lighter: true,
    };
  return {
    text: "Tu es prêt : déroule la séance comme prévue.",
    lighter: false,
  };
}

const toneRank: Record<FactorTone, number> = {
  danger: 0,
  warning: 1,
  muted: 2,
  success: 3,
};

const hundredths = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function signed(value: number, unit = "") {
  return `${value > 0 ? "+" : value < 0 ? "−" : "±"}${formatInteger(Math.abs(value))}${unit}`;
}

function span(range: { low: number; high: number }) {
  return range.low === range.high
    ? `${range.low}`
    : `${range.low}–${range.high}`;
}

const legsTones: Record<Legs, FactorTone> = {
  heavy: "warning",
  normal: "muted",
  fresh: "success",
};

const loadValues = {
  low: "basse",
  productive: "productive",
  high: "élevée",
} as const;

export function readinessFactors(model: RecoveryModel): ReadinessFactor[] {
  const { sleep, load, checkin, hrv, restingHeartRate } = model;
  const factors: ReadinessFactor[] = [];
  if (sleep) {
    const gap =
      sleep.average === null
        ? null
        : Math.round((sleep.last - sleep.average) / 60);
    factors.push({
      key: "sleep",
      label: `Sommeil · ${formatSleep(sleep.last)}`,
      value: gap === null ? "—" : `${signed(gap)} min`,
      tone:
        sleep.trend === "investigate"
          ? "danger"
          : sleep.trend === "watch"
            ? "warning"
            : gap !== null && gap >= 30
              ? "success"
              : "muted",
      reason:
        sleep.average === null
          ? "moyenne en cours de calcul"
          : `vs ta moyenne 14 nuits${sleep.streak >= 2 ? ` · ${formatInteger(sleep.streak)}e nuit courte` : ""}`,
    });
  }
  if (load) {
    const zone = loadZone(load.ratio);
    const rising = load.average !== null && load.ratio - load.average >= 0.1;
    factors.push({
      key: "load",
      label: `Charge · ratio ${hundredths.format(load.ratio)}`,
      value: rising && zone === "productive" ? "en hausse" : loadValues[zone],
      tone: zone !== "productive" ? "warning" : rising ? "warning" : "muted",
      reason:
        load.average === null
          ? "aiguë sur chronique Garmin"
          : `moyenne 14 j : ${formatDecimal(load.average)}`,
    });
  }
  if (checkin?.legs)
    factors.push({
      key: "legs",
      label: `Jambes · « ${legsLabels[checkin.legs].toLowerCase()} »`,
      value: "toi",
      tone: legsTones[checkin.legs],
      reason: "ton ressenti de ce matin",
    });
  if (hrv)
    factors.push({
      key: "hrv",
      label: `VFC · ${formatInteger(hrv.last)} ms`,
      value:
        hrv.position === "below"
          ? "basse"
          : hrv.position === "above"
            ? "haute"
            : "normale",
      tone:
        hrv.position === "below"
          ? hrv.streak >= 2
            ? "danger"
            : "warning"
          : hrv.position === null
            ? "muted"
            : "success",
      reason: hrv.range
        ? `${hrv.position === "below" ? "sous" : hrv.position === "above" ? "au-dessus de" : "dans"} ta plage ${span(hrv.range)} ms`
        : "plage en cours de calcul",
    });
  if (restingHeartRate) {
    const gap =
      restingHeartRate.median === null
        ? null
        : Math.round(restingHeartRate.last - restingHeartRate.median);
    factors.push({
      key: "resting",
      label: `FC repos · ${formatInteger(restingHeartRate.last)} bpm`,
      value: restingHeartRate.position === "above" ? "élevée" : "normale",
      tone:
        restingHeartRate.position === "above"
          ? "warning"
          : restingHeartRate.position === null
            ? "muted"
            : "success",
      reason:
        gap === null
          ? "habitude en cours de calcul"
          : `${signed(gap)} vs médiane 28 j`,
    });
  }
  return factors
    .map((factor, index) => ({ factor, index }))
    .sort(
      (a, b) =>
        toneRank[a.factor.tone] - toneRank[b.factor.tone] || a.index - b.index,
    )
    .map(({ factor }) => factor);
}

export type CheckinDay = {
  day: string;
  weekday: string;
  legs: Legs | null;
};

const weekdayInitial = new Intl.DateTimeFormat("fr-FR", {
  weekday: "narrow",
  timeZone: "UTC",
});

export const checkinHistoryDays = 7;

export function checkinHistory(
  checkins: Checkin[],
  today: string,
): { days: CheckinDay[]; label: string } {
  const byDay = new Map(checkins.map((checkin) => [checkin.day, checkin]));
  const days = Array.from({ length: checkinHistoryDays }, (_, index) => {
    const day = addDays(today, index - checkinHistoryDays + 1);
    return {
      day,
      weekday: weekdayInitial
        .format(new Date(`${day}T00:00:00Z`))
        .toUpperCase(),
      legs: byDay.get(day)?.legs ?? null,
    };
  });
  const counts = (["fresh", "normal", "heavy"] as const).flatMap((legs) => {
    const count = days.filter((day) => day.legs === legs).length;
    return count
      ? [
          `${legsLabels[legs].toLowerCase()} ${formatInteger(count)} jour${count > 1 ? "s" : ""}`,
        ]
      : [];
  });
  return {
    days,
    label: counts.length
      ? `Jambes : ${counts.join(", ")}`
      : "Jambes : aucun ressenti saisi sur 7 jours",
  };
}

export type BodyNight = {
  day: string;
  seconds: number | null;
  deep: number | null;
  light: number | null;
  rem: number | null;
  short: boolean;
};

export type BodyNights = {
  nights: BodyNight[];
  average: number | null;
  score: number | null;
  shortCount: number;
  summary: string;
};

export const shortNightGap = 45 * 60;

export function bodyNights(
  days: HealthDay[],
  end: string,
  length: number,
): BodyNights {
  const byDay = new Map(days.map((item) => [item.day, item]));
  const window = Array.from(
    { length },
    (_, index) => byDay.get(addDays(end, index - length + 1)) ?? null,
  );
  const measured = window.flatMap((item) => (item?.sleep ? [item.sleep] : []));
  const scores = window.flatMap((item) =>
    item?.sleepScore ? [item.sleepScore] : [],
  );
  const average = measured.length
    ? measured.reduce((sum, value) => sum + value, 0) / measured.length
    : null;
  const score = scores.length
    ? scores.reduce((sum, value) => sum + value, 0) / scores.length
    : null;
  const nights = window.map((item, index) => {
    const seconds = item?.sleep ?? null;
    return {
      day: addDays(end, index - length + 1),
      seconds,
      deep: item?.deep ?? null,
      light: item?.light ?? null,
      rem: item?.rem ?? null,
      short:
        seconds !== null &&
        average !== null &&
        measured.length >= 7 &&
        seconds < average - shortNightGap,
    };
  });
  const shortCount = nights.filter((night) => night.short).length;
  return {
    nights,
    average,
    score,
    shortCount,
    summary: [
      average === null ? null : `moy. ${formatSleep(average)}`,
      score === null ? null : `score ${formatInteger(score)}`,
      shortCount
        ? `${formatInteger(shortCount)} nuit${shortCount > 1 ? "s" : ""} courte${shortCount > 1 ? "s" : ""}`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export type BodyKpi = {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: "warning" | "success" | "muted";
};

function windowMean(
  days: HealthDay[],
  pick: (day: HealthDay) => number | null,
  from: string,
  to: string,
) {
  const values = days.flatMap((item) => {
    const value = pick(item);
    return item.day >= from && item.day <= to && value !== null ? [value] : [];
  });
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

export function bodyKpis(model: HealthModel, days: HealthDay[]): BodyKpi[] {
  const kpis: BodyKpi[] = [];
  const { energy, stress, load, today, chartDays } = model;
  if (energy) {
    const usual = windowMean(
      days,
      (item) => item.batteryWake,
      addDays(energy.wakeDay, -14),
      addDays(energy.wakeDay, -1),
    );
    const gap = usual === null ? null : Math.round(energy.wake - usual);
    kpis.push({
      key: "battery",
      label: "Body Battery au réveil",
      value: formatInteger(energy.wake),
      detail:
        gap === null
          ? "Garmin"
          : gap === 0
            ? "dans ta moyenne"
            : `${signed(gap)} vs moyenne`,
      tone: gap !== null && gap <= -10 ? "warning" : "muted",
    });
  }
  if (stress)
    kpis.push({
      key: "stress",
      label: "Stress moyen",
      value: formatInteger(stress.value),
      detail: stressBand(stress.value),
      tone: stress.value > 50 ? "warning" : "muted",
    });
  const steps = windowMean(
    days,
    (item) => item.steps,
    addDays(today, -chartDays),
    addDays(today, -1),
  );
  if (steps !== null)
    kpis.push({
      key: "steps",
      label: "Pas / jour",
      value: formatInteger(steps),
      detail: `moy. ${formatInteger(chartDays)} j`,
      tone: "muted",
    });
  if (load?.recoveryHours != null)
    kpis.push({
      key: "recovery",
      label: "Récup. conseillée",
      value: `${formatInteger(load.recoveryHours)} h`,
      detail: "Garmin",
      tone: "muted",
    });
  return kpis;
}

function stressBand(value: number) {
  if (value <= 25) return "Calme";
  if (value <= 50) return "Bas";
  if (value <= 75) return "Modéré";
  return "Élevé";
}
