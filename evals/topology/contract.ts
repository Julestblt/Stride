import { z } from "zod";
import { addDays, mondayOf } from "../../src/features/plans/model/dates";
import {
  blockKey,
  sessionKey,
  weekKey,
} from "../../src/features/plans/model/keys";
import {
  blockKinds,
  planStateSchema,
  sessionKinds,
  sessionSports,
  sessionTerrains,
  type PlanBlock,
  type PlanSession,
  type PlanState,
  type PlanWeek,
} from "../../src/features/plans/model/plan";
import {
  intensities,
  structureTotals,
  type SimpleStep,
  type StructureStep,
} from "../../src/features/plans/model/structure";
import { validatePlan } from "../../src/features/plans/validation/validate";
import { planStart, today, type Scenario } from "./scenarios";

const compactStepSchema = z.strictObject({
  type: z.enum(["warmup", "work", "recovery", "cooldown"]),
  minutes: z.number().positive().max(1440),
  intensity: z.enum(intensities),
  target: z.string(),
});

const compactSessionSchema = z.strictObject({
  date: z.iso.date(),
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
  lowConfidenceReasons: z.array(z.string().min(1).max(200)).max(5),
  weeks: z
    .array(
      z.strictObject({
        weekStart: z.iso.date(),
        phase: z.enum(blockKinds),
        notes: z.string().min(1).max(280).nullable(),
        sessions: z.array(compactSessionSchema).max(14),
      }),
    )
    .min(1)
    .max(30),
});

export type CompactPlan = z.infer<typeof compactPlanSchema>;
type CompactStep = z.infer<typeof compactStepSchema>;

export const outputContract = `Return only one JSON object, no prose and no code fence, with this shape:
{
  "title": string (French, max 120 chars),
  "summary": string (French explanation of the plan's logic for the athlete, max 1200 chars),
  "lowConfidenceReasons": string[] (French, empty when confidence is normal, max 5),
  "weeks": [{
    "weekStart": "YYYY-MM-DD" (a Monday; first week starts on the plan start date, one entry per week until the week containing the plan end date),
    "phase": one of ${blockKinds.join(", ")},
    "notes": string | null (French, max 280 chars),
    "sessions": [{
      "date": "YYYY-MM-DD",
      "sport": one of run, trail, strength, cross,
      "kind": one of ${sessionKinds.filter((kind) => kind !== "rest").join(", ")},
      "title": string (French, max 80 chars),
      "purpose": string (French, max 280 chars),
      "key": boolean (true for the week's key sessions),
      "km": number | null,
      "elevationGainMeters": integer | null,
      "terrain": one of road, trail, track, treadmill, mixed, or null,
      "steps": [ step | { "repeat": integer >= 2, "steps": [step, ...] } ]
    }]
  }]
}
step = { "type": "warmup" | "work" | "recovery" | "cooldown", "minutes": number, "intensity": one of ${intensities.join(", ")}, "target": "pace M:SS-M:SS" (per km, fast-slow) | "hr MIN-MAX" | "rpe MIN-MAX" | "none" }
Rules: every session has at least one work step and every work step has a target other than "none". The session duration is the sum of its steps. Do not list rest days. The race itself is a session of kind "race" on the race date. Every week from the plan start to the plan end is fully detailed. Only schedule sessions on the athlete's available days, keep weekday sessions within the maximum weekday duration, respect the weekly maximum and never schedule anything during unavailable periods.`;

function parseClock(value: string) {
  const [minutes, seconds] = value.split(":").map(Number);
  return minutes * 60 + seconds;
}

function toTarget(raw: string): SimpleStep["target"] {
  const text = raw.trim().toLowerCase().replace(/–/g, "-");
  const pace = text.match(/^pace\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (pace) {
    const [first, second] = [parseClock(pace[1]), parseClock(pace[2])];
    return {
      kind: "pace_range",
      fastSecondsPerKm: Math.min(first, second),
      slowSecondsPerKm: Math.max(first, second),
    };
  }
  const range = text.match(/^(hr|rpe)\s+(\d+)\s*-\s*(\d+)/);
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
    target: toTarget(step.target),
    intensity: step.intensity,
  };
}

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

