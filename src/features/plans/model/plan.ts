import { z } from "zod";
import { addDays, isMonday } from "./dates";
import { sessionStructureSchema, structureIssues } from "./structure";

export const blockKinds = [
  "lead_in",
  "base",
  "build",
  "specific",
  "taper",
  "race",
  "recovery",
  "transition",
] as const;
export const weekTypes = [
  "lead_in",
  "build",
  "recovery",
  "taper",
  "race",
  "post_race",
] as const;
export const sessionSports = [
  "run",
  "trail",
  "strength",
  "cross",
  "rest",
] as const;
export const sessionKinds = [
  "easy",
  "long",
  "recovery",
  "tempo",
  "threshold",
  "intervals",
  "hills",
  "race_specific",
  "race",
  "strength",
  "mobility",
  "cross",
  "rest",
] as const;
export const sessionPriorities = ["high", "normal", "low"] as const;
export const sessionTerrains = [
  "road",
  "trail",
  "track",
  "treadmill",
  "mixed",
] as const;
export const sessionOrigins = ["template", "coach", "athlete"] as const;
export const raceRoles = ["primary", "preparation", "secondary"] as const;

const isoDate = z.iso.date();
const key = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
  .min(1);
const frenchText = (max: number) => z.string().trim().min(1).max(max);
const optionalAmount = (max: number) =>
  z.number().int().min(0).max(max).nullable();

export const planSchema = z
  .strictObject({
    id: z.string().min(1).max(64),
    title: frenchText(120),
    startsOn: isoDate,
    endsOn: isoDate,
    timeZone: z.string().min(1).max(64),
    primaryRaceId: z.string().min(1).max(64).nullable(),
    raceRoles: z
      .array(
        z.strictObject({
          raceId: z.string().min(1).max(64),
          role: z.enum(raceRoles),
        }),
      )
      .max(10),
    confidence: z.strictObject({
      level: z.enum(["normal", "low"]),
      reasons: z.array(frenchText(200)).max(5),
    }),
  })
  .refine((plan) => plan.startsOn <= plan.endsOn);

export const blockSchema = z
  .strictObject({
    blockKey: key,
    kind: z.enum(blockKinds),
    name: frenchText(80),
    startsOn: isoDate,
    endsOn: isoDate,
    objective: frenchText(280),
    raceId: z.string().min(1).max(64).nullable(),
  })
  .refine((block) => block.startsOn <= block.endsOn);

export const weekTargetsSchema = z
  .strictObject({
    durationSeconds: z.number().int().min(0).max(604_800),
    distanceMeters: optionalAmount(2_000_000),
    elevationGainMeters: optionalAmount(50_000),
    qualitySessions: z.number().int().min(0).max(7),
    longRunSeconds: optionalAmount(259_200),
    intensitySplit: z.strictObject({
      easyPct: z.number().int().min(0).max(100),
      moderatePct: z.number().int().min(0).max(100),
      hardPct: z.number().int().min(0).max(100),
    }),
  })
  .refine(
    ({ intensitySplit: split }) =>
      split.easyPct + split.moderatePct + split.hardPct === 100,
  );

export const weekSchema = z.strictObject({
  weekKey: key,
  weekStart: isoDate.refine(isMonday),
  blockKey: key,
  weekType: z.enum(weekTypes),
  targets: weekTargetsSchema,
  notes: frenchText(280).nullable(),
});

export const sessionTargetsSchema = z.strictObject({
  durationSeconds: z.number().int().min(0).max(259_200),
  distanceMeters: optionalAmount(400_000),
  elevationGainMeters: optionalAmount(30_000),
});

const sessionContentShape = z.strictObject({
  sport: z.enum(sessionSports),
  kind: z.enum(sessionKinds),
  title: frenchText(80),
  purpose: frenchText(280),
  isKey: z.boolean(),
  priority: z.enum(sessionPriorities),
  targets: sessionTargetsSchema,
  structure: sessionStructureSchema,
  terrain: z.enum(sessionTerrains).nullable(),
  origin: z.enum(sessionOrigins),
  contingencies: z.array(frenchText(160)).max(3),
});

function checkStructure(
  session: z.infer<typeof sessionContentShape>,
  context: z.RefinementCtx,
) {
  const isRest = session.sport === "rest" || session.kind === "rest";
  for (const issue of structureIssues(
    session.structure,
    session.targets.durationSeconds,
    isRest,
  ))
    context.addIssue({ code: "custom", message: issue, path: ["structure"] });
}

export const sessionContentSchema =
  sessionContentShape.superRefine(checkStructure);

export const sessionSchema = sessionContentShape
  .extend({ sessionKey: key, scheduledOn: isoDate })
  .superRefine(checkStructure);

export const planStateSchema = z
  .strictObject({
    plan: planSchema,
    blocks: z.array(blockSchema),
    weeks: z.array(weekSchema),
    sessions: z.array(sessionSchema),
  })
  .superRefine((state, context) => {
    const unique = (keys: string[], path: string) => {
      if (new Set(keys).size !== keys.length)
        context.addIssue({
          code: "custom",
          message: "duplicate_key",
          path: [path],
        });
    };
    unique(
      state.blocks.map((block) => block.blockKey),
      "blocks",
    );
    unique(
      state.weeks.map((week) => week.weekKey),
      "weeks",
    );
    unique(
      state.sessions.map((session) => session.sessionKey),
      "sessions",
    );
    const blockKeys = new Set(state.blocks.map((block) => block.blockKey));
    if (state.weeks.some((week) => !blockKeys.has(week.blockKey)))
      context.addIssue({
        code: "custom",
        message: "unknown_block",
        path: ["weeks"],
      });
    const { startsOn, endsOn } = state.plan;
    if (
      state.sessions.some(
        (session) =>
          session.scheduledOn < startsOn || session.scheduledOn > endsOn,
      ) ||
      state.weeks.some(
        (week) =>
          addDays(week.weekStart, 6) < startsOn || week.weekStart > endsOn,
      )
    )
      context.addIssue({
        code: "custom",
        message: "outside_plan",
        path: ["plan"],
      });
  });

export type Plan = z.infer<typeof planSchema>;
export type PlanBlock = z.infer<typeof blockSchema>;
export type WeekTargets = z.infer<typeof weekTargetsSchema>;
export type PlanWeek = z.infer<typeof weekSchema>;
export type SessionContent = z.infer<typeof sessionContentSchema>;
export type PlanSession = z.infer<typeof sessionSchema>;
export type PlanState = z.infer<typeof planStateSchema>;
export type RaceRole = (typeof raceRoles)[number];
