import type { HealthModel } from "./health";
import { formatClock, type HealthDayModel } from "./health-day";
import { formatStage, type HealthKpi } from "./health-view";
import { formatSleep } from "./recovery-view";

const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export type HealthDayView = {
  kpis: HealthKpi[];
  headline: string;
  paragraph: string;
  night: {
    title: string;
    stages: { key: string; label: string; seconds: number; swatch: string }[];
    figures: { label: string; value: string; detail: string }[];
    note: string | null;
  } | null;
};

function sleepSeconds(model: HealthDayModel) {
  const sleep = model.sleep;
  if (!sleep) return null;
  const parts = [sleep.deepSeconds, sleep.lightSeconds, sleep.remSeconds];
  return parts.every((part) => part !== null)
    ? parts.reduce((sum, part) => sum! + part!, 0)!
    : (sleep.end - sleep.start) / 1000 - (sleep.awakeSeconds ?? 0);
}

function minutes(ms: number) {
  const total = Math.round(ms / 60_000);
  return total < 60
    ? `${total} min`
    : `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`;
}

export function healthDayView(
  day: HealthDayModel,
  context: HealthModel,
  nightTitle: string,
): HealthDayView {
  const slept = sleepSeconds(day);
  const average = context.sleep?.average ?? null;
  const short = slept !== null && average !== null && slept < average - 45 * 60;
  const hrvNight = day.sleep?.hrvAverage ?? null;
  const hrvRange = context.hrv?.range ?? null;
  const restingMedian = context.restingHeartRate?.median ?? null;
  const battery = day.latestBattery?.[1] ?? day.summary.bodyBatteryLatest;
  const wake = day.summary.bodyBatteryWake;
  const steps = day.summary.stepsTotal;
  const goal = day.summary.stepsGoal;
  const peak = day.stressPeak;
  const kpis: HealthKpi[] = [
    slept === null
      ? {
          key: "sleep",
          label: "Sommeil",
          value: "—",
          detail: "Nuit non mesurée",
          tone: "muted",
        }
      : {
          key: "sleep",
          label: "Sommeil",
          value: formatSleep(slept),
          detail: `${formatClock(day.sleep!.start)} → ${formatClock(day.sleep!.end)}${day.sleep!.awakeCount ? ` · ${integer.format(day.sleep!.awakeCount)} éveil${day.sleep!.awakeCount > 1 ? "s" : ""}` : ""}`,
          tone: short ? "warning" : "success",
        },
    hrvNight === null
      ? {
          key: "hrv",
          label: "VFC de la nuit",
          value: "—",
          detail: "Non mesurée",
          tone: "muted",
        }
      : {
          key: "hrv",
          label: "VFC de la nuit",
          value: integer.format(hrvNight),
          unit: "ms",
          detail: hrvRange
            ? `${hrvNight < hrvRange.low ? "Sous ta plage" : hrvNight > hrvRange.high ? "Au-dessus de ta plage" : "Dans ta plage"} ${hrvRange.low} – ${hrvRange.high}`
            : "Plage en cours de calcul",
          tone: hrvRange && hrvNight < hrvRange.low ? "warning" : "success",
        },
    day.restingHeartRate === null
      ? {
          key: "resting",
          label: "FC au repos",
          value: "—",
          detail: "Non mesurée",
          tone: "muted",
        }
      : {
          key: "resting",
          label: "FC au repos",
          value: integer.format(day.restingHeartRate),
          unit: "bpm",
          detail:
            restingMedian === null
              ? "Médiane en cours de calcul"
              : `${day.restingHeartRate - restingMedian > 0 ? "+" : day.restingHeartRate - restingMedian < 0 ? "−" : "±"}${integer.format(Math.abs(day.restingHeartRate - restingMedian))} vs ta médiane`,
          tone:
            restingMedian !== null && day.restingHeartRate > restingMedian + 2
              ? "warning"
              : "success",
        },
    battery === null
      ? {
          key: "battery",
          label: "Body Battery",
          value: "—",
          detail: "Non transmis",
          tone: "muted",
        }
      : {
          key: "battery",
          label: "Body Battery",
          value: integer.format(battery),
          unit: "/100",
          detail:
            wake === null
              ? "Dernière mesure"
              : `${integer.format(wake)} au réveil · ${battery - wake >= 0 ? "+" : "−"}${integer.format(Math.abs(battery - wake))}`,
          tone: battery < 30 ? "warning" : "success",
        },
    day.summary.stressAverage === null
      ? {
          key: "stress",
          label: "Stress",
          value: "—",
          detail: "Non mesuré",
          tone: "muted",
        }
      : {
          key: "stress",
          label: "Stress",
          value: integer.format(day.summary.stressAverage),
          unit: "/100",
          detail: peak
            ? `Pic ${formatClock(peak.start)} – ${formatClock(peak.end)}`
            : "Pas de pic prolongé",
          tone: peak ? "warning" : "success",
        },
    steps === null
      ? {
          key: "steps",
          label: "Pas",
          value: "—",
          detail: "Non mesurés",
          tone: "muted",
        }
      : {
          key: "steps",
          label: "Pas",
          value: integer.format(steps),
          detail: goal
            ? `Objectif ${integer.format(goal)} · ${percent.format((steps / goal) * 100)} %`
            : "Aucun objectif Garmin",
          tone: goal && steps >= goal ? "success" : "muted",
        },
  ];
  const headline =
    !day.sleep && day.slots.length === 0
      ? "Garmin n’a pas encore de mesure pour cette journée."
      : short && peak
        ? "Nuit courte, journée chargée."
        : short
          ? "Nuit courte, journée calme."
          : peak
            ? "Bonne nuit, mais un pic de stress dans la journée."
            : "Une journée équilibrée.";
  const sentences: string[] = [];
  if (battery !== null && wake !== null)
    sentences.push(
      battery <= wake
        ? `Ton Body Battery est à ${integer.format(battery)}, ${integer.format(wake - battery)} points de moins qu’au réveil.`
        : `Ton Body Battery est à ${integer.format(battery)}, ${integer.format(battery - wake)} points de plus qu’au réveil.`,
    );
  if (slept !== null)
    sentences.push(
      average === null
        ? `Tu as dormi ${formatSleep(slept)}.`
        : `Tu as dormi ${formatSleep(slept)}, contre ${formatSleep(average)} en moyenne.`,
    );
  if (peak)
    sentences.push(
      `Le moment le plus chargé : ${minutes(peak.end - peak.start)} de stress élevé entre ${formatClock(peak.start)} et ${formatClock(peak.end)} (moyenne ${integer.format(peak.average)}).`,
    );
  if (day.calmPause?.gain != null && day.calmPause.gain > 0)
    sentences.push(
      `Ta pause de ${formatClock(day.calmPause.start)} a fait remonter ton Body Battery de ${integer.format(day.calmPause.gain)} point${day.calmPause.gain > 1 ? "s" : ""}.`,
    );
  if (steps !== null)
    sentences.push(
      goal
        ? `${integer.format(steps)} pas, ${percent.format((steps / goal) * 100)} % de ton objectif.`
        : `${integer.format(steps)} pas.`,
    );
  const sleep = day.sleep;
  const stages =
    sleep &&
    sleep.deepSeconds !== null &&
    sleep.lightSeconds !== null &&
    sleep.remSeconds !== null
      ? [
          {
            key: "deep",
            label: "Profond",
            seconds: sleep.deepSeconds,
            swatch: "bg-provider",
          },
          {
            key: "light",
            label: "Léger",
            seconds: sleep.lightSeconds,
            swatch: "bg-dim",
          },
          {
            key: "rem",
            label: "Paradoxal",
            seconds: sleep.remSeconds,
            swatch: "bg-zone-3",
          },
          {
            key: "awake",
            label: "Éveil",
            seconds: sleep.awakeSeconds ?? 0,
            swatch: "bg-danger",
          },
        ]
      : [];
  const restorative =
    slept && sleep?.deepSeconds != null && sleep.remSeconds != null
      ? (sleep.deepSeconds + sleep.remSeconds) / slept
      : null;
  return {
    kpis,
    headline,
    paragraph: sentences.join(" "),
    night: sleep
      ? {
          title: nightTitle,
          stages,
          figures: [
            {
              label: "VFC nocturne",
              value: hrvNight === null ? "—" : `${integer.format(hrvNight)} ms`,
              detail: hrvRange
                ? `plage ${hrvRange.low} – ${hrvRange.high}`
                : "moyenne de la nuit",
            },
            {
              label: "Respiration",
              value:
                sleep.respirationAverage === null
                  ? "—"
                  : decimal.format(sleep.respirationAverage),
              detail: "rpm · moyenne",
            },
            {
              label: "SpO₂",
              value:
                sleep.spo2Average === null
                  ? "—"
                  : `${integer.format(sleep.spo2Average)} %`,
              detail:
                sleep.spo2Lowest === null
                  ? "moyenne"
                  : `moyenne · min ${integer.format(sleep.spo2Lowest)} %`,
            },
            {
              label: "Score",
              value: sleep.score === null ? "—" : integer.format(sleep.score),
              detail: "/100 · Garmin",
            },
          ],
          note:
            restorative === null
              ? null
              : `Profond et paradoxal représentent ${percent.format(restorative * 100)} % de la nuit (${formatStage((sleep.deepSeconds ?? 0) + (sleep.remSeconds ?? 0))}). Réveil à ${formatClock(sleep.end)}.`,
        }
      : null,
  };
}
