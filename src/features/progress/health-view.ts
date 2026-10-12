import type { Trend } from "@/components/stride/marks";
import { formatInteger } from "./format";
import type { HealthLoad, HealthModel, HealthRange } from "./health";
import { formatSleep } from "./recovery-view";

export type Tone = "success" | "warning" | "danger" | "muted";

export type HealthKpi = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  detail: string;
  tone: Tone;
};

export type Takeaway = { title: string; text: string; trend: Trend };

export type HealthPageView = {
  readingLabel: string;
  headline: string;
  paragraph: string;
  takeaways: Takeaway[];
  kpis: HealthKpi[];
  sleep: {
    status: string;
    tone: Tone;
    note: string | null;
    stages: { key: string; label: string; seconds: number; swatch: string }[];
  } | null;
  heart: { status: string; tone: Tone; note: string } | null;
  energy: { status: string; tone: Tone; note: string } | null;
  load: {
    status: string;
    tone: Tone;
    note: string;
    focus: { label: string; value: number; swatch: string }[];
  } | null;
  footnote: string;
};

const hundredths = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formatStage(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : formatSleep(seconds);
}

export function formatRatio(value: number) {
  return hundredths.format(value);
}

function signed(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : "±"}${Math.abs(rounded)}`;
}

function rangeText(range: { low: number; high: number }) {
  return `${range.low} – ${range.high}`;
}

const zoneLabels: Record<HealthLoad["zone"], string> = {
  low: "Charge basse",
  productive: "Zone productive",
  high: "Charge élevée",
};

export function stressLabel(value: number) {
  if (value <= 25) return "Journée calme";
  if (value <= 50) return "Stress faible";
  if (value <= 75) return "Stress modéré";
  return "Stress élevé";
}

function rangeSentence(name: string, signal: HealthRange, unit: string) {
  if (!signal.range)
    return `${name} : ${formatInteger(signal.last)} ${unit}, plage habituelle en cours de calcul.`;
  if (signal.position === "below")
    return `${name} (${formatInteger(signal.last)} ${unit}) est sous ta plage habituelle de ${signal.range.low} à ${signal.range.high}.`;
  if (signal.position === "above")
    return `${name} (${formatInteger(signal.last)} ${unit}) est au-dessus de ta plage habituelle de ${signal.range.low} à ${signal.range.high}.`;
  return `${name} (${formatInteger(signal.last)} ${unit}) reste dans ta plage habituelle de ${signal.range.low} à ${signal.range.high}.`;
}

function headline(model: HealthModel) {
  const { sleep, hrv, restingHeartRate, load } = model;
  if (!sleep && !hrv && !load)
    return "Pas encore assez de données Garmin pour lire ta santé.";
  const shortSleep = sleep?.trend === "watch";
  const hrvLow = hrv?.position === "below";
  const restingHigh = restingHeartRate?.position === "above";
  if (shortSleep && load?.zone === "high")
    return "La charge monte et ton sommeil ne suit pas.";
  if (shortSleep)
    return "Tu récupères bien de la charge, mais ton sommeil ne suit plus.";
  if (hrvLow && restingHigh)
    return "VFC en baisse, FC au repos en hausse : ton corps fatigue.";
  if (hrvLow) return "Ta VFC décroche alors que tu dors bien.";
  if (load?.zone === "high") return "Ta charge dépasse ce que ta base absorbe.";
  if (load?.zone === "low") return "Tu récupères, la charge est basse.";
  return "Ton corps encaisse bien la charge.";
}

function sleepTakeaway(model: HealthModel): Takeaway | null {
  const { sleep } = model;
  if (!sleep) return null;
  const gap = sleep.average === null ? null : sleep.last - sleep.average;
  const restorative =
    sleep.restorativeShare === null
      ? ""
      : ` Profond et paradoxal : ${percent.format(sleep.restorativeShare * 100)} % de la nuit.`;
  return {
    title: "Sommeil",
    trend: sleep.trend,
    text:
      gap === null
        ? `${formatSleep(sleep.last)} cette nuit.${restorative}`
        : gap < 0
          ? `${formatSleep(sleep.last)}, ${formatSleep(-gap)} sous ta moyenne.${restorative}`
          : `${formatSleep(sleep.last)}, ${formatSleep(gap)} au-dessus de ta moyenne.${restorative}`,
  };
}

function hrvTakeaway(model: HealthModel): Takeaway | null {
  const { hrv } = model;
  if (!hrv) return null;
  const range = hrv.range;
  if (!range)
    return {
      title: "VFC",
      trend: "stable",
      text: `${formatInteger(hrv.last)} ms. Il faut une semaine de nuits pour établir ta plage.`,
    };
  if (hrv.position === "below")
    return {
      title: "VFC",
      trend: "watch",
      text: `${formatInteger(hrv.last)} ms, ${formatInteger(range.low - hrv.last)} ms sous le bas de ta plage. Une nuit basse, c’est normal ; plusieurs d’affilée, non.`,
    };
  return {
    title: "VFC",
    trend: hrv.position === "above" ? "improving" : "stable",
    text: `${formatInteger(hrv.last)} ms, ${hrv.position === "above" ? "au-dessus de" : "dans"} ta plage de ${rangeText(range)} ms.`,
  };
}

function loadTakeaway(model: HealthModel): Takeaway | null {
  const { load } = model;
  if (!load) return null;
  return {
    title: "Charge d’entraînement",
    trend:
      load.zone === "productive"
        ? "improving"
        : load.zone === "high"
          ? "watch"
          : "stable",
    text:
      load.zone === "productive"
        ? `Ratio ${formatRatio(load.ratio)}, dans la zone productive (0,8 – 1,5).`
        : load.zone === "high"
          ? `Ratio ${formatRatio(load.ratio)}, au-dessus de 1,5 : la charge de la semaine dépasse nettement ta base.`
          : `Ratio ${formatRatio(load.ratio)}, sous 0,8 : semaine plus légère que ta base.`,
  };
}

function paragraph(model: HealthModel) {
  const { sleep, hrv, restingHeartRate, load, readingDays } = model;
  const sentences: string[] = [];
  if (sleep?.readingAverage != null)
    sentences.push(
      `Sur ${readingDays} jours, tu dors ${formatSleep(sleep.readingAverage)} en moyenne.`,
    );
  if (sleep)
    sentences.push(
      sleep.shortest
        ? `Cette nuit, ${formatSleep(sleep.last)}, c’est la plus courte de la quinzaine.`
        : `Cette nuit : ${formatSleep(sleep.last)}.`,
    );
  if (hrv) sentences.push(rangeSentence("Ta VFC", hrv, "ms"));
  if (restingHeartRate?.median != null) {
    const delta = restingHeartRate.last - restingHeartRate.median;
    sentences.push(
      restingHeartRate.position === "above"
        ? `Ta FC au repos remonte à ${formatInteger(restingHeartRate.last)} bpm (${signed(delta)} par rapport à ta médiane).`
        : `Ta FC au repos reste à ${formatInteger(restingHeartRate.last)} bpm.`,
    );
  }
  if (load)
    sentences.push(
      `Ton ratio de charge aiguë sur chronique est de ${formatRatio(load.ratio)} (${zoneLabels[load.zone].toLowerCase()}).`,
    );
  if (sleep?.trend === "watch" && hrv?.position !== "below")
    sentences.push(
      "Rien d’inquiétant sur une seule nuit. Ce qui compte, c’est que ça ne s’installe pas.",
    );
  return sentences.join(" ");
}

function kpis(model: HealthModel): HealthKpi[] {
  const { sleep, hrv, restingHeartRate, energy, stress, load } = model;
  const missing = (key: string, label: string): HealthKpi => ({
    key,
    label,
    value: "—",
    detail: "Non transmis par Garmin",
    tone: "muted",
  });
  return [
    sleep
      ? {
          key: "sleep",
          label: "Sommeil",
          value: formatSleep(sleep.last),
          detail:
            sleep.average === null
              ? "Moyenne en cours de calcul"
              : sleep.last < sleep.average
                ? `${formatSleep(sleep.average - sleep.last)} sous ta moyenne`
                : `${formatSleep(sleep.last - sleep.average)} au-dessus de ta moyenne`,
          tone: sleep.trend === "watch" ? "warning" : "success",
        }
      : missing("sleep", "Sommeil"),
    hrv
      ? {
          key: "hrv",
          label: "VFC",
          value: formatInteger(hrv.last),
          unit: "ms",
          detail: hrv.range
            ? `${hrv.position === "below" ? "Sous ta plage" : hrv.position === "above" ? "Au-dessus de ta plage" : "Dans ta plage"} ${rangeText(hrv.range)}`
            : "Plage en cours de calcul",
          tone: hrv.position === "below" ? "warning" : "success",
        }
      : missing("hrv", "VFC"),
    restingHeartRate
      ? {
          key: "resting",
          label: "FC au repos",
          value: formatInteger(restingHeartRate.last),
          unit: "bpm",
          detail:
            restingHeartRate.median === null
              ? "Médiane en cours de calcul"
              : `${signed(restingHeartRate.last - restingHeartRate.median)} vs ta médiane`,
          tone: restingHeartRate.position === "above" ? "warning" : "success",
        }
      : missing("resting", "FC au repos"),
    energy
      ? {
          key: "battery",
          label: "Body Battery",
          value: formatInteger(energy.wake),
          unit: "/100",
          detail:
            energy.charged === null
              ? "Au réveil"
              : `Au réveil, recharge ${signed(energy.charged)}`,
          tone: energy.wake < 50 ? "warning" : "success",
        }
      : missing("battery", "Body Battery"),
    stress
      ? {
          key: "stress",
          label: "Stress",
          value: formatInteger(stress.value),
          unit: "/100",
          detail: stressLabel(stress.value),
          tone: stress.value > 50 ? "warning" : "success",
        }
      : missing("stress", "Stress"),
    load
      ? {
          key: "load",
          label: "Charge",
          value: formatRatio(load.ratio),
          detail: zoneLabels[load.zone],
          tone:
            load.zone === "high"
              ? "warning"
              : load.zone === "low"
                ? "muted"
                : "success",
        }
      : missing("load", "Charge"),
  ];
}

function heart(model: HealthModel): HealthPageView["heart"] {
  const { hrv, restingHeartRate } = model;
  if (!hrv) return null;
  const hrvLow = hrv.position === "below";
  const restingHigh = restingHeartRate?.position === "above";
  return {
    status: hrvLow
      ? "Sous ta plage"
      : hrv.position === "above"
        ? "Au-dessus de ta plage"
        : "Dans ta plage",
    tone: hrvLow ? "warning" : "success",
    note:
      hrvLow && restingHigh
        ? "Les deux signaux vont dans le même sens : VFC en baisse et FC au repos en hausse. Si ça dure deux nuits, allège l’intensité."
        : hrvLow
          ? "Seule ta VFC décroche ; ta FC au repos reste dans l’habitude. Une nuit basse ne suffit pas à conclure."
          : restingHigh
            ? "Ta FC au repos remonte alors que ta VFC tient : surveille ton sommeil et ta charge ces prochains jours."
            : "VFC et FC au repos restent dans tes plages habituelles.",
  };
}

function energy(model: HealthModel): HealthPageView["energy"] {
  const { energy: battery } = model;
  if (!battery) return null;
  const partial =
    battery.charged !== null &&
    battery.usualCharged !== null &&
    battery.charged < battery.usualCharged * 0.8;
  const parts: string[] = [];
  if (battery.charged !== null)
    parts.push(
      battery.usualCharged === null
        ? `Recharge de ${signed(battery.charged)} cette nuit.`
        : `Recharge de ${signed(battery.charged)} cette nuit, contre ${signed(battery.usualCharged)} d’habitude.`,
    );
  if (battery.stress !== null)
    parts.push(
      `Hier, stress moyen ${formatInteger(battery.stress)} : ${stressLabel(battery.stress).toLowerCase()}.`,
    );
  parts.push(`Tu démarres à ${formatInteger(battery.wake)} sur 100.`);
  return {
    status: partial ? "Recharge partielle" : "Bonne recharge",
    tone: partial ? "warning" : "success",
    note: parts.join(" "),
  };
}

function loadCard(model: HealthModel): HealthPageView["load"] {
  const { load } = model;
  if (!load) return null;
  const focus = load.focus;
  const total = focus
    ? focus.lowAerobic + focus.highAerobic + focus.anaerobic
    : 0;
  const parts = [
    load.zone === "productive"
      ? "Ta charge des 7 derniers jours reste dans la zone qui fait progresser."
      : load.zone === "high"
        ? "Ta charge des 7 derniers jours dépasse nettement ta base : le risque de fatigue augmente."
        : "Ta charge des 7 derniers jours est sous ta base : tu récupères ou tu perds un peu de condition.",
  ];
  if (focus && total > 0)
    parts.push(
      `Sur 4 semaines : ${percent.format((focus.lowAerobic / total) * 100)} % aérobie faible, ${percent.format((focus.highAerobic / total) * 100)} % aérobie forte, ${percent.format((focus.anaerobic / total) * 100)} % anaérobie.`,
    );
  if (load.vo2 !== null) parts.push(`VO₂max ${formatInteger(load.vo2)}.`);
  return {
    status: zoneLabels[load.zone],
    tone:
      load.zone === "high"
        ? "warning"
        : load.zone === "low"
          ? "muted"
          : "success",
    note: parts.join(" "),
    focus: focus
      ? [
          {
            label: "Aérobie faible",
            value: focus.lowAerobic,
            swatch: "bg-provider",
          },
          {
            label: "Aérobie forte",
            value: focus.highAerobic,
            swatch: "bg-zone-3",
          },
          { label: "Anaérobie", value: focus.anaerobic, swatch: "bg-danger" },
        ]
      : [],
  };
}

export function healthPageView(
  model: HealthModel,
  syncedAt: string | null,
): HealthPageView {
  const { sleep } = model;
  const takeaways = [
    sleepTakeaway(model),
    hrvTakeaway(model),
    loadTakeaway(model),
  ].filter((item): item is Takeaway => item !== null);
  return {
    readingLabel: `Lecture de Stride · ${model.readingDays} derniers jours${syncedAt ? ` · ${syncedAt.toLowerCase()}` : ""}`,
    headline: headline(model),
    paragraph: paragraph(model),
    takeaways,
    kpis: kpis(model),
    sleep: sleep
      ? {
          status: sleep.trend === "watch" ? "À surveiller" : "Dans ta moyenne",
          tone: sleep.trend === "watch" ? "warning" : "success",
          note:
            sleep.restorativeShare === null
              ? null
              : `Profond et paradoxal font ${formatSleep((sleep.stages?.deep ?? 0) + (sleep.stages?.rem ?? 0))}, soit ${percent.format(sleep.restorativeShare * 100)} % du temps endormi${sleep.usualRestorativeShare === null ? "" : `, contre ${percent.format(sleep.usualRestorativeShare * 100)} % d’habitude`}.${sleep.trend === "watch" && sleep.usualRestorativeShare !== null && sleep.restorativeShare >= sleep.usualRestorativeShare - 0.03 ? " C’est la durée qui manque, pas la qualité." : ""}`,
          stages: sleep.stages
            ? [
                {
                  key: "deep",
                  label: "Profond",
                  seconds: sleep.stages.deep,
                  swatch: "bg-provider",
                },
                {
                  key: "light",
                  label: "Léger",
                  seconds: sleep.stages.light,
                  swatch: "bg-dim",
                },
                {
                  key: "rem",
                  label: "Paradoxal",
                  seconds: sleep.stages.rem,
                  swatch: "bg-zone-3",
                },
                {
                  key: "awake",
                  label: "Éveil",
                  seconds: sleep.stages.awake,
                  swatch: "bg-danger",
                },
              ]
            : [],
        }
      : null,
    heart: heart(model),
    energy: energy(model),
    load: loadCard(model),
    footnote: `Données Garmin : ${model.history.sleepNights} nuits de sommeil, ${model.history.hrvNights} nuits de VFC, ${model.history.loadDays} jours de charge d’entraînement. Les plages habituelles et la lecture sont des estimations de Stride. Stride lit les tendances pour guider ton entraînement, il ne pose pas de diagnostic.`,
  };
}
