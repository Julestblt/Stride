import {
  formatDecimal,
  formatInteger,
  formatPace,
} from "@/features/progress/format";
import { addDays, daysBetween } from "../model/dates";
import type {
  PlanBlock,
  PlanSession,
  PlanState,
  PlanWeek,
  RaceRole,
} from "../model/plan";
import type {
  IntensityPaces,
  SimpleStep,
  StructureStep,
} from "../model/structure";
import { sessionDistance } from "../model/volume";
import {
  formatTarget,
  formatWeekdayShort,
  intensityLabels,
  intensityZone,
  terrainLabels,
} from "./format";
import {
  familyLabels,
  sessionFamilyOf,
  weekTypeLabels,
  type ProgramRace,
} from "./program";

export type ProgramTextInput = {
  state: PlanState;
  version: number;
  summary: string | null;
  races: ProgramRace[];
  today: string;
  paces?: IntensityPaces | null;
};

const blockKindLabels: Record<PlanBlock["kind"], string> = {
  lead_in: "Mise en route",
  base: "Foncier",
  build: "Développement",
  specific: "Spécifique",
  taper: "Affûtage",
  race: "Course",
  recovery: "Récupération",
  transition: "Transition",
};

const roleLabels: Record<RaceRole, string> = {
  primary: "objectif principal",
  preparation: "course de préparation",
  secondary: "course secondaire",
};

const sportLabels: Record<PlanSession["sport"], string> = {
  run: "Course à pied",
  trail: "Trail",
  strength: "Renforcement",
  cross: "Sport croisé",
  rest: "Repos",
};

const stepLabels: Record<SimpleStep["type"], string> = {
  warmup: "Échauffement",
  work: "Effort",
  recovery: "Récupération",
  cooldown: "Retour au calme",
};

const priorityLabels: Record<PlanSession["priority"], string | null> = {
  high: "priorité haute",
  normal: null,
  low: "priorité basse, sacrifiable",
};

const paceOrder = [
  "recovery",
  "easy",
  "marathon",
  "threshold",
  "interval",
  "repetition",
] as const;

export function formatFrenchDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function dayLabel(iso: string) {
  return `${formatWeekdayShort(iso)} ${formatFrenchDate(iso)}`;
}

export function formatHoursText(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h ${String(rest).padStart(2, "0")}`;
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  if (seconds % 60 !== 0 && seconds < 600)
    return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
  return formatHoursText(seconds);
}

function formatKm(meters: number) {
  return `${formatDecimal(meters / 1000)} km`;
}

function formatMeters(meters: number) {
  return meters < 1000 ? `${meters} m` : formatKm(meters);
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function stepEnd(step: SimpleStep) {
  switch (step.end.kind) {
    case "time":
      return formatSeconds(step.end.seconds);
    case "distance":
      return formatMeters(step.end.meters);
    case "lap_button":
      return `jusqu’à appui sur le bouton tour (≈ ${formatSeconds(step.end.estimatedSeconds)})`;
  }
}

function stepText(step: SimpleStep) {
  const name =
    step.type === "work"
      ? intensityLabels[step.intensity]
      : stepLabels[step.type];
  const parts = [
    `${name} ${stepEnd(step)}`,
    `zone ${intensityZone[step.intensity]}`,
    formatTarget(step.target),
  ];
  return `${parts.join(" · ")}${step.cue ? ` (${step.cue})` : ""}`;
}

function structureLines(structure: StructureStep[]) {
  return structure.flatMap((step) =>
    step.type === "repeat"
      ? [
          `  - ${step.count} × :`,
          ...step.steps.map((inner) => `    - ${stepText(inner)}`),
        ]
      : [`  - ${stepText(step)}`],
  );
}

function distanceText(
  session: PlanSession,
  paces: IntensityPaces | null,
): string | null {
  const distance = sessionDistance(session, paces);
  return distance
    ? `${distance.estimated ? "≈ " : ""}${formatKm(distance.meters)}`
    : null;
}

function isRest(session: PlanSession) {
  return session.sport === "rest" || session.kind === "rest";
}

function sessionLines(
  session: PlanSession,
  paces: IntensityPaces | null,
): string[] {
  const heading = `#### ${dayLabel(session.scheduledOn)} · ${familyLabels[sessionFamilyOf(session)]} · ${session.title}`;
  if (isRest(session)) return [heading, `- ${session.purpose}`];
  const tags = [
    sportLabels[session.sport],
    session.terrain ? terrainLabels[session.terrain] : null,
    session.isKey ? "séance clé" : null,
    priorityLabels[session.priority],
  ].filter((tag): tag is string => tag !== null);
  const volume = [
    `durée ${formatHoursText(session.targets.durationSeconds)}`,
    distanceText(session, paces),
    session.targets.elevationGainMeters !== null
      ? `${formatInteger(session.targets.elevationGainMeters)} m D+`
      : null,
  ].filter((part): part is string => part !== null);
  return [
    heading,
    `- ${tags.join(" · ")}`,
    `- Volume : ${volume.join(" · ")}`,
    `- But : ${session.purpose}`,
    ...(session.structure.length > 0
      ? ["- Déroulé :", ...structureLines(session.structure)]
      : []),
    ...(session.contingencies.length > 0
      ? [`- Adaptations prévues : ${session.contingencies.join(" ; ")}`]
      : []),
  ];
}

