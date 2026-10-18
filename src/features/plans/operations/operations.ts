import { z } from "zod";
import {
  blockSchema,
  planStateSchema,
  raceRoles,
  sessionContentSchema,
  sessionSchema,
  weekSchema,
  weekTargetsSchema,
} from "../model/plan";
import { sessionStructureSchema } from "../model/structure";

const key = z.string().min(1).max(64);
const isoDate = z.iso.date();
const placedSessionSchema = z.strictObject({
  scheduledOn: isoDate,
  content: sessionContentSchema,
});

export const planOperationSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("create_plan"), state: planStateSchema }),
  z.strictObject({
    op: z.literal("move_session"),
    sessionKey: key,
    toDate: isoDate,
  }),
  z.strictObject({
    op: z.literal("swap_sessions"),
    firstKey: key,
    secondKey: key,
  }),
  z.strictObject({
    op: z.literal("shorten_session"),
    sessionKey: key,
    durationSeconds: z.number().int().min(0).max(259_200),
    structure: sessionStructureSchema,
  }),
  z.strictObject({
    op: z.literal("replace_session"),
    sessionKey: key,
    content: sessionContentSchema,
  }),
  z.strictObject({ op: z.literal("skip_session"), sessionKey: key }),
  z.strictObject({
    op: z.literal("add_session"),
    session: placedSessionSchema,
  }),
  z.strictObject({
    op: z.literal("set_week_targets"),
    weekKey: key,
    targets: weekTargetsSchema,
  }),
  z
    .strictObject({
      op: z.literal("replace_range"),
      from: isoDate,
      to: isoDate,
      sessions: z.array(placedSessionSchema).max(60),
    })
    .refine((operation) => operation.from <= operation.to),
  z.strictObject({
    op: z.literal("set_race_role"),
    raceId: key,
    role: z.enum(raceRoles).nullable(),
  }),
  z.strictObject({
    op: z.literal("extend_plan"),
    previousEndsOn: isoDate,
    endsOn: isoDate,
    raceId: key,
    role: z.enum(raceRoles),
    blocks: z.array(blockSchema).min(1).max(20),
    weeks: z.array(weekSchema).min(1).max(40),
    sessions: z.array(sessionSchema).max(320),
  }),
  z
    .strictObject({
      op: z.literal("rewrite_range"),
      from: isoDate,
      to: isoDate,
      blocks: z.array(blockSchema).min(1).max(20),
      weeks: z.array(weekSchema).min(1).max(40),
      sessions: z.array(sessionSchema).max(320),
    })
    .refine((operation) => operation.from <= operation.to),
]);

export const planOperationsSchema = z
  .array(planOperationSchema)
  .min(1)
  .max(100);

export type PlanOperation = z.infer<typeof planOperationSchema>;
export type PlacedSession = z.infer<typeof placedSessionSchema>;
