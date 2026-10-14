export const templateIds = [
  "road_5_10k",
  "road_half",
  "road_marathon",
  "trail_short",
  "trail_marathon",
  "trail_ultra_80_100",
  "trail_100_miles",
  "base_building",
] as const;
export type TemplateId = (typeof templateIds)[number];

export const phaseIds = [
  "base",
  "development",
  "specific",
  "taper",
  "recovery",
] as const;
export type PhaseId = (typeof phaseIds)[number];

type Range = { start: number; end: number };

export type TemplatePhase = {
  id: PhaseId;
  weeks: { min: number; max: number };
  volumePct: Range;
  elevationPct: Range | null;
  intensity: { easyPct: number; moderatePct: number; hardPct: number };
  qualitySessions: number;
  longRun: { sharePct: number; capMinutes: number };
};

export type PlanTemplate = {
  id: TemplateId;
  label: string;
  sport: "road" | "trail";
  distanceKm: { min: number; max: number };
  weeks: { min: number; default: number; max: number };
  peakWeekHours: { min: number; max: number };
  stretchOrder: PhaseId[];
  lighterWeek: {
    everyWeeks: number;
    volumeFactor: number;
    elevationFactor: number;
    qualitySessionsMax: number;
    phases: PhaseId[];
  };
  phases: TemplatePhase[];
  confidence: "normal" | "low";
  source: "ai-running-coach" | "stride";
};

export const templateSource =
  "ai-running-coach v1.3.0, config/plans/*.json (MIT); approximations du projet";

const split = (easyPct: number, moderatePct: number, hardPct: number) => ({
  easyPct,
  moderatePct,
  hardPct,
});
const stretchOrder: PhaseId[] = ["development", "specific", "base", "taper"];
const lighterWeek = {
  everyWeeks: 4,
  volumeFactor: 0.8,
  elevationFactor: 0.8,
  qualitySessionsMax: 1,
  phases: ["base", "development", "specific"] as PhaseId[],
};
const phase = (
  id: PhaseId,
  weeks: [number, number],
  volume: [number, number],
  elevation: [number, number] | null,
  intensity: ReturnType<typeof split>,
  qualitySessions: number,
  longRun: [number, number],
): TemplatePhase => ({
  id,
  weeks: { min: weeks[0], max: weeks[1] },
  volumePct: { start: volume[0], end: volume[1] },
  elevationPct: elevation ? { start: elevation[0], end: elevation[1] } : null,
  intensity,
  qualitySessions,
  longRun: { sharePct: longRun[0], capMinutes: longRun[1] },
});

