import { describe, expect, it } from "vitest";
import {
  conditionReports,
  planningHealth,
  readinessDays,
  readinessFromScore,
} from "@/features/plans/health/health";

const row = (patch: Record<string, unknown> = {}) => ({
  id: "f0000000-0000-4000-8000-00000000000f",
  kind: "pain",
  body_area: "shin",
  severity: 4,
  started_on: "2026-10-10",
  status: "monitoring",
  resolved_on: null,
  worsening: false,
  systemic_symptoms: false,
  red_flag: false,
  note: "Tibia droit en descente",
  ...patch,
});

describe("planning health", () => {
  it("maps Garmin readiness bands to readiness levels", () => {
    expect([10, 24, 25, 49, 50, 90].map(readinessFromScore)).toEqual([
      "red",
      "red",
      "amber",
      "amber",
      "green",
      "green",
    ]);
  });

  it("keeps readiness for yesterday and today only, oldest first", () => {
    expect(
      readinessDays(
        [
          { day: "2026-10-18", value: 20 },
          { day: "2026-10-16", value: 10 },
          { day: "2026-10-17", value: 60 },
          { day: "2026-10-19", value: 10 },
        ],
        "2026-10-18",
      ),
    ).toEqual([
      { date: "2026-10-17", level: "green" },
      { date: "2026-10-18", level: "red" },
    ]);
    expect(readinessDays([], "2026-10-18")).toEqual([]);
  });

  it("validates against open reports only and drops malformed rows", () => {
    const reports = conditionReports([
      row(),
      row({ status: "resolved", resolved_on: "2026-10-15", severity: 8 }),
      row({ severity: 12 }),
      row({ kind: "injury" }),
    ]);
    expect(reports).toHaveLength(2);
    expect(planningHealth(reports, [])).toEqual({
      conditions: [
        {
          kind: "pain",
          severity: 4,
          status: "monitoring",
          worsening: false,
          systemicSymptoms: false,
          redFlag: false,
        },
      ],
      readiness: [],
    });
  });
});