function split(sessions: PlanSession[]) {
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

export function toPlanState(
  scenario: Scenario,
  compact: CompactPlan,
): PlanState {
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
        startsOn: week.weekStart,
        endsOn: week.weekStart,
        objective: week.notes ?? blockNames[week.phase],
        raceId: null,
      };
      blocks.push(block);
    }
    block.endsOn = [addDays(week.weekStart, 6), scenario.endsOn].sort()[0];
    const weekSessions = sessions.filter(
      (session) => mondayOf(session.scheduledOn) === week.weekStart,
    );
    const running = weekSessions.filter(
      (session) => session.sport === "run" || session.sport === "trail",
    );
    const distances = running.map((session) => session.targets.distanceMeters);
    const elevations = running.map(
      (session) => session.targets.elevationGainMeters,
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
        distanceMeters: distances.some((value) => value !== null)
          ? distances.reduce<number>((total, value) => total + (value ?? 0), 0)
          : null,
        elevationGainMeters: elevations.some((value) => value !== null)
          ? elevations.reduce<number>((total, value) => total + (value ?? 0), 0)
          : null,
        qualitySessions: running.filter((session) =>
          [
            "tempo",
            "threshold",
            "intervals",
            "hills",
            "race_specific",
          ].includes(session.kind),
        ).length,
        longRunSeconds: longRuns.length
          ? Math.max(
              ...longRuns.map((session) => session.targets.durationSeconds),
            )
          : null,
        intensitySplit: split(running),
      },
      notes: week.notes,
    });
  }
  const primary = scenario.races.find((race) => race.role === "primary");
  return {
    plan: {
      id: `bench-${scenario.id.toLowerCase()}`,
      title: compact.title,
      startsOn: planStart,
      endsOn: scenario.endsOn,
      timeZone: "Europe/Paris",
      primaryRaceId: primary?.id ?? null,
      raceRoles: scenario.races.map((race) => ({
        raceId: race.id,
        role: race.role,
      })),
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

export type Evaluation = {
  parsed: CompactPlan | null;
  errors: string[];
  blocking: string[];
  warnings: string[];
  qualityDespiteHealth: number;
};

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in the reply");
  return JSON.parse(text.slice(start, end + 1));
}

export function parseReply<T>(text: string, schema: z.ZodType<T>) {
  const result = schema.safeParse(extractJson(text));
  if (!result.success)
    throw new Error(
      result.error.issues
        .slice(0, 15)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n"),
    );
  return result.data;
}

export function evaluate(scenario: Scenario, text: string): Evaluation {
  let parsed: CompactPlan;
  try {
    parsed = parseReply(text, compactPlanSchema);
  } catch (error) {
    return {
      parsed: null,
      errors: [`contract: ${(error as Error).message}`],
      blocking: [],
      warnings: [],
      qualityDespiteHealth: 0,
    };
  }
  const state = toPlanState(scenario, parsed);
  const schema = planStateSchema.safeParse(state);
  const errors = schema.success
    ? []
    : schema.error.issues
        .slice(0, 15)
        .map((issue) => `plan_state ${issue.path.join(".")}: ${issue.message}`);
  const report = validatePlan({
    candidate: state,
    base: null,
    versions: null,
    today,
    matchedSessionKeys: new Set(),
    athlete: scenario.athlete,
    races: scenario.races,
    history: scenario.history,
    health: scenario.health
      ? { conditions: scenario.health.conditions, readiness: [] }
      : null,
    load: null,
    demands: null,
    specialistConstraints: [],
  });
  const describe = (result: (typeof report.results)[number]) =>
    `${result.ruleId}${result.strong ? " (strong)" : ""}: ${[...result.issues, ...result.keys.slice(0, 6)].join(", ")}${result.observed !== null ? ` observed=${result.observed} threshold=${result.threshold}` : ""}`;
  const failed = report.results.filter((result) => result.outcome === "fail");
  const quality = new Set([
    "tempo",
    "threshold",
    "intervals",
    "hills",
    "race_specific",
  ]);
  return {
    parsed,
    errors,
    blocking: failed
      .filter((result) => result.severity === "block")
      .map(describe),
    warnings: failed
      .filter((result) => result.severity === "warn")
      .map(describe),
    qualityDespiteHealth: scenario.health
      ? state.sessions.filter(
          (session) =>
            quality.has(session.kind) &&
            session.scheduledOn <= addDays(today, 14),
        ).length
      : 0,
  };
}

const weekdays = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

function frDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function shortDate(iso: string) {
  return `${weekdays[new Date(`${iso}T00:00:00Z`).getUTCDay()]} ${frDate(iso).slice(0, 5)}`;
}

function renderStep(step: CompactStep) {
  return `${step.type} ${step.minutes} min ${step.intensity}${step.target === "none" ? "" : ` (${step.target})`}`;
}

export function renderPlan(plan: CompactPlan) {
  const lines = [`Titre : ${plan.title}`, `Explication : ${plan.summary}`];
  if (plan.lowConfidenceReasons.length)
    lines.push(`Confiance faible : ${plan.lowConfidenceReasons.join(" ; ")}`);
  for (const week of plan.weeks) {
    const minutes = week.sessions.reduce(
      (total, session) =>
        total +
        session.steps.reduce(
          (sum, step) =>
            sum +
            ("repeat" in step
              ? step.repeat *
                step.steps.reduce((inner, child) => inner + child.minutes, 0)
              : step.minutes),
          0,
        ),
      0,
    );
    const km = week.sessions.reduce(
      (total, session) => total + (session.km ?? 0),
      0,
    );
    const elevation = week.sessions.reduce(
      (total, session) => total + (session.elevationGainMeters ?? 0),
      0,
    );
    lines.push(
      `\nSemaine du ${frDate(week.weekStart)} · ${week.phase} · ${Math.round(minutes)} min${km ? ` · ${Math.round(km)} km` : ""}${elevation ? ` · D+ ${elevation} m` : ""}${week.notes ? ` · ${week.notes}` : ""}`,
    );
    for (const session of week.sessions) {
      const steps = session.steps
        .map((step) =>
          "repeat" in step
            ? `${step.repeat} × [${step.steps.map(renderStep).join(" + ")}]`
            : renderStep(step),
        )
        .join(" ; ");
      lines.push(
        `- ${shortDate(session.date)} · ${session.sport}/${session.kind}${session.key ? " · clé" : ""} · ${session.title}${session.km ? ` · ${session.km} km` : ""}${session.elevationGainMeters ? ` · D+ ${session.elevationGainMeters} m` : ""} — ${steps} — ${session.purpose}`,
      );
    }
  }
  return lines.join("\n");
}
