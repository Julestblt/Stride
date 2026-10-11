import {
  formatClock,
  formatDecimal,
  formatDuration,
  formatElapsed,
  formatKm,
  formatPace,
} from "./format";
import { productCarbs } from "./nutrition";
import { formatShortDate } from "./race";
import {
  formatTemperature,
  rainWindows,
  rainName,
  temperatureRange,
  type RaceWeather,
} from "./weather";
import { isStation } from "./waypoints";
import type { CourseModel, RacePlanModel } from "./workspace";

export type BriefItem = {
  key: "weather" | "night" | "walk" | "finish" | "pace";
  label: string;
  value: string;
};

export type Reading = { title: string; body: string };
export type StrategyItem = { title: string; body: string };

export function roadReading({
  model,
  planned,
  weather,
  date,
}: {
  model: CourseModel;
  planned: RacePlanModel;
  weather: RaceWeather | null;
  date: string | null;
}): Reading {
  const distanceKm = model.course.distanceM / 1000;
  const pace = planned.scenario.seconds / distanceKm;
  const start = formatClock(planned.simulation.passages[0].clockMinutes);
  const sentences = [
    `Départ prévu à ${start}. Ton objectif de ${formatDuration(planned.scenario.seconds)} correspond à une allure moyenne de ${formatPace(pace)} /km.`,
  ];
  if (weather?.mode === "normals" && date)
    sentences.push(
      `Les normales de saison donnent un premier repère météo. Les prévisions seront disponibles dès le ${formatShortDate(weather.forecastFrom)}.`,
    );
  if (weather?.mode === "forecast")
    sentences.push(
      `Prévision au départ : ${formatTemperature(weather.slots[0].temperature)} °C.`,
    );
  return {
    title: `${formatDecimal(distanceKm)} km sur route · ${formatPace(pace)} /km visés.`,
    body: sentences.join(" "),
  };
}

export function roadBrief({
  model,
  planned,
  weather,
}: {
  model: CourseModel;
  planned: RacePlanModel;
  weather: RaceWeather | null;
}): BriefItem[] {
  const pace = planned.scenario.seconds / (model.course.distanceM / 1000);
  const items: BriefItem[] = [
    { key: "pace", label: "Allure visée", value: `${formatPace(pace)} /km` },
  ];
  if (weather) {
    const { min, max } = temperatureRange(weather.slots);
    items.push({
      key: "weather",
      label: "Météo",
      value:
        weather.mode === "normals"
          ? `Normales · ${min === max ? `${min} °C` : `${min} → ${max} °C`}`
          : min === max
            ? `${min} °C`
            : `${min} → ${max} °C`,
    });
  }
  const finish = planned.simulation.passages.at(-1);
  if (finish)
    items.push({
      key: "finish",
      label: "Arrivée prévue",
      value: formatClock(finish.clockMinutes),
    });
  return items;
}

function kmText(meters: number) {
  return `km ${Math.round(meters / 1000)}`;
}