export const planTemplates: Record<TemplateId, PlanTemplate> = {
  road_5_10k: {
    id: "road_5_10k",
    label: "Route 5–10 km",
    sport: "road",
    distanceKm: { min: 0, max: 15 },
    weeks: { min: 6, default: 8, max: 12 },
    peakWeekHours: { min: 2.5, max: 5 },
    stretchOrder,
    lighterWeek,
    phases: [
      phase("base", [2, 3], [92, 94], null, split(88, 4, 8), 1, [28, 75]),
      phase(
        "development",
        [2, 4],
        [95, 97],
        null,
        split(82, 4, 14),
        2,
        [30, 90],
      ),
      phase("specific", [1, 4], [98, 100], null, split(80, 4, 16), 2, [30, 90]),
      phase("taper", [1, 1], [75, 60], null, split(80, 4, 16), 2, [28, 60]),
      phase("recovery", [1, 1], [50, 60], null, split(95, 5, 0), 0, [30, 60]),
    ],
    confidence: "normal",
    source: "stride",
  },
  road_half: {
    id: "road_half",
    label: "Semi-marathon",
    sport: "road",
    distanceKm: { min: 15, max: 30 },
    weeks: { min: 8, default: 12, max: 16 },
    peakWeekHours: { min: 3, max: 6 },
    stretchOrder,
    lighterWeek,
    phases: [
      phase("base", [2, 4], [92, 94], null, split(88, 4, 8), 1, [30, 90]),
      phase(
        "development",
        [3, 6],
        [95, 97],
        null,
        split(82, 4, 14),
        2,
        [32, 105],
      ),
      phase(
        "specific",
        [2, 5],
        [98, 100],
        null,
        split(80, 4, 16),
        2,
        [33, 120],
      ),
      phase("taper", [1, 2], [70, 55], null, split(80, 4, 16), 2, [30, 75]),
      phase("recovery", [1, 1], [45, 55], null, split(95, 5, 0), 0, [30, 60]),
    ],
    confidence: "normal",
    source: "ai-running-coach",
  },
  road_marathon: {
    id: "road_marathon",
    label: "Marathon",
    sport: "road",
    distanceKm: { min: 30, max: Number.POSITIVE_INFINITY },
    weeks: { min: 12, default: 16, max: 20 },
    peakWeekHours: { min: 4, max: 9 },
    stretchOrder,
    lighterWeek,
    phases: [
      phase("base", [3, 6], [88, 92], null, split(88, 4, 8), 1, [30, 120]),
      phase(
        "development",
        [4, 7],
        [92, 96],
        null,
        split(82, 4, 14),
        2,
        [32, 150],
      ),
      phase(
        "specific",
        [3, 6],
        [97, 100],
        null,
        split(80, 4, 16),
        2,
        [34, 180],
      ),
      phase("taper", [2, 3], [70, 50], null, split(80, 4, 16), 2, [30, 90]),
      phase("recovery", [1, 2], [45, 60], null, split(95, 5, 0), 0, [30, 60]),
    ],
    confidence: "normal",
    source: "ai-running-coach",
  },
  trail_short: {
    id: "trail_short",
    label: "Trail court",
    sport: "trail",
    distanceKm: { min: 0, max: 30 },
    weeks: { min: 8, default: 12, max: 16 },
    peakWeekHours: { min: 4, max: 7 },
    stretchOrder,
    lighterWeek,
    phases: [
      phase("base", [2, 4], [92, 94], [92, 94], split(88, 4, 8), 1, [28, 120]),
      phase(
        "development",
        [3, 6],
        [95, 97],
        [95, 97],
        split(84, 4, 12),
        2,
        [30, 150],
      ),
      phase(
        "specific",
        [2, 5],
        [98, 100],
        [98, 100],
        split(82, 4, 14),
        2,
        [32, 165],
      ),
      phase("taper", [1, 2], [70, 55], [65, 50], split(82, 4, 14), 2, [30, 90]),
      phase(
        "recovery",
        [1, 1],
        [45, 55],
        [30, 40],
        split(95, 5, 0),
        0,
        [30, 60],
      ),
    ],
    confidence: "normal",
    source: "ai-running-coach",
  },
  trail_marathon: {
    id: "trail_marathon",
    label: "Marathon trail",
    sport: "trail",
    distanceKm: { min: 30, max: 60 },
    weeks: { min: 12, default: 16, max: 20 },
    peakWeekHours: { min: 6, max: 10 },
    stretchOrder,
    lighterWeek,
    phases: [
      phase("base", [3, 6], [88, 92], [88, 92], split(88, 4, 8), 1, [28, 150]),
      phase(
        "development",
        [4, 7],
        [92, 96],
        [92, 96],
        split(84, 4, 12),
        2,
        [30, 180],
      ),
      phase(
        "specific",
        [3, 6],
        [97, 100],
        [97, 100],
        split(82, 4, 14),
        2,
        [32, 240],
      ),
      phase(
        "taper",
        [2, 2],
        [70, 50],
        [65, 45],
        split(82, 4, 14),
        2,
        [30, 100],
      ),
      phase(
        "recovery",
        [1, 2],
        [45, 60],
        [30, 45],
        split(95, 5, 0),
        0,
        [30, 60],
      ),
    ],
    confidence: "normal",
    source: "ai-running-coach",
  },
  trail_ultra_80_100: {
    id: "trail_ultra_80_100",
    label: "Ultra 80–100 km",
    sport: "trail",
    distanceKm: { min: 60, max: 130 },
    weeks: { min: 16, default: 20, max: 24 },
    peakWeekHours: { min: 8, max: 13 },
    stretchOrder,
    lighterWeek,
    phases: [
      phase("base", [4, 7], [86, 90], [86, 90], split(90, 3, 7), 1, [28, 180]),
      phase(
        "development",
        [5, 8],
        [91, 96],
        [91, 96],
        split(86, 4, 10),
        2,
        [30, 240],
      ),
      phase(
        "specific",
        [4, 7],
        [97, 100],
        [97, 100],
        split(84, 4, 12),
        2,
        [33, 360],
      ),
      phase(
        "taper",
        [2, 3],
        [68, 45],
        [62, 40],
        split(84, 4, 12),
        1,
        [30, 120],
      ),
      phase(
        "recovery",
        [2, 2],
        [40, 55],
        [25, 40],
        split(95, 5, 0),
        0,
        [30, 60],
      ),
    ],
    confidence: "low",
    source: "ai-running-coach",
  },
  trail_100_miles: {
    id: "trail_100_miles",
    label: "100 miles",
    sport: "trail",
    distanceKm: { min: 130, max: Number.POSITIVE_INFINITY },
    weeks: { min: 20, default: 24, max: 29 },
    peakWeekHours: { min: 10, max: 16 },
    stretchOrder,
    lighterWeek,
    phases: [
      phase("base", [5, 8], [83, 88], [83, 88], split(90, 3, 7), 1, [25, 210]),
      phase(
        "development",
        [6, 10],
        [89, 95],
        [89, 95],
        split(86, 4, 10),
        2,
        [28, 270],
      ),
      phase(
        "specific",
        [5, 8],
        [96, 100],
        [96, 100],
        split(85, 4, 11),
        2,
        [33, 420],
      ),
      phase(
        "taper",
        [2, 3],
        [68, 40],
        [62, 35],
        split(85, 4, 11),
        1,
        [28, 120],
      ),
      phase(
        "recovery",
        [2, 3],
        [35, 50],
        [20, 35],
        split(95, 5, 0),
        0,
        [30, 60],
      ),
    ],
    confidence: "low",
    source: "ai-running-coach",
  },
  base_building: {
    id: "base_building",
    label: "Construction de base",
    sport: "road",
    distanceKm: { min: 0, max: 0 },
    weeks: { min: 4, default: 12, max: 52 },
    peakWeekHours: { min: 0, max: 0 },
    stretchOrder: ["base"],
    lighterWeek,
    phases: [
      phase(
        "base",
        [4, 52],
        [100, 100],
        [100, 100],
        split(88, 4, 8),
        1,
        [28, 120],
      ),
      phase(
        "recovery",
        [1, 1],
        [45, 55],
        [30, 40],
        split(95, 5, 0),
        0,
        [30, 60],
      ),
    ],
    confidence: "normal",
    source: "stride",
  },
};

