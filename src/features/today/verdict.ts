import { coachRequestHref } from "@/features/coach/request";
import { lighterSessionHref, readinessAdvice } from "@/features/progress/body";
import { formatInteger } from "@/features/progress/format";
import { loadZone, productiveLoad } from "@/features/progress/health";
import {
  sessionFit,
  shortNightSeconds,
  type Readiness,
  type RecoveryModel,
} from "@/features/progress/recovery";
import { formatSleep } from "@/features/progress/recovery-view";

export const hrvAlertDays = 2;
export const restingAlertBpm = 7;

export type FormStatus = "normal" | "watch" | "crossed";

export type FormIndicator = {
  key: "hrv" | "resting" | "sleep" | "load";
  label: string;
  value: string;
  status: FormStatus;
  statusLabel: string;
  note: string;
  band: { start: number; end: number } | null;
  marker: number | null;
  threshold: number | null;
  alert: { motif: string; detail: string } | null;
};

export type VerdictTone = "success" | "warning" | "danger" | "muted";

export type VerdictAction = {
  key: "steps" | "lighter" | "review" | "keep";
  label: string;
  href: string;
  primary: boolean;
};

export type TodayVerdict = {
  tone: VerdictTone;
  label: string;
  text: string;
  motif: string | null;
  actions: VerdictAction[];
  sync: boolean;
  compat: {
    question: string;
    answer: string;
    tone: VerdictTone;
    detail: string;
  } | null;
};

export type VerdictSession =
  | {
      kind: "session";
      sessionKey: string;
      title: string;
      quality: boolean;
      href: string;
    }
  | { kind: "rest" }
  | { kind: "none" };

export type VerdictInput = {
  readiness: Readiness | null;
  indicators: FormIndicator[];
  pain: boolean;
  session: VerdictSession;
};

const statusLabels: Record<FormStatus, string> = {
  normal: "Normal",
  watch: "À surveiller",
  crossed: "Seuil franchi",
};

const hundredths = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const ratio = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

