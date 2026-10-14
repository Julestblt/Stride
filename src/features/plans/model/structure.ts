import { z } from "zod";

export const intensities = [
  "recovery",
  "easy",
  "marathon",
  "threshold",
  "interval",
  "repetition",
] as const;
export type Intensity = (typeof intensities)[number];

export const durationTolerance = 0.1;

const stepEndSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("time"),
    seconds: z.number().int().min(1).max(86_400),
  }),
  z.strictObject({
    kind: z.literal("distance"),
    meters: z.number().int().min(1).max(400_000),
    estimatedSeconds: z.number().int().min(1).max(86_400).optional(),
  }),
  z.strictObject({
    kind: z.literal("lap_button"),
    estimatedSeconds: z.number().int().min(1).max(86_400),
  }),
]);

const stepTargetSchema = z.discriminatedUnion("kind", [
  z
    .strictObject({
      kind: z.literal("pace_range"),
      fastSecondsPerKm: z.number().int().min(120).max(1_200),
      slowSecondsPerKm: z.number().int().min(120).max(1_200),
    })
    .refine((target) => target.fastSecondsPerKm <= target.slowSecondsPerKm),
  z
    .strictObject({
      kind: z.literal("heart_rate_range"),
      minBpm: z.number().int().min(40).max(230),
      maxBpm: z.number().int().min(40).max(230),
    })
    .refine((target) => target.minBpm <= target.maxBpm),
  z
    .strictObject({
      kind: z.literal("rpe"),
      min: z.number().int().min(1).max(10),
      max: z.number().int().min(1).max(10),
    })
    .refine((target) => target.min <= target.max),
  z.strictObject({ kind: z.literal("none") }),
]);

export const simpleStepSchema = z.strictObject({
  type: z.enum(["warmup", "work", "recovery", "cooldown"]),
  end: stepEndSchema,
  target: stepTargetSchema,
  intensity: z.enum(intensities),
  cue: z.string().trim().min(1).max(80).optional(),
});

export const repeatStepSchema = z.strictObject({
  type: z.literal("repeat"),
  count: z.number().int().min(2).max(50),
  steps: z.array(simpleStepSchema).min(1).max(10),
});

export const structureStepSchema = z.union([
  simpleStepSchema,
  repeatStepSchema,
]);
export const sessionStructureSchema = z.array(structureStepSchema).max(30);

export type SimpleStep = z.infer<typeof simpleStepSchema>;
export type RepeatStep = z.infer<typeof repeatStepSchema>;
export type StructureStep = z.infer<typeof structureStepSchema>;
export type SessionStructure = z.infer<typeof sessionStructureSchema>;

export type StructureTotals = {
  durationSeconds: number | null;
  distanceMeters: number;
  distanceComplete: boolean;
  secondsByIntensity: Record<Intensity, number>;
};

function midPace(step: SimpleStep) {
  return step.target.kind === "pace_range"
    ? (step.target.fastSecondsPerKm + step.target.slowSecondsPerKm) / 2
    : null;
}

function stepSeconds(step: SimpleStep) {
  if (step.end.kind === "time") return step.end.seconds;
  if (step.end.kind === "lap_button") return step.end.estimatedSeconds;
  if (step.end.estimatedSeconds) return step.end.estimatedSeconds;
  const pace = midPace(step);
  return pace === null ? null : Math.round((step.end.meters / 1000) * pace);
}

function stepMeters(step: SimpleStep, seconds: number | null) {
  if (step.end.kind === "distance") return step.end.meters;
  const pace = midPace(step);
  return pace === null || seconds === null
    ? null
    : Math.round((seconds / pace) * 1000);
}

function flatten(structure: SessionStructure) {
  return structure.flatMap((step) =>
    step.type === "repeat"
      ? Array.from({ length: step.count }, () => step.steps).flat()
      : [step],
  );
}

export function structureTotals(structure: SessionStructure): StructureTotals {
  const secondsByIntensity = Object.fromEntries(
    intensities.map((intensity) => [intensity, 0]),
  ) as Record<Intensity, number>;
  let durationSeconds: number | null = 0;
  let distanceMeters = 0;
  let distanceComplete = true;
  for (const step of flatten(structure)) {
    const seconds = stepSeconds(step);
    const meters = stepMeters(step, seconds);
    if (seconds === null) durationSeconds = null;
    else {
      if (durationSeconds !== null) durationSeconds += seconds;
      secondsByIntensity[step.intensity] += seconds;
    }
    if (meters === null) distanceComplete = false;
    else distanceMeters += meters;
  }
  return {
    durationSeconds,
    distanceMeters,
    distanceComplete,
    secondsByIntensity,
  };
}

export type StructureIssue =
  | "missing_work_step"
  | "untargeted_work_step"
  | "unknown_duration"
  | "duration_mismatch"
  | "rest_with_structure";

export function structureIssues(
  structure: SessionStructure,
  declaredDurationSeconds: number,
  isRest: boolean,
): StructureIssue[] {
  if (isRest)
    return structure.length > 0 || declaredDurationSeconds > 0
      ? ["rest_with_structure"]
      : [];
  const steps = flatten(structure);
  const issues: StructureIssue[] = [];
  const work = steps.filter((step) => step.type === "work");
  if (work.length === 0) issues.push("missing_work_step");
  if (work.some((step) => step.target.kind === "none"))
    issues.push("untargeted_work_step");
  const { durationSeconds } = structureTotals(structure);
  if (durationSeconds === null) issues.push("unknown_duration");
  else if (
    Math.abs(durationSeconds - declaredDurationSeconds) >
    declaredDurationSeconds * durationTolerance
  )
    issues.push("duration_mismatch");
  return issues;
}