export function matchTemplate(race: {
  distanceKm: number;
  kind: "road" | "trail";
}): PlanTemplate {
  return (
    Object.values(planTemplates).find(
      (template) =>
        template.id !== "base_building" &&
        template.sport === race.kind &&
        race.distanceKm >= template.distanceKm.min &&
        race.distanceKm < template.distanceKm.max,
    ) ?? planTemplates.base_building
  );
}

export function preRacePhases(template: PlanTemplate) {
  return template.phases.filter((item) => item.id !== "recovery");
}

export function allocatePhaseWeeks(
  template: PlanTemplate,
  weeks: number,
): Record<string, number> | null {
  if (weeks < template.weeks.min || weeks > template.weeks.max) return null;
  const phases = preRacePhases(template);
  const allocation = Object.fromEntries(
    phases.map((item) => [item.id, item.weeks.min]),
  );
  let extra = weeks - phases.reduce((total, item) => total + item.weeks.min, 0);
  const order = template.stretchOrder.filter((id) => id in allocation);
  while (extra > 0) {
    let progressed = false;
    for (const id of order) {
      const limit = phases.find((item) => item.id === id)!.weeks.max;
      if (extra > 0 && allocation[id] < limit) {
        allocation[id] += 1;
        extra -= 1;
        progressed = true;
      }
    }
    if (!progressed) return null;
  }
  return extra === 0 ? allocation : null;
}

function interpolate(range: Range | null, index: number, count: number) {
  if (!range) return null;
  if (count <= 1) return range.end;
  return range.start + ((range.end - range.start) * index) / (count - 1);
}

export type ResolvedWeek = {
  index: number;
  phase: TemplatePhase;
  kind: "build" | "lighter" | "taper" | "post_race";
  volumePct: number;
  elevationPct: number | null;
  qualitySessions: number;
};

export function resolveTemplateWeeks(
  template: PlanTemplate,
  weeks: number,
): ResolvedWeek[] | null {
  const allocation = allocatePhaseWeeks(template, weeks);
  if (!allocation) return null;
  const slots = preRacePhases(template).flatMap((item) =>
    Array.from({ length: allocation[item.id] }, (_, index) => ({
      phase: item,
      index,
      count: allocation[item.id],
    })),
  );
  const resolved: ResolvedWeek[] = [];
  let lastVolume: number | null = null;
  let lastElevation: number | null = null;
  const rule = template.lighterWeek;
  slots.forEach((slot, position) => {
    const index = position + 1;
    let volumePct = interpolate(slot.phase.volumePct, slot.index, slot.count)!;
    let elevationPct = interpolate(
      slot.phase.elevationPct,
      slot.index,
      slot.count,
    );
    let qualitySessions = slot.phase.qualitySessions;
    let kind: ResolvedWeek["kind"] =
      slot.phase.id === "taper" ? "taper" : "build";
    const nextIsTaper = slots[position + 1]?.phase.id === "taper";
    if (
      kind === "build" &&
      index % rule.everyWeeks === 0 &&
      rule.phases.includes(slot.phase.id) &&
      !nextIsTaper &&
      lastVolume !== null
    ) {
      kind = "lighter";
      volumePct = lastVolume * rule.volumeFactor;
      if (elevationPct !== null && lastElevation !== null)
        elevationPct = lastElevation * rule.elevationFactor;
      qualitySessions = Math.min(qualitySessions, rule.qualitySessionsMax);
    } else {
      lastVolume = volumePct;
      lastElevation = elevationPct;
    }
    resolved.push({
      index,
      phase: slot.phase,
      kind,
      volumePct,
      elevationPct,
      qualitySessions,
    });
  });
  const recovery = template.phases.find((item) => item.id === "recovery");
  if (recovery)
    for (let index = 0; index < recovery.weeks.min; index += 1)
      resolved.push({
        index: weeks + 1 + index,
        phase: recovery,
        kind: "post_race",
        volumePct: interpolate(recovery.volumePct, index, recovery.weeks.min)!,
        elevationPct: interpolate(
          recovery.elevationPct,
          index,
          recovery.weeks.min,
        ),
        qualitySessions: recovery.qualitySessions,
      });
  return resolved;
}

export function peakFactor(template: PlanTemplate) {
  const first = preRacePhases(template)[0];
  return {
    volume: 100 / first.volumePct.start,
    elevation: first.elevationPct ? 100 / first.elevationPct.start : null,
  };
}