function round(value: number) {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

function scale(low: number, high: number, values: number[]) {
  const span = high - low || Math.max(1, Math.abs(low) * 0.1);
  const min = Math.min(low - span, ...values.map((value) => value - span / 4));
  const max = Math.max(high + span, ...values.map((value) => value + span / 4));
  return (value: number) => round(((value - min) / (max - min)) * 100);
}

function signed(value: number) {
  return value > 0 ? "+" : value < 0 ? "−" : "±";
}

function span(range: { low: number; high: number }) {
  return range.low === range.high
    ? `${range.low}`
    : `${range.low}–${range.high}`;
}

function indicator(
  item: Omit<FormIndicator, "statusLabel" | "band" | "marker" | "threshold">,
  band: { low: number; high: number; value: number; threshold?: number } | null,
): FormIndicator {
  if (!band)
    return {
      ...item,
      statusLabel: statusLabels[item.status],
      band: null,
      marker: null,
      threshold: null,
    };
  const values = [
    band.value,
    ...(band.threshold === undefined ? [] : [band.threshold]),
  ];
  const position = scale(band.low, band.high, values);
  return {
    ...item,
    statusLabel: statusLabels[item.status],
    band: { start: position(band.low), end: position(band.high) },
    marker: position(band.value),
    threshold: band.threshold === undefined ? null : position(band.threshold),
  };
}

export function formIndicators(model: RecoveryModel): FormIndicator[] {
  const { hrv, restingHeartRate: resting, sleep, load } = model;
  const items: FormIndicator[] = [];
  if (hrv) {
    const status: FormStatus =
      hrv.range && hrv.streak >= hrvAlertDays
        ? "crossed"
        : hrv.position === "below"
          ? "watch"
          : "normal";
    const days = `${formatInteger(hrv.streak)} jours`;
    items.push(
      indicator(
        {
          key: "hrv",
          label: "VFC",
          value: `${formatInteger(hrv.last)} ms`,
          status,
          note: hrv.range
            ? [
                `plage ${span(hrv.range)}`,
                status === "crossed"
                  ? `${formatInteger(hrv.streak)}e jour dessous`
                  : status === "watch"
                    ? `seuil ${hrvAlertDays} j dessous`
                    : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "plage en cours de calcul",
          alert:
            status === "crossed"
              ? {
                  motif: `VFC sous ta plage depuis ${days}`,
                  detail: `VFC sous ta plage ${days} de suite`,
                }
              : null,
        },
        hrv.range ? { ...hrv.range, value: hrv.last } : null,
      ),
    );
  }
  if (resting) {
    const limit =
      resting.median === null ? null : resting.median + restingAlertBpm;
    const gap =
      resting.median === null
        ? null
        : Math.round(resting.last - resting.median);
    const status: FormStatus =
      limit !== null && resting.last >= limit
        ? "crossed"
        : resting.position === "above"
          ? "watch"
          : "normal";
    items.push(
      indicator(
        {
          key: "resting",
          label: "FC repos",
          value: `${formatInteger(resting.last)} bpm`,
          status,
          note:
            resting.median === null
              ? "habitude en cours de calcul"
              : `médiane ${formatInteger(resting.median)} · seuil +${restingAlertBpm}`,
          alert:
            status === "crossed" && gap !== null
              ? {
                  motif: `FC repos +${formatInteger(gap)} bpm`,
                  detail: `FC repos +${formatInteger(gap)} bpm vs ta médiane`,
                }
              : null,
        },
        resting.range
          ? {
              ...resting.range,
              value: resting.last,
              ...(limit === null ? {} : { threshold: limit }),
            }
          : null,
      ),
    );
  }
  if (sleep) {
    const status: FormStatus = sleep.trend === "stable" ? "normal" : "watch";
    const gap = sleep.average === null ? null : sleep.last - sleep.average;
    items.push(
      indicator(
        {
          key: "sleep",
          label: "Sommeil",
          value: formatSleep(sleep.last),
          status,
          note:
            sleep.average === null || gap === null
              ? "moyenne en cours de calcul"
              : [
                  `moy. ${formatSleep(sleep.average)}`,
                  status === "watch" &&
                    `${signed(Math.round(gap / 60))}${formatSleep(Math.abs(gap))}`,
                ]
                  .filter(Boolean)
                  .join(" · "),
          alert: null,
        },
        sleep.average === null
          ? null
          : {
              low: sleep.average - shortNightSeconds,
              high: sleep.average + shortNightSeconds,
              value: sleep.last,
            },
      ),
    );
  }
  if (load) {
    const zone = loadZone(load.ratio);
    const rising = load.average !== null && load.ratio - load.average >= 0.1;
    const status: FormStatus =
      zone === "high"
        ? "crossed"
        : zone === "low" || rising
          ? "watch"
          : "normal";
    const value = hundredths.format(load.ratio);
    const limit = ratio.format(productiveLoad.high);
    items.push(
      indicator(
        {
          key: "load",
          label: "Charge",
          value,
          status,
          note: `zone ${ratio.format(productiveLoad.low)}–${limit} · seuil ${limit}`,
          alert:
            status === "crossed"
              ? {
                  motif: `charge ${value}`,
                  detail: `charge au-dessus de ${limit}`,
                }
              : null,
        },
        {
          ...productiveLoad,
          value: load.ratio,
          threshold: productiveLoad.high,
        },
      ),
    );
  }
  return items;
}

export const reviewRule = `Revue avec le coach si : forme sous 50 avant une séance intense, douleur active dans Santé, VFC sous ta plage ${hrvAlertDays} jours de suite, FC repos +${restingAlertBpm} bpm, charge au-dessus de ${ratio.format(productiveLoad.high)}.`;

const painAlert = {
  motif: "Douleur active signalée dans Santé",
  detail: "douleur active signalée dans Santé",
};

function plural(count: number, one: string, many: string) {
  return `${formatInteger(count)} ${count === 1 ? one : many}`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lower(text: string) {
  return /^.[a-zà-ÿ]/.test(text)
    ? text.charAt(0).toLowerCase() + text.slice(1)
    : text;
}

export function reviewSessionHref(
  session: { sessionKey: string; title: string },
  motif: string,
) {
  return coachRequestHref(
    `Revois avec moi la séance « ${session.title} » : ${lower(motif)}.`,
    session.sessionKey,
  );
}

const fitVerdicts = {
  ready: { tone: "success", label: "Séance maintenue", answer: "Oui" },
  caution: { tone: "warning", label: "Avec prudence", answer: "Avec prudence" },
  review: { tone: "danger", label: "À revoir", answer: "Non" },
} as const;

export function todayVerdict(input: VerdictInput): TodayVerdict | null {
  const { readiness, indicators, pain, session } = input;
  if (session.kind === "none") return null;
  if (session.kind === "rest")
    return {
      tone: "success",
      label: "Récupère",
      text: readiness
        ? readinessAdvice(readiness, null)!.text
        : "Pas de séance prévue aujourd’hui. Récupère, c’est aussi de l’entraînement.",
      motif: null,
      actions: [],
      sync: false,
      compat: null,
    };
  const alerts = [
    ...(pain ? [painAlert] : []),
    ...indicators.flatMap((item) => (item.alert ? [item.alert] : [])),
  ];
  const watched = indicators.filter((item) => item.status === "watch").length;
  const steps: VerdictAction = {
    key: "steps",
    label: "Voir les étapes",
    href: session.href,
    primary: false,
  };
  const question = `Compatible avec ${session.title} ?`;
  const score = readiness?.today ?? null;
  const fit =
    alerts.length > 0
      ? session.quality
        ? "review"
        : score !== null && sessionFit(score, false) === "review"
          ? "review"
          : "caution"
      : score === null
        ? null
        : sessionFit(score, session.quality);

  if (fit === null)
    return {
      tone: "muted",
      label: "Forme inconnue",
      text: "Pas de données Garmin ce matin. Synchronise ta montre pour compléter ta forme du jour.",
      motif: null,
      actions: [steps],
      sync: true,
      compat: {
        question,
        answer: "Inconnue",
        tone: "muted",
        detail: "Pas de forme Garmin ce matin.",
      },
    };

  const scoreReview =
    fit === "review" &&
    score !== null &&
    sessionFit(score, session.quality) === "review";
  const motif =
    fit !== "review"
      ? null
      : scoreReview
        ? [`Forme ${formatInteger(score!)}`, alerts[0]?.motif]
            .filter(Boolean)
            .join(" · ")
        : [
            alerts[0]!.motif,
            score === null ? null : `forme ${formatInteger(score)}`,
          ]
            .filter(Boolean)
            .join(" · ");

  const text =
    scoreReview || alerts.length === 0
      ? session.quality && scoreReview
        ? "Ta forme est sous 50 avant une séance intense."
        : readinessAdvice(readiness, {
            sessionKey: session.sessionKey,
            title: session.title,
            hard: session.quality,
          })!.text
      : fit === "review"
        ? alerts[0] === painAlert
          ? "Tu as une douleur active : pas d’intensité avant d’en parler."
          : `${capitalize(alerts[0]!.detail)} : pas d’intensité avant d’en parler.`
        : `${capitalize(alerts[0]!.detail)} : garde ta séance facile vraiment à l’aise, quitte à la raccourcir.`;

  const actions: VerdictAction[] =
    fit === "review"
      ? [
          {
            key: "review",
            label: "Revoir la séance avec le coach",
            href: reviewSessionHref(session, motif!),
            primary: true,
          },
          { ...steps, key: "keep", label: "Garder la séance" },
        ]
      : fit === "caution" && session.quality
        ? [
            steps,
            {
              key: "lighter",
              label: "Demander une version allégée",
              href: lighterSessionHref({
                sessionKey: session.sessionKey,
                title: session.title,
                hard: true,
              }),
              primary: false,
            },
          ]
        : [steps];

  const detail =
    alerts.length > 0
      ? `${plural(alerts.length, "seuil franchi", "seuils franchis")} : ${alerts.map((alert) => alert.detail).join(", ")}.`
      : scoreReview
        ? session.quality
          ? "Forme sous 50 avant une séance intense."
          : "Forme sous 25 : repos proposé."
        : watched > 0
          ? `${plural(watched, "indicateur", "indicateurs")} à surveiller, aucun seuil franchi.`
          : indicators.length > 0
            ? "Tous les indicateurs dans ta plage."
            : "Aucun indicateur détaillé ce matin.";

  const { tone, label, answer } = fitVerdicts[fit];
  return {
    tone,
    label,
    text,
    motif,
    actions,
    sync: false,
    compat: {
      question,
      answer,
      tone,
      detail,
    },
  };
}
