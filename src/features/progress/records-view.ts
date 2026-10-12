import { z } from "zod";
import {
  formatClock,
  formatDecimal,
  formatInteger,
  formatHoursMinutes,
} from "./format";
import type { ProgressHistory } from "./history";
import {
  predictSeconds,
  racePredictions,
  type Prediction,
} from "./predictions";
import type { EnduranceRecord, RecordsModel, RoadKey } from "./record-history";

export const recordFilters = ["all", "road", "trail"] as const;
export type RecordFilter = (typeof recordFilters)[number];
export const recordFilterLabels = {
  all: "Tous",
  road: "Route",
  trail: "Trail et ultra",
};
export const recordConfidenceLabels = {
  low: "Confiance faible",
  moderate: "Confiance modérée",
  high: "Confiance élevée",
};
export function recordCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${formatInteger(count)} ${count === 1 ? singular : plural}`;
}
export function parseRecordFilter(value: unknown): RecordFilter {
  return z
    .enum(recordFilters)
    .catch("all")
    .parse(Array.isArray(value) ? value[0] : value);
}
export function formatEndurance(record: EnduranceRecord, value: number) {
  if (record.key === "duration")
    return formatHoursMinutes(value).replace(":", "h");
  if (record.unit === "km") return formatDecimal(value / 1000);
  return formatInteger(value);
}
export function recordsView(
  model: RecordsModel,
  history: ProgressHistory,
  today: string,
  filter: RecordFilter,
) {
  const forecast = racePredictions(history.vo2, history.races, today);
  const estimated: (Omit<Prediction, "key"> & { key: RoadKey })[] = [
    ...(forecast?.predictions ?? []),
  ];
  const five = forecast ? predictSeconds(forecast.vo2, 5000) : null;
  if (five !== null)
    estimated.unshift({
      key: "5k",
      label: "5 km",
      meters: 5000,
      seconds: five,
      confidence: "moderate",
    });
  const predictions = estimated.map((p) => {
    const record = model.road.find((r) => r.key === p.key)?.current;
    return { ...p, gap: record ? p.seconds - record.value : null };
  });
  const road = model.road.filter((r) => r.current);
  const endurance = model.endurance.filter((r) => r.current);
  const events = model.chronology.filter(
    (p) =>
      filter === "all" ||
      (filter === "road" ? p.kind === "road" : p.kind === "endurance"),
  );
  const latest = events.at(-1);
  const improvements = events.filter((p) => {
    const record =
      p.kind === "road"
        ? model.road.find((r) => r.key === p.key)
        : model.endurance.find((r) => r.key === p.key);
    return (
      (record?.history[0]?.day !== p.day ||
        record?.history[0]?.activityId !== p.activityId) &&
      (record?.history.length ?? 0) > 1
    );
  });
  const emptyHeadline =
    filter === "road"
      ? "Aucun record sur route n’est encore documenté."
      : filter === "trail"
        ? "Aucun record d’endurance n’est encore documenté."
        : "Tes records attendent ton historique.";
  const headline = events.length
    ? road.length && endurance.length
      ? "Tes meilleurs efforts racontent ta progression."
      : "Tes premiers repères sont dans ton historique."
    : emptyHeadline;
  const paragraph = events.length
    ? `${recordCount(road.length, "distance")} sur route et ${recordCount(endurance.length, "repère")} d’endurance sont documentés dans tes activités importées. ${latest ? `Le dernier repère date du ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${latest.day}T00:00:00Z`))}.` : ""} Les temps sur route sont des estimations recalculées par Stride à partir des distances et durées enregistrées.`
    : filter === "road"
      ? "Tes activités importées ne documentent encore aucun meilleur effort sur route ou piste. Les records d’endurance restent disponibles avec le filtre Trail et ultra lorsqu’ils sont documentés."
      : filter === "trail"
        ? "Tes activités importées ne documentent encore aucun record d’endurance. Les meilleurs efforts sur route restent disponibles avec le filtre Route lorsqu’ils sont documentés."
        : "Aucune activité importée ne fournit encore les données nécessaires. Tes records apparaîtront avec un historique exploitable.";
  const takeaways = [
    {
      title: "Endurance",
      text: `${recordCount(endurance.length, "repère documenté", "repères documentés")}, avec ${recordCount(
        model.endurance.reduce(
          (sum, record) => sum + Math.max(0, record.history.length - 1),
          0,
        ),
        "amélioration",
      )} dans l’historique importé.`,
    },
    {
      title: "Vitesse sur route",
      text: `${recordCount(road.length, "distance documentée", "distances documentées")}, avec ${recordCount(
        model.road.reduce(
          (sum, record) => sum + Math.max(0, record.history.length - 1),
          0,
        ),
        "amélioration",
      )}. Les efforts trail et tapis sont exclus.`,
    },
    {
      title: "À portée",
      text: predictions.length
        ? "Les estimations Stride situent tes temps actuels, sans garantir une performance future."
        : "Une VO₂ max Garmin datant de 30 jours maximum est nécessaire pour une estimation.",
    },
  ];
  const opportunities = history.races
    .filter((r) => r.day >= today)
    .sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((race) => {
      const key: RoadKey | null =
        race.distanceKm === 5
          ? "5k"
          : race.distanceKm === 10
            ? "10k"
            : race.distanceKm === 21.1
              ? "half"
              : race.distanceKm === 42.2
                ? "marathon"
                : null;
      const predicted =
        race.kind === "road" ? predictions.find((p) => p.key === key) : null;
      const longest = model.endurance.find(
        (r) => r.key === "distance",
      )?.current;
      return {
        race,
        text: predicted
          ? `Estimation Stride actuelle : ${formatClock(predicted.seconds)} · ${recordConfidenceLabels[predicted.confidence].toLocaleLowerCase("fr-FR")}${predicted.gap === null ? ". Aucun record documenté sur cette distance." : `. Écart au record : ${predicted.gap >= 0 ? "+" : "−"}${formatClock(Math.abs(predicted.gap))}.`}`
          : longest &&
              race.distanceKm !== null &&
              race.distanceKm * 1000 > longest.value
            ? `La distance prévue dépasse ta plus longue sortie importée (${formatDecimal(longest.value / 1000)} km). Le résultat reste à établir.`
            : "Cet objectif est dans ton calendrier. Aucun résultat ni futur record ne peut être déduit de sa distance ou de son temps cible.",
      };
    });
  return {
    headline,
    paragraph,
    takeaways,
    events,
    latest,
    improvements,
    predictions,
    forecast,
    opportunities,
  };
}
export type RecordsView = ReturnType<typeof recordsView>;