function hourText(clockMinutes: number) {
  return `${Math.floor((((clockMinutes % 1440) + 1440) % 1440) / 60)}h`;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

function stationBefore(model: CourseModel, distanceM: number) {
  return [...model.waypoints]
    .reverse()
    .find(
      (waypoint) => isStation(waypoint.kind) && waypoint.distanceM <= distanceM,
    );
}

function terrainWord(model: CourseModel) {
  const gain = model.course.elevationGainM;
  if (gain === null) return "au profil inconnu";
  const perKm = gain / (model.course.distanceM / 1000);
  if (perKm < 15) return "roulante";
  if (perKm < 35) return "vallonnée";
  return "montagneuse";
}

function lengthWord(seconds: number) {
  if (seconds >= 10 * 3600) return "Une longue journée";
  if (seconds >= 4 * 3600) return "Une course";
  return "Une course courte";
}

export function courseReading({
  model,
  planned,
  weather,
  walkGrade,
  date,
}: {
  model: CourseModel;
  planned: RacePlanModel;
  weather: RaceWeather | null;
  walkGrade: number;
  date: string | null;
}): Reading {
  const { simulation, night, nightKm } = planned;
  const walk = model.walkByThreshold.find(
    (item) => item.threshold === walkGrade,
  );
  const finishesInDark =
    night?.windows.some(
      (window) => window.toSeconds >= simulation.finishSeconds - 60,
    ) ?? false;
  const startsInDark =
    night?.windows.some((window) => window.fromSeconds === 0) ?? false;
  const startClock = formatClock(simulation.passages[0].clockMinutes);
  const sentences: string[] = [];
  if (startsInDark && night?.windows[0]) {
    const dawn = nightKm[0];
    sentences.push(
      `Tu pars à ${startClock} dans le noir, le jour se lève vers le ${kmText(dawn.toM)}.`,
    );
  } else sentences.push(`Tu pars à ${startClock}, de jour.`);
  if (walk && walk.count > 0)
    sentences.push(
      `Le parcours compte ${plural(walk.count, "passage")} au-dessus de ${walkGrade} % à faire en marche rapide, ${formatDecimal(walk.distanceM / 1000)} km au total.`,
    );
  else
    sentences.push(`Aucune portion ne dépasse ${walkGrade} % : tout se court.`);
  const evening = night?.windows.find((window) => window.fromSeconds > 0);
  const eveningIndex = evening ? night!.windows.indexOf(evening) : -1;
  if (evening && eveningIndex >= 0) {
    const from = nightKm[eveningIndex].fromM;
    const station = stationBefore(model, from);
    const sunset = formatClock(
      simulation.passages[0].clockMinutes + evening.fromSeconds / 60,
    );
    const remaining = model.course.distanceM - from;
    sentences.push(
      `La nuit tombe vers ${sunset}${station ? `, après le ${station.name.toLowerCase().startsWith("ravito") ? station.name : `point « ${station.name} »`}` : ""} : ${
        finishesInDark
          ? `les ${Math.round(remaining / 1000)} derniers km se courent à la frontale.`
          : `tu passes ${formatDuration(evening.toSeconds - evening.fromSeconds)} à la frontale.`
      }`,
    );
  }
  if (weather?.mode === "normals" && date)
    sentences.push(
      `Pour la météo, c’est trop tôt : on affiche les normales de saison, les vraies prévisions arrivent le ${formatShortDate(weather.forecastFrom)}.`,
    );
  if (weather?.mode === "forecast") {
    const windows = rainWindows(weather.slots);
    const start = weather.slots[0];
    sentences.push(
      `Il fera ${formatTemperature(start.temperature)} °C au départ${start.apparentTemperature !== null ? `, ressenti ${formatTemperature(start.apparentTemperature)} °C` : ""}.`,
    );
    if (windows[0])
      sentences.push(
        `${rainName(windows[0].from.code)} prévues entre ${hourText(windows[0].from.clockMinutes)} et ${hourText(windows[0].to.clockMinutes + 60)}, quand tu seras entre le ${kmText(windows[0].from.distanceM)} et le ${kmText(windows[0].to.distanceM)}.`,
      );
  }
  const title =
    weather?.mode === "forecast"
      ? forecastTitle(weather, finishesInDark)
      : `${lengthWord(simulation.finishSeconds)} ${terrainWord(model)}${walk && walk.count >= model.course.distanceM / 10_000 ? " mais cassante" : ""}${finishesInDark ? ", qui finit à la frontale" : ""}.`;
  return { title, body: sentences.join(" ") };
}

function forecastTitle(weather: RaceWeather, finishesInDark: boolean) {
  const { min } = temperatureRange(weather.slots);
  const windows = rainWindows(weather.slots);
  const first = weather.slots[0];
  const last = weather.slots[weather.slots.length - 1];
  const parts = [
    `Départ ${first.temperature <= 8 ? "frais" : first.temperature >= 22 ? "chaud" : "doux"}`,
    windows[0]
      ? `${rainName(windows[0].from.code).toLowerCase()} entre ${hourText(windows[0].from.clockMinutes)} et ${hourText(windows[0].to.clockMinutes + 60)}`
      : min <= 2
        ? "risque de gel"
        : "sans pluie annoncée",
    `arrivée ${finishesInDark ? "de nuit" : "de jour"}${last.precipitationProbability < 30 ? " au sec" : ""}`,
  ];
  return `${parts.join(", ")}.`;
}

export function dayBrief({
  model,
  planned,
  weather,
  walkGrade,
}: {
  model: CourseModel;
  planned: RacePlanModel;
  weather: RaceWeather | null;
  walkGrade: number;
}): BriefItem[] {
  const walk = model.walkByThreshold.find(
    (item) => item.threshold === walkGrade,
  );
  const finish =
    planned.simulation.passages[planned.simulation.passages.length - 1];
  const items: BriefItem[] = [];
  if (weather) {
    const { min, max } = temperatureRange(weather.slots);
    const windows = rainWindows(weather.slots);
    items.push({
      key: "weather",
      label: "Météo",
      value:
        weather.mode === "normals"
          ? `Normales · ${min} → ${max} °C`
          : `${min} → ${max} °C${windows[0] ? ` · ${rainName(windows[0].from.code).toLowerCase()} ${hourText(windows[0].from.clockMinutes)}–${hourText(windows[0].to.clockMinutes + 60)}` : ""}`,
    });
  }
  if (planned.night && planned.night.totalSeconds > 0) {
    const evening = planned.night.windows.findIndex(
      (window) => window.fromSeconds > 0,
    );
    items.push({
      key: "night",
      label: "Nuit",
      value:
        weather?.mode === "forecast" && evening >= 0
          ? `Dès ${formatClock(planned.simulation.passages[0].clockMinutes + planned.night.windows[evening].fromSeconds / 60)} · ${kmText(planned.nightKm[evening].fromM)} → arrivée`
          : `${formatDuration(planned.night.totalSeconds)} à la frontale`,
    });
  }
  if (walk)
    items.push({
      key: "walk",
      label: "Marche",
      value: `${plural(walk.count, "portion")} ≥ ${walkGrade} % · ${formatDecimal(walk.distanceM / 1000)} km`,
    });
  items.push({
    key: "finish",
    label: "Arrivée prévue",
    value: `${formatClock(finish.clockMinutes)}${planned.finishMarginSeconds !== null ? ` · marge ${formatDuration(Math.max(0, planned.finishMarginSeconds))}` : ""}`,
  });
  return items;
}

export function raceStrategy({
  model,
  planned,
  walkGrade,
  walkPaceSecondsPerKm,
}: {
  model: CourseModel;
  planned: RacePlanModel;
  walkGrade: number;
  walkPaceSecondsPerKm: number;
}): StrategyItem[] {
  const { simulation } = planned;
  const items: StrategyItem[] = [];
  const first = simulation.segments[0];
  const firstStop = model.waypoints.find(
    (waypoint) => waypoint.id === first?.toId,
  );
  if (first && firstStop)
    items.push({
      title: "Pars à l’allure prévue.",
      body: `Jusqu’au ${firstStop.name} (km ${formatKm(firstStop.distanceM)}), la simulation compte ${formatPace(first.paceSecondsPerKm)} /km en moyenne. Partir plus vite se paie en fin de course.`,
    });
  const walk = model.walkByThreshold.find(
    (item) => item.threshold === walkGrade,
  );
  if (walk && walk.count > 0)
    items.push({
      title: `Marche dès ${walkGrade} %.`,
      body: `${plural(walk.count, "portion")}, ${formatDecimal(walk.distanceM / 1000)} km, comptées à ${formatPace(walkPaceSecondsPerKm)} /km. Relance dès que ça s’aplatit.`,
    });
  const evening = planned.night?.windows.find(
    (window) => window.fromSeconds > 0,
  );
  if (evening && planned.night) {
    const index = planned.night.windows.indexOf(evening);
    const from = planned.nightKm[index].fromM;
    const before = stationBefore(model, from);
    items.push({
      title: before
        ? `Prépare la nuit avant le ${before.name}.`
        : "Prépare la nuit.",
      body: `La nuit tombe vers ${formatClock(simulation.passages[0].clockMinutes + evening.fromSeconds / 60)} (km ${Math.round(from / 1000)}). Frontale prête et couche chaude accessible avant ce point.`,
    });
  }
  const tight = simulation.passages
    .map((passage, index) => ({ passage, waypoint: model.waypoints[index] }))
    .filter(({ passage }) => passage.marginSeconds !== null)
    .sort((a, b) => a.passage.marginSeconds! - b.passage.marginSeconds!)[0];
  if (tight && tight.passage.marginSeconds! < 3600)
    items.push({
      title: `Surveille la barrière du ${tight.waypoint.name}.`,
      body:
        tight.passage.marginSeconds! < 0
          ? `Avec cet objectif, tu y arrives ${formatElapsed(-tight.passage.marginSeconds!)} après la barrière.`
          : `La marge prévue n’est que de ${formatElapsed(tight.passage.marginSeconds!)}.`,
    });
  const last = simulation.segments[simulation.segments.length - 1];
  if (
    last &&
    last.gainM !== null &&
    last.gainM / ((last.toM - last.fromM) / 1000) < 8
  ) {
    const from = model.waypoints.find(
      (waypoint) => waypoint.id === last.fromId,
    );
    items.push({
      title: "Gagne les portions plates de la fin.",
      body: `${from && from.kind !== "start" ? `Après le ${from.name}, il` : "Il"} reste ${formatKm(last.toM - last.fromM)} km presque plats (+${last.gainM} m), prévus à ${formatPace(last.paceSecondsPerKm)} /km.`,
    });
  }
  return items.slice(0, 4);
}

export function nutritionReading(
  planned: RacePlanModel,
  carbsPerHourG: number,
) {
  const moving = planned.nutrition.reduce(
    (sum, segment) => sum + segment.movingSeconds,
    0,
  );
  const night = planned.nutrition.filter(
    (segment) => segment.items.caffeineGels > 0,
  ).length;
  return [
    `Pour ${formatDuration(moving)} d’effort en mouvement, ${carbsPerHourG} g/h représentent ${planned.nutritionTotals.carbsG} g de glucides, soit l’équivalent de ${planned.nutritionTotals.gelEquivalents} gels de ${productCarbs.gel} g.`,
    "Les quantités suivent la durée prévue de chaque tronçon : un tronçon plus long demande plus de réserves.",
    night > 0
      ? `Sur ${plural(night, "tronçon")} de nuit, un gel est remplacé par un gel caféiné.`
      : null,
    "Teste ce rythme sur tes sorties longues avant le jour J.",
  ]
    .filter(Boolean)
    .join(" ");
}
