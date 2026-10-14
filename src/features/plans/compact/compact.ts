import { z } from "zod";
import { addDays, mondayOf } from "../model/dates";
import { blockKey, sessionKey, weekKey } from "../model/keys";
import {
  blockKinds,
  raceRoles,
  sessionKinds,
  sessionSports,
  sessionTerrains,
  type PlanBlock,
  type PlanSession,
  type PlanState,
  type PlanWeek,
} from "../model/plan";
import {
  intensities,
  structureTotals,
  type SimpleStep,
  type StructureStep,
} from "../model/structure";

const isoDate = z.iso.date();

const compactStepSchema = z.strictObject({
  type: z.enum(["warmup", "work", "recovery", "cooldown"]),
  minutes: z.number().positive().max(1440),
  intensity: z.enum(intensities),
  target: z.string().max(40),
});

const compactSessionSchema = z.strictObject({
  date: isoDate,
  sport: z.enum(sessionSports).exclude(["rest"]),
  kind: z.enum(sessionKinds).exclude(["rest"]),
  title: z.string().min(1).max(80),
  purpose: z.string().min(1).max(280),
  key: z.boolean(),
  km: z.number().min(0).max(400).nullable(),
  elevationGainMeters: z.number().int().min(0).max(30000).nullable(),
  terrain: z.enum(sessionTerrains).nullable(),
  steps: z
    .array(
      z.union([
        compactStepSchema,
        z.strictObject({
          repeat: z.number().int().min(2).max(50),
          steps: z.array(compactStepSchema).min(1).max(10),
        }),
      ]),
    )
    .min(1)
    .max(30),
});

export const compactPlanSchema = z.strictObject({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(1200),
  startsOn: isoDate,
  endsOn: isoDate,
  primaryRaceId: z.string().min(1).max(64).nullable(),
  raceRoles: z
    .array(
      z.strictObject({
        raceId: z.string().min(1).max(64),
        role: z.enum(raceRoles),
      }),
    )
    .max(10),
  lowConfidenceReasons: z.array(z.string().min(1).max(200)).max(5),
  weeks: z
    .array(
      z.strictObject({
        weekStart: isoDate,
        phase: z.enum(blockKinds),
        notes: z.string().min(1).max(280).nullable(),
        sessions: z.array(compactSessionSchema).max(14),
      }),
    )
    .min(1)
    .max(40),
});

export type CompactPlan = z.infer<typeof compactPlanSchema>;
type CompactStep = z.infer<typeof compactStepSchema>;

const qualityKinds = new Set<PlanSession["kind"]>([
  "tempo",
  "threshold",
  "intervals",
  "hills",
  "race_specific",
]);

const blockNames: Record<PlanBlock["kind"], string> = {
  lead_in: "Mise en route",
  base: "Foncier",
  build: "Développement",
  specific: "Spécifique",
  taper: "Affûtage",
  race: "Course",
  recovery: "Récupération",
  transition: "Transition",
};

const weekTypes: Record<PlanBlock["kind"], PlanWeek["weekType"]> = {
  lead_in: "lead_in",
  base: "build",
  build: "build",
  specific: "build",
  taper: "taper",
  race: "race",
  recovery: "recovery",
  transition: "post_race",
};

function parseClock(value: string) {
  const [minutes, seconds] = value.split(":").map(Number);
  return minutes * 60 + seconds;
}

