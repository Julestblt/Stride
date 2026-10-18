import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import {
  bodyAreas,
  conditionKinds,
  conditionReports,
  conditionStatuses,
  type StoredCondition,
} from "@/features/plans/health/health";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readPlanningConstraints } from "@/server/plans/constraints";
import { conditionColumns } from "@/server/plans/health";
import { defineTool } from "./define";
import { toolError } from "./errors";

export const conditionSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(conditionKinds),
  bodyArea: z.enum(bodyAreas).optional(),
  severity: z.int().min(0).max(10),
  startedOn: z.iso.date(),
  status: z.enum(conditionStatuses),
  resolvedOn: z.iso.date().optional(),
  worsening: z.boolean(),
  systemicSymptoms: z.boolean(),
  redFlag: z.boolean(),
  note: z.string().optional(),
});

export function toConditionOutput(
  condition: StoredCondition,
): z.input<typeof conditionSchema> {
  return {
    id: condition.id,
    kind: condition.kind,
    ...(condition.bodyArea ? { bodyArea: condition.bodyArea } : {}),
    severity: condition.severity,
    startedOn: condition.startedOn,
    status: condition.status,
    ...(condition.resolvedOn ? { resolvedOn: condition.resolvedOn } : {}),
    worsening: condition.worsening,
    systemicSymptoms: condition.systemicSymptoms,
    redFlag: condition.redFlag,
    ...(condition.note ? { note: condition.note } : {}),
  };
}

const severity = z
  .int()
  .min(0)
  .max(10)
  .describe("Severity on 0 to 10, as the athlete stated it.");
const worsening = z
  .boolean()
  .describe("True when the athlete says it is getting worse.");
const systemicSymptoms = z
  .boolean()
  .describe("True for fever, chills, body aches or other general symptoms.");
const redFlag = z
  .boolean()
  .describe(
    "True for pain at rest or at night, a precise spot on a bone, chest pain, fainting, or pain that changes the gait.",
  );
const note = z
  .string()
  .trim()
  .min(1)
  .max(280)
  .describe("Short French summary in the athlete's words.");

async function today(context: OnboardingContext) {
  const { timeZone } = await readPlanningConstraints(context);
  return localToday(timeZone);
}

function single(data: unknown[] | null) {
  const [condition] = conditionReports(data ?? []);
  if (!condition) throw new Error("Unexpected condition report row");
  return toConditionOutput(condition);
}

export const recordConditionReportTool = defineTool({
  name: "record_condition_report",
  description:
    "Record a pain, illness or fatigue report in the athlete's health record. Stride uses open reports to validate every plan proposal: pain of 7 or more, worsening pain, a red flag or illness with systemic symptoms blocks running; pain of 4 to 6 blocks quality. Record only what the athlete stated or confirmed with ask_athlete; never estimate a severity. Check read_health_reports first and update an existing report for the same problem instead of recording a new one. Returns the stored report.",
  class: "record",
  dataClasses: ["health"],
  input: z.strictObject({
    kind: z.enum(conditionKinds),
    bodyArea: z
      .enum(bodyAreas)
      .optional()
      .describe("Body area of a pain; omit for illness or fatigue."),
    severity,
    startedOn: z.iso
      .date()
      .optional()
      .describe("Date the problem started, at most today. Defaults to today."),
    status: z
      .enum(["active", "monitoring"])
      .describe(
        "active while it limits running; monitoring when it no longer limits running but is still followed.",
      ),
    worsening,
    systemicSymptoms,
    redFlag,
    note: note.optional(),
  }),
  output: conditionSchema,
  run: async (context, input) => {
    const day = await today(context);
    const startedOn = input.startedOn ?? day;
    if (startedOn > day)
      throw toolError("invalid_input", [
        { path: "startedOn", message: "La date de début est dans le futur." },
      ]);
    const { data, error } = await context.client
      .from("athlete_condition_reports")
      .insert({
        user_id: context.userId,
        kind: input.kind,
        body_area: input.bodyArea ?? null,
        severity: input.severity,
        started_on: startedOn,
        status: input.status,
        worsening: input.worsening,
        systemic_symptoms: input.systemicSymptoms,
        red_flag: input.redFlag,
        note: input.note ?? null,
        source: "coach_confirmed",
      })
      .select(conditionColumns);
    if (error) throw new Error("Unable to record the condition report");
    return single(data);
  },
});

export const updateConditionReportTool = defineTool({
  name: "update_condition_report",
  description:
    "Update an existing condition report from read_health_reports when the athlete reports a change: new severity, worsening, a red flag, or that it no longer limits running (monitoring) or is gone (resolved). Send only the fields that changed. Resolve a report only when the athlete says the problem is gone. Returns the stored report.",
  class: "record",
  dataClasses: ["health"],
  input: z
    .strictObject({
      id: z.uuid().describe("Report id from read_health_reports."),
      bodyArea: z.enum(bodyAreas).optional(),
      severity: severity.optional(),
      status: z.enum(conditionStatuses).optional(),
      worsening: worsening.optional(),
      systemicSymptoms: systemicSymptoms.optional(),
      redFlag: redFlag.optional(),
      note: note.optional(),
    })
    .refine((changes) => Object.keys(changes).length > 1, {
      message: "Send at least one changed field.",
    }),
  output: conditionSchema,
  run: async (context, input) => {
    const day = await today(context);
    const { data, error } = await context.client
      .from("athlete_condition_reports")
      .update({
        ...(input.bodyArea !== undefined ? { body_area: input.bodyArea } : {}),
        ...(input.severity !== undefined ? { severity: input.severity } : {}),
        ...(input.status !== undefined
          ? {
              status: input.status,
              resolved_on: input.status === "resolved" ? day : null,
            }
          : {}),
        ...(input.worsening !== undefined
          ? { worsening: input.worsening }
          : {}),
        ...(input.systemicSymptoms !== undefined
          ? { systemic_symptoms: input.systemicSymptoms }
          : {}),
        ...(input.redFlag !== undefined ? { red_flag: input.redFlag } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      })
      .eq("user_id", context.userId)
      .eq("id", input.id)
      .select(conditionColumns);
    if (error) throw new Error("Unable to update the condition report");
    if (!data?.length) throw toolError("not_found");
    return single(data);
  },
});
