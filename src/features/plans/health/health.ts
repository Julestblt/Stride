import { z } from "zod";
import { readinessLevel } from "@/features/progress/recovery";
import { addDays } from "../model/dates";
import type { ConditionReport, ReadinessDay } from "../validation/input";

export const conditionKinds = ["pain", "illness", "fatigue", "other"] as const;
export const conditionStatuses = ["active", "monitoring", "resolved"] as const;
export const bodyAreas = [
  "foot",
  "ankle",
  "achilles",
  "calf",
  "shin",
  "knee",
  "thigh",
  "hamstring",
  "hip",
  "groin",
  "lower_back",
  "upper_body",
  "other",
] as const;

export type PlanningHealth = {
  conditions: ConditionReport[];
  readiness: ReadinessDay[];
};

export const storedConditionSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(conditionKinds),
    body_area: z.enum(bodyAreas).nullable(),
    severity: z.int().min(0).max(10),
    started_on: z.iso.date(),
    status: z.enum(conditionStatuses),
    resolved_on: z.iso.date().nullable(),
    worsening: z.boolean(),
    systemic_symptoms: z.boolean(),
    red_flag: z.boolean(),
    note: z.string().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    kind: row.kind,
    bodyArea: row.body_area,
    severity: row.severity,
    startedOn: row.started_on,
    status: row.status,
    resolvedOn: row.resolved_on,
    worsening: row.worsening,
    systemicSymptoms: row.systemic_symptoms,
    redFlag: row.red_flag,
    note: row.note,
  }));

export type StoredCondition = z.output<typeof storedConditionSchema>;

export function conditionReports(rows: unknown[]): StoredCondition[] {
  return rows.flatMap((row) => {
    const parsed = storedConditionSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export function toConditionReport(condition: StoredCondition): ConditionReport {
  return {
    kind: condition.kind,
    severity: condition.severity,
    status: condition.status,
    worsening: condition.worsening,
    systemicSymptoms: condition.systemicSymptoms,
    redFlag: condition.redFlag,
  };
}

export function readinessFromScore(score: number): ReadinessDay["level"] {
  const level = readinessLevel(score);
  if (level === "poor") return "red";
  if (level === "low") return "amber";
  return "green";
}

export function readinessDays(
  scores: { day: string; value: number }[],
  today: string,
): ReadinessDay[] {
  const yesterday = addDays(today, -1);
  const byDay = new Map<string, number>();
  for (const score of scores)
    if (score.day >= yesterday && score.day <= today)
      byDay.set(score.day, score.value);
  return [...byDay]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([date, value]) => ({ date, level: readinessFromScore(value) }));
}

export function planningHealth(
  conditions: StoredCondition[],
  readiness: ReadinessDay[],
): PlanningHealth {
  return {
    conditions: conditions
      .filter((condition) => condition.status !== "resolved")
      .map(toConditionReport),
    readiness,
  };
}
