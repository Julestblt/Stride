import { planStateSchema, type PlanState } from "./plan";

export type PlanRow = {
  id: string;
  title: string;
  starts_on: string;
  ends_on: string;
  time_zone: string;
  primary_race_id: string | null;
};

export type PlanVersionRow = {
  version: number;
  race_roles: unknown;
  confidence: unknown;
};

export type PlanBlockRow = {
  block_key: string;
  kind: string;
  name: string;
  starts_on: string;
  ends_on: string;
  objective: string;
  race_id: string | null;
};

export type PlanWeekRow = {
  week_key: string;
  week_start: string;
  block_key: string;
  week_type: string;
  target_duration_s: number;
  target_distance_m: number | null;
  target_elevation_m: number | null;
  quality_sessions: number;
  long_run_target_s: number | null;
  intensity_split: unknown;
  notes: string | null;
};

export type PlanSessionRow = {
  session_key: string;
  scheduled_on: string;
  sport: string;
  kind: string;
  title: string;
  purpose: string;
  is_key: boolean;
  priority: string;
  targets: unknown;
  structure: unknown;
  terrain: string | null;
  origin: string;
  contingencies: unknown;
};

export type PlanRows = {
  plan: PlanRow;
  version: PlanVersionRow;
  blocks: PlanBlockRow[];
  weeks: PlanWeekRow[];
  sessions: PlanSessionRow[];
};

export function toPlanState(rows: PlanRows): PlanState {
  return planStateSchema.parse({
    plan: {
      id: rows.plan.id,
      title: rows.plan.title,
      startsOn: rows.plan.starts_on,
      endsOn: rows.plan.ends_on,
      timeZone: rows.plan.time_zone,
      primaryRaceId: rows.plan.primary_race_id,
      raceRoles: rows.version.race_roles,
      confidence: rows.version.confidence,
    },
    blocks: [...rows.blocks]
      .sort(
        (first, second) =>
          first.starts_on.localeCompare(second.starts_on) ||
          first.block_key.localeCompare(second.block_key),
      )
      .map((block) => ({
        blockKey: block.block_key,
        kind: block.kind,
        name: block.name,
        startsOn: block.starts_on,
        endsOn: block.ends_on,
        objective: block.objective,
        raceId: block.race_id,
      })),
    weeks: [...rows.weeks]
      .sort(
        (first, second) =>
          first.week_start.localeCompare(second.week_start) ||
          first.week_key.localeCompare(second.week_key),
      )
      .map((week) => ({
        weekKey: week.week_key,
        weekStart: week.week_start,
        blockKey: week.block_key,
        weekType: week.week_type,
        targets: {
          durationSeconds: week.target_duration_s,
          distanceMeters: week.target_distance_m,
          elevationGainMeters: week.target_elevation_m,
          qualitySessions: week.quality_sessions,
          longRunSeconds: week.long_run_target_s,
          intensitySplit: week.intensity_split,
        },
        notes: week.notes,
      })),
    sessions: [...rows.sessions]
      .sort(
        (first, second) =>
          first.scheduled_on.localeCompare(second.scheduled_on) ||
          first.session_key.localeCompare(second.session_key),
      )
      .map((session) => ({
        sessionKey: session.session_key,
        scheduledOn: session.scheduled_on,
        sport: session.sport,
        kind: session.kind,
        title: session.title,
        purpose: session.purpose,
        isKey: session.is_key,
        priority: session.priority,
        targets: session.targets,
        structure: session.structure,
        terrain: session.terrain,
        origin: session.origin,
        contingencies: session.contingencies,
      })),
  });
}
