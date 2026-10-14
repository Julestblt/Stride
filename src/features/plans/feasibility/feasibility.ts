import { addDays, mondayOf } from "../model/dates";
import type { Objective } from "../skeleton/objective";
import type { Skeleton } from "../skeleton/skeleton";
import { planTemplates, type PlanTemplate } from "../templates/templates";

export const demandShare = 0.75;

export type FeasibilityOption =
  | { kind: "shorter_format"; templateId: PlanTemplate["id"]; label: string }
  | { kind: "later_race"; earliestDate: string }
  | { kind: "base_first" };

export type DemandComponent = {
  key: "longest_run" | "biggest_session_elevation";
  planned: number | null;
  target: number;
  status: "ok" | "short" | "unavailable";
};

export type Feasibility = {
  verdict: "realistic" | "ambitious" | "too_short" | "no_history";
  reasons: string[];
  options: FeasibilityOption[];
  demands: DemandComponent[];
};

export function longestRunTargetMeters(distanceKm: number) {
  const meters = distanceKm * 1000;
  return Math.min(Math.max(0.6 * meters, Math.min(meters, 30_000)), 60_000);
}

function formatHours(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes === 0
    ? `${hours} h`
    : `${hours} h ${String(minutes).padStart(2, "0")}`;
}

function shorterFormat(objective: Objective): FeasibilityOption[] {
  const race = objective.race;
  if (!race) return [];
  const ordered = Object.values(planTemplates).filter(
    (template) =>
      template.id !== "base_building" &&
      template.sport === race.kind &&
      template.distanceKm.max <= race.distanceKm,
  );
  const shorter = ordered.at(-1);
  return shorter
    ? [{ kind: "shorter_format", templateId: shorter.id, label: shorter.label }]
    : [];
}

export function assessFeasibility({
  objective,
  skeleton,
  today,
  optimisticSeconds = null,
}: {
  objective: Objective;
  skeleton: Skeleton;
  today: string;
  optimisticSeconds?: number | null;
}): Feasibility {
  if (skeleton.status === "no_history")
    return {
      verdict: "no_history",
      reasons: [
        "Pas assez de course à pied synchronisée pour connaître ton volume actuel. Indique ton temps de course hebdomadaire pour construire le plan.",
      ],
      options: [],
      demands: [],
    };
  if (skeleton.status === "too_short") {
    const start = mondayOf(today);
    return {
      verdict: "too_short",
      reasons: [
        `Il reste ${skeleton.weeksAvailable} semaine${skeleton.weeksAvailable > 1 ? "s" : ""} avant la course, le format ${skeleton.template.label} en demande au moins ${skeleton.minimumWeeks}. Stride ne compresse pas le plan.`,
      ],
      options: [
        ...shorterFormat(objective),
        {
          kind: "later_race",
          earliestDate: addDays(start, 7 * skeleton.minimumWeeks + 6),
        },
        { kind: "base_first" },
      ],
      demands: [],
    };
  }

  const reasons: string[] = [];
  const race = objective.race;
  const demands: DemandComponent[] = [];
  if (race && skeleton.template.id !== "base_building") {
    const longest = Math.max(
      0,
      ...skeleton.state.weeks.map((week) => week.targets.longRunSeconds ?? 0),
    );
    const longestMeters = skeleton.paceSecondsPerKm
      ? (longest / skeleton.paceSecondsPerKm) * 1000
      : null;
    const target = longestRunTargetMeters(race.distanceKm);
    demands.push({
      key: "longest_run",
      planned: longestMeters,
      target,
      status:
        longestMeters === null
          ? "unavailable"
          : longestMeters < target * demandShare
            ? "short"
            : "ok",
    });
    if (race.kind === "trail" && race.elevationGainM) {
      const peakWeek = skeleton.state.weeks.reduce((best, week) =>
        (week.targets.elevationGainMeters ?? 0) >
        (best.targets.elevationGainMeters ?? 0)
          ? week
          : best,
      );
      const elevation = peakWeek.targets.elevationGainMeters;
      const session =
        elevation !== null && peakWeek.targets.durationSeconds > 0
          ? elevation *
            ((peakWeek.targets.longRunSeconds ?? 0) /
              peakWeek.targets.durationSeconds)
          : null;
      const sessionTarget = Math.min(race.elevationGainM * 0.5, 2_500);
      demands.push({
        key: "biggest_session_elevation",
        planned: session,
        target: sessionTarget,
        status:
          session === null
            ? "unavailable"
            : session < sessionTarget * demandShare
              ? "short"
              : "ok",
      });
    }
  }
  for (const demand of demands.filter((item) => item.status === "short"))
    reasons.push(
      demand.key === "longest_run"
        ? `La plus longue sortie prévue reste sous 75 % de la cible (${Math.round(demand.target / 1000)} km) pour cette course.`
        : `Le dénivelé de la plus grosse sortie reste sous 75 % de la cible (${Math.round(demand.target)} m D+).`,
    );
  for (const warning of skeleton.warnings) {
    if (warning.code === "peak_below_template")
      reasons.push(
        `La semaine la plus chargée atteindrait ${formatHours(warning.peakSeconds)}, sous le repère de ${formatHours(warning.minimumSeconds)} pour ce format.`,
      );
    if (warning.code === "peak_capped_by_ceiling")
      reasons.push(
        `Ton plafond hebdomadaire limite la semaine la plus chargée à ${formatHours(warning.peakSeconds)}.`,
      );
  }
  if (
    race?.targetSeconds &&
    optimisticSeconds &&
    race.targetSeconds < optimisticSeconds
  )
    reasons.push(
      "Ton temps visé est plus rapide que l’estimation la plus optimiste de Stride.",
    );
  const ambitious = reasons.length > 0;
  return {
    verdict: ambitious ? "ambitious" : "realistic",
    reasons: ambitious
      ? reasons
      : ["Le temps disponible et ton volume actuel permettent ce format."],
    options: ambitious
      ? [
          ...(race
            ? [
                {
                  kind: "later_race" as const,
                  earliestDate: addDays(race.date, 28),
                },
              ]
            : []),
          ...shorterFormat(objective),
          { kind: "base_first" as const },
        ]
      : [],
    demands,
  };
}