function plannedTotals(sessions: PlanSession[], paces: IntensityPaces | null) {
  let seconds = 0;
  let meters = 0;
  let estimated = false;
  let elevation = 0;
  for (const session of sessions) {
    seconds += session.targets.durationSeconds;
    elevation += session.targets.elevationGainMeters ?? 0;
    const distance = sessionDistance(session, paces);
    if (distance) {
      meters += distance.meters;
      estimated ||= distance.estimated;
    }
  }
  return { seconds, meters, estimated, elevation };
}

function totalsText(totals: ReturnType<typeof plannedTotals>) {
  return [
    formatHoursText(totals.seconds),
    totals.meters > 0
      ? `${totals.estimated ? "≈ " : ""}${formatKm(totals.meters)} de course`
      : null,
    totals.elevation > 0 ? `${formatInteger(totals.elevation)} m D+` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

function weekLines(
  week: PlanWeek,
  index: number,
  block: PlanBlock | undefined,
  sessions: PlanSession[],
  paces: IntensityPaces | null,
  today: string,
): string[] {
  const end = addDays(week.weekStart, 6);
  const marker =
    week.weekType === "recovery" ? " · semaine allégée (décharge)" : "";
  const current = today >= week.weekStart && today <= end ? " · en cours" : "";
  const { targets } = week;
  const target = [
    formatHoursText(targets.durationSeconds),
    targets.distanceMeters !== null ? formatKm(targets.distanceMeters) : null,
    targets.elevationGainMeters !== null
      ? `${formatInteger(targets.elevationGainMeters)} m D+`
      : null,
    plural(targets.qualitySessions, "séance de qualité", "séances de qualité"),
    targets.longRunSeconds !== null
      ? `sortie longue ${formatHoursText(targets.longRunSeconds)}`
      : null,
  ].filter((part): part is string => part !== null);
  const split = targets.intensitySplit;
  return [
    `### Semaine ${index + 1} · ${formatFrenchDate(week.weekStart)} → ${formatFrenchDate(end)} · ${weekTypeLabels[week.weekType]}${marker}${current}`,
    ...(block ? [`- Bloc : ${block.name}`] : []),
    `- Cible : ${target.join(" · ")}`,
    `- Répartition visée : ${split.easyPct} % facile · ${split.moderatePct} % modéré · ${split.hardPct} % intense`,
    `- Prévu par les séances : ${totalsText(plannedTotals(sessions, paces))} · ${plural(sessions.filter((session) => !isRest(session)).length, "séance", "séances")}`,
    ...(week.notes ? [`- Note : ${week.notes}`] : []),
    "",
    ...sessions.flatMap((session) => [...sessionLines(session, paces), ""]),
  ];
}

function raceLine(race: ProgramRace, role: RaceRole | null) {
  const facts = [
    race.priority ? `priorité ${race.priority}` : null,
    role ? roleLabels[role] : null,
    race.date ? formatFrenchDate(race.date) : "date à définir",
    race.distanceKm !== null ? `${formatDecimal(race.distanceKm)} km` : null,
    race.elevationGainM !== null
      ? `${formatInteger(race.elevationGainM)} m D+`
      : null,
    race.distanceKm && race.elevationGainM !== null
      ? `${formatInteger(race.elevationGainM / race.distanceKm)} m D+/km`
      : null,
    race.targetSeconds !== null
      ? `objectif ${formatHoursText(race.targetSeconds)}`
      : "sans objectif de temps",
  ].filter((fact): fact is string => fact !== null);
  return `- **${race.name}** · ${facts.join(" · ")}`;
}

function raceLines(state: PlanState, races: ProgramRace[]) {
  const roles = new Map<string, RaceRole>(
    state.plan.raceRoles.map((item) => [item.raceId, item.role]),
  );
  if (state.plan.primaryRaceId && !roles.has(state.plan.primaryRaceId))
    roles.set(state.plan.primaryRaceId, "primary");
  const planRaces = races
    .filter((race) => roles.has(race.id))
    .sort((first, second) =>
      (first.date ?? "9999").localeCompare(second.date ?? "9999"),
    );
  if (planRaces.length === 0) return [];
  return [
    "## Courses objectifs",
    ...planRaces.map((race) => raceLine(race, roles.get(race.id) ?? null)),
    "",
  ];
}

function paceLines(paces: IntensityPaces | null) {
  if (!paces) return [];
  const known = paceOrder.filter((intensity) => paces[intensity] !== undefined);
  if (known.length === 0) return [];
  return [
    "## Allures de référence de l’athlète (sur plat)",
    ...known.map(
      (intensity) =>
        `- ${intensityLabels[intensity]} (zone ${intensityZone[intensity]}) : ${formatPace(paces[intensity]!)}/km`,
    ),
    "",
  ];
}

function blockLines(state: PlanState) {
  const blocks = [...state.blocks].sort((first, second) =>
    first.startsOn.localeCompare(second.startsOn),
  );
  return [
    "## Structure en blocs",
    ...blocks.map((block) => {
      const weeks = state.weeks.filter(
        (week) => week.blockKey === block.blockKey,
      ).length;
      return `- **${block.name}** (${blockKindLabels[block.kind]}) · ${formatFrenchDate(block.startsOn)} → ${formatFrenchDate(block.endsOn)} · ${plural(weeks, "semaine", "semaines")} · ${block.objective}`;
    }),
    "",
  ];
}

export function programText(input: ProgramTextInput): string {
  const { state, today } = input;
  const paces = input.paces ?? null;
  const { plan } = state;
  const weeks = [...state.weeks].sort((first, second) =>
    first.weekStart.localeCompare(second.weekStart),
  );
  const sessions = [...state.sessions].sort((first, second) =>
    first.scheduledOn.localeCompare(second.scheduledOn),
  );
  const blocks = new Map(state.blocks.map((block) => [block.blockKey, block]));
  const remaining = daysBetween(today, plan.endsOn);
  const lines = [
    `# Programme d’entraînement · ${plan.title}`,
    "",
    "Programme de course à pied exporté depuis Stride, mon application de coaching, pour obtenir un second avis. Durées en heures et minutes, distances en kilomètres, D+ en mètres, allures en min/km. Les zones vont de 1 (récupération) à 5 (vitesse).",
    "",
    ...raceLines(state, input.races),
    "## Plan",
    `- Du ${formatFrenchDate(plan.startsOn)} au ${formatFrenchDate(plan.endsOn)} · ${plural(weeks.length, "semaine", "semaines")} · version ${input.version}`,
    `- Aujourd’hui : ${formatFrenchDate(today)}${remaining >= 0 ? ` · ${plural(remaining, "jour restant", "jours restants")} avant la fin du plan` : ""}`,
    `- Volume total prévu : ${totalsText(plannedTotals(sessions, paces))}`,
    `- Confiance du plan : ${plan.confidence.level === "low" ? "faible" : "normale"}${plan.confidence.reasons.length > 0 ? ` (${plan.confidence.reasons.join(" ; ")})` : ""}`,
    "",
    ...(input.summary ? ["## Logique du plan", input.summary, ""] : []),
    ...paceLines(paces),
    ...blockLines(state),
    "## Semaines et séances",
    "",
    ...weeks.flatMap((week, index) =>
      weekLines(
        week,
        index,
        blocks.get(week.blockKey),
        sessions.filter(
          (session) =>
            session.scheduledOn >= week.weekStart &&
            session.scheduledOn <= addDays(week.weekStart, 6),
        ),
        paces,
        today,
      ),
    ),
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}
