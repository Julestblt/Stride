import { evaluateConstraintRules } from "./constraint-rules";
import type { ValidationInput } from "./input";
import { evaluateLoadRules } from "./load-rules";
import { ruleIds, toResult, type ValidationReport } from "./report";
import { thresholdsVersion } from "./thresholds";

export function validatePlan(input: ValidationInput): ValidationReport {
  const outcomes = {
    ...evaluateConstraintRules(input),
    ...evaluateLoadRules(input),
  };
  const results = ruleIds.map((ruleId) => {
    const outcome = outcomes[ruleId];
    if (!outcome) throw new Error(`Rule ${ruleId} was not evaluated`);
    return toResult(ruleId, outcome);
  });
  return {
    thresholdsVersion,
    valid: !results.some(
      (result) => result.outcome === "fail" && result.severity === "block",
    ),
    results,
  };
}
