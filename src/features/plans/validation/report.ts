import { z } from "zod";

export const ruleIds = [
  "I1",
  "I2",
  "I3",
  "I4",
  "C1",
  "C2",
  "C3",
  "H1",
  "H2",
  "H3",
  "E1",
  "E2",
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "D1",
] as const;
export type RuleId = (typeof ruleIds)[number];

export const severities = ["block", "warn", "info"] as const;
export type Severity = (typeof severities)[number];
export const grades = [
  "evidence",
  "convention",
  "integrity",
  "athlete_constraint",
  "contested",
] as const;
export type Grade = (typeof grades)[number];

export type RuleMeta = {
  severity: Severity;
  grade: Grade;
  citation: string | null;
  strong?: boolean;
};

const frandsen = "Frandsen et al., Br J Sports Med 2025";

export const ruleCatalogue: Record<RuleId, RuleMeta> = {
  I1: { severity: "block", grade: "integrity", citation: null },
  I2: { severity: "block", grade: "integrity", citation: null },
  I3: { severity: "block", grade: "integrity", citation: null },
  I4: { severity: "block", grade: "integrity", citation: null },
  C1: { severity: "block", grade: "athlete_constraint", citation: null },
  C2: { severity: "block", grade: "athlete_constraint", citation: null },
  C3: { severity: "block", grade: "athlete_constraint", citation: null },
  H1: { severity: "block", grade: "convention", citation: null },
  H2: { severity: "block", grade: "convention", citation: null },
  H3: { severity: "block", grade: "convention", citation: null },
  E1: { severity: "warn", grade: "evidence", citation: frandsen, strong: true },
  E2: { severity: "warn", grade: "evidence", citation: frandsen },
  P1: {
    severity: "warn",
    grade: "convention",
    citation: "Nielsen et al., JOSPT 2014 (above 30% over two weeks)",
  },
  P2: { severity: "warn", grade: "convention", citation: null },
  P3: { severity: "warn", grade: "convention", citation: null },
  P4: { severity: "warn", grade: "convention", citation: null },
  P5: {
    severity: "warn",
    grade: "convention",
    citation: "Oliveira et al., Sports Med 2024 (mixed evidence)",
  },
  P6: {
    severity: "warn",
    grade: "evidence",
    citation: "Bosquet et al., Med Sci Sports Exerc 2007",
  },
  P7: { severity: "warn", grade: "convention", citation: null },
  P8: {
    severity: "info",
    grade: "contested",
    citation: "Impellizzeri et al., IJSPP 2020",
  },
  D1: { severity: "info", grade: "convention", citation: null },
};

export const ruleResultSchema = z.strictObject({
  ruleId: z.enum(ruleIds),
  severity: z.enum(severities),
  grade: z.enum(grades),
  citation: z.string().nullable(),
  strong: z.boolean(),
  outcome: z.enum(["pass", "fail", "skipped"]),
  observed: z.number().nullable(),
  threshold: z.number().nullable(),
  keys: z.array(z.string()),
  issues: z.array(z.string()),
  skipReason: z.string().nullable(),
});

export const validationReportSchema = z.strictObject({
  thresholdsVersion: z.string(),
  valid: z.boolean(),
  results: z.array(ruleResultSchema).length(ruleIds.length),
});

export type RuleResult = z.infer<typeof ruleResultSchema>;
export type ValidationReport = z.infer<typeof validationReportSchema>;

export type RuleOutcome =
  | { outcome: "pass"; observed?: number | null; threshold?: number | null }
  | {
      outcome: "fail";
      observed?: number | null;
      threshold?: number | null;
      keys?: string[];
      issues?: string[];
      strong?: boolean;
      severity?: Severity;
    }
  | { outcome: "skipped"; reason: string; severity?: Severity };

export function toResult(ruleId: RuleId, outcome: RuleOutcome): RuleResult {
  const meta = ruleCatalogue[ruleId];
  const base = {
    ruleId,
    severity: meta.severity,
    grade: meta.grade,
    citation: meta.citation,
    strong: meta.strong ?? false,
    observed: null,
    threshold: null,
    keys: [],
    issues: [],
    skipReason: null,
  };
  if (outcome.outcome === "skipped")
    return {
      ...base,
      severity: outcome.severity ?? meta.severity,
      outcome: "skipped",
      skipReason: outcome.reason,
    };
  if (outcome.outcome === "pass")
    return {
      ...base,
      outcome: "pass",
      observed: outcome.observed ?? null,
      threshold: outcome.threshold ?? null,
    };
  return {
    ...base,
    outcome: "fail",
    severity: outcome.severity ?? meta.severity,
    strong: outcome.strong ?? base.strong,
    observed: outcome.observed ?? null,
    threshold: outcome.threshold ?? null,
    keys: [...new Set(outcome.keys ?? [])].sort(),
    issues: [...new Set(outcome.issues ?? [])].sort(),
  };
}