export function parseTarget(raw: string): SimpleStep["target"] {
  const text = raw.trim().toLowerCase().replace(/–/g, "-");
  const pace = text.match(/^pace\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
  if (pace) {
    const [first, second] = [parseClock(pace[1]), parseClock(pace[2])];
    return {
      kind: "pace_range",
      fastSecondsPerKm: Math.min(first, second),
      slowSecondsPerKm: Math.max(first, second),
    };
  }
  const range = text.match(/^(hr|rpe)\s+(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const [low, high] = [Number(range[2]), Number(range[3])].sort(
      (a, b) => a - b,
    );
    return range[1] === "hr"
      ? { kind: "heart_rate_range", minBpm: low, maxBpm: high }
      : { kind: "rpe", min: low, max: high };
  }
  return { kind: "none" };
}

function toStep(step: CompactStep): SimpleStep {
  return {
    type: step.type,
    end: { kind: "time", seconds: Math.max(1, Math.round(step.minutes * 60)) },
    target: parseTarget(step.target),
    intensity: step.intensity,
  };
}

function intensitySplit(sessions: PlanSession[]) {
  const totals = { easy: 0, moderate: 0, hard: 0 };
  for (const session of sessions) {
    const { secondsByIntensity: s } = structureTotals(session.structure);
    totals.easy += s.recovery + s.easy;
    totals.moderate += s.marathon;
    totals.hard += s.threshold + s.interval + s.repetition;
  }
  const sum = totals.easy + totals.moderate + totals.hard;
  if (sum === 0) return { easyPct: 100, moderatePct: 0, hardPct: 0 };
  const moderatePct = Math.round((totals.moderate / sum) * 100);
  const hardPct = Math.round((totals.hard / sum) * 100);
  return { easyPct: 100 - moderatePct - hardPct, moderatePct, hardPct };
}

function sumOrNull(values: (number | null)[]) {
  return values.some((value) => value !== null)
    ? values.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;
}

function toSessions(compact: CompactPlan) {
  const sessions: PlanSession[] = [];
  for (const week of compact.weeks)
    for (const session of week.sessions) {
      const structure: StructureStep[] = session.steps.map((step) =>
        "repeat" in step
          ? {
              type: "repeat",
              count: step.repeat,
              steps: step.steps.map(toStep),
            }
          : toStep(step),
      );
      sessions.push({
        sessionKey: sessionKey(
          session.date,
          sessions.map((existing) => existing.sessionKey),
        ),
        scheduledOn: session.date,
        sport: session.sport,
        kind: session.kind,
        title: session.title,
        purpose: session.purpose,
        isKey: session.key,
        priority: session.key ? "high" : "normal",
        targets: {
          durationSeconds: structureTotals(structure).durationSeconds ?? 0,
          distanceMeters:
            session.km === null ? null : Math.round(session.km * 1000),
          elevationGainMeters: session.elevationGainMeters,
        },
        structure,
        terrain: session.terrain,
        origin: "coach",
        contingencies: [],
      });
    }
  return sessions.sort((first, second) =>
    first.scheduledOn.localeCompare(second.scheduledOn),
  );
}

export function compactToPlanState(
  compact: CompactPlan,
  timeZone: string,
): PlanState {
  const sessions = toSessions(compact);
  const blocks: PlanBlock[] = [];
  const weeks: PlanWeek[] = [];
  const ordinals = new Map<string, number>();
  for (const week of compact.weeks) {
    let block = blocks.at(-1);
    if (!block || block.kind !== week.phase) {
      const ordinal = (ordinals.get(week.phase) ?? 0) + 1;
      ordinals.set(week.phase, ordinal);
      block = {
        blockKey: blockKey(week.phase, ordinal),
        kind: week.phase,
        name: blockNames[week.phase],
        startsOn:
          week.weekStart > compact.startsOn ? week.weekStart : compact.startsOn,
        endsOn: week.weekStart,
        objective: week.notes ?? blockNames[week.phase],
        raceId: null,
      };
      blocks.push(block);
    }
    block.endsOn = [addDays(week.weekStart, 6), compact.endsOn].sort()[0];
    const running = sessions.filter(
      (session) =>
        mondayOf(session.scheduledOn) === week.weekStart &&
        (session.sport === "run" || session.sport === "trail"),
    );
    const weekSessions = sessions.filter(
      (session) => mondayOf(session.scheduledOn) === week.weekStart,
    );
    const longRuns = running.filter((session) => session.kind === "long");
    weeks.push({
      weekKey: weekKey(week.weekStart),
      weekStart: week.weekStart,
      blockKey: block.blockKey,
      weekType: weekTypes[week.phase],
      targets: {
        durationSeconds: weekSessions.reduce(
          (total, session) => total + session.targets.durationSeconds,
          0,
        ),
        distanceMeters: sumOrNull(
          running.map((session) => session.targets.distanceMeters),
        ),
        elevationGainMeters: sumOrNull(
          running.map((session) => session.targets.elevationGainMeters),
        ),
        qualitySessions: running.filter((session) =>
          qualityKinds.has(session.kind),
        ).length,
        longRunSeconds: longRuns.length
          ? Math.max(
              ...longRuns.map((session) => session.targets.durationSeconds),
            )
          : null,
        intensitySplit: intensitySplit(running),
      },
      notes: week.notes,
    });
  }
  return {
    plan: {
      id: "coach",
      title: compact.title,
      startsOn: compact.startsOn,
      endsOn: compact.endsOn,
      timeZone,
      primaryRaceId: compact.primaryRaceId,
      raceRoles: compact.raceRoles,
      confidence: {
        level: compact.lowConfidenceReasons.length ? "low" : "normal",
        reasons: compact.lowConfidenceReasons,
      },
    },
    blocks,
    weeks,
    sessions,
  };
}
