import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import {
  matchStatuses,
  sessionStatuses,
  type MatchStatus,
} from "@/features/plans/matching/adherence";
import { sessionFamily } from "@/features/plans/matching/matching";
import type { PlanSession } from "@/features/plans/model/plan";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readSessionMatches, type SessionMatch } from "@/server/plans/matches";
import {
  dateRangeInput,
  planHeaderSchema,
  requireActivePlan,
} from "./active-plan";
import { defineTool } from "./define";

export const progressStatuses = [
  ...matchStatuses,
  "missed",
  "upcoming",
  "rest",
] as const;

export type ProgressStatus = (typeof progressStatuses)[number];

const activitySchema = z.strictObject({
  type: z.string(),
  durationSeconds: z.number().nonnegative().optional(),
  distanceMeters: z.number().nonnegative().optional(),
  elevationGainMeters: z.number().nonnegative().optional(),
  source: z.string(),
  asOf: z.iso.date(),
});

export type ProgressActivity = z.infer<typeof activitySchema>;

const progressSessionSchema = z.strictObject({
  key: z.string(),
  date: z.iso.date(),
  title: z.string(),
  kind: z.string(),
  family: z.enum(["run", "strength", "cross"]).optional(),
  isKey: z.boolean(),
  status: z.enum(progressStatuses),
  planned: z.strictObject({
    durationSeconds: z.int().nonnegative(),
    distanceMeters: z.int().nonnegative().optional(),
    elevationGainMeters: z.int().nonnegative().optional(),
  }),
  activities: z.array(activitySchema).optional(),
});

export type ProgressSession = z.infer<typeof progressSessionSchema>;

export function progressStatus(
  session: PlanSession,
  status: MatchStatus | undefined,
  today: string,
): ProgressStatus {
  if (sessionFamily(session) === null) return "rest";
  if (status) return status;
  return session.scheduledOn < today ? "missed" : "upcoming";
}

export function buildProgress({
  sessions,
  matches,
  activities,
  today,
}: {
  sessions: PlanSession[];
  matches: Pick<SessionMatch, "sessionKey" | "status" | "activityId">[];
  activities: Map<string, ProgressActivity>;
  today: string;
}): ProgressSession[] {
  const statuses = sessionStatuses(matches);
  return sessions.map((session) => {
    const family = sessionFamily(session);
    const linked = matches.flatMap((match) =>
      match.sessionKey === session.sessionKey &&
      match.status !== "dismissed" &&
      match.activityId
        ? (activities.get(match.activityId) ?? [])
        : [],
    );
    const { durationSeconds, distanceMeters, elevationGainMeters } =
      session.targets;
    return {
      key: session.sessionKey,
      date: session.scheduledOn,
      title: session.title,
      kind: session.kind,
      ...(family ? { family } : {}),
      isKey: session.isKey,
      status: progressStatus(session, statuses.get(session.sessionKey), today),
      planned: {
        durationSeconds,
        ...(distanceMeters ? { distanceMeters } : {}),
        ...(elevationGainMeters ? { elevationGainMeters } : {}),
      },
      ...(linked.length ? { activities: linked } : {}),
    };
  });
}

const measure = z.coerce.number().finite().positive().nullable().catch(null);

const activityRowSchema = z
  .object({
    id: z.uuid(),
    provider: z.string(),
    activity_type: z.string().nullable(),
    started_at: z.string().nullable(),
    local_started_at: z.string().nullable(),
    duration_seconds: measure,
    distance_meters: measure,
    elevation_gain_meters: measure,
  })
  .transform((row): [string, ProgressActivity] | null => {
    const started = row.local_started_at ?? row.started_at;
    if (!started) return null;
    return [
      row.id,
      {
        type: row.activity_type ?? "unknown",
        ...(row.duration_seconds
          ? { durationSeconds: Math.round(row.duration_seconds) }
          : {}),
        ...(row.distance_meters
          ? { distanceMeters: Math.round(row.distance_meters) }
          : {}),
        ...(row.elevation_gain_meters
          ? { elevationGainMeters: Math.round(row.elevation_gain_meters) }
          : {}),
        source: row.provider,
        asOf: started.slice(0, 10),
      },
    ];
  });

async function readActivities(
  context: OnboardingContext,
  ids: string[],
): Promise<Map<string, ProgressActivity>> {
  if (!ids.length) return new Map();
  const { data, error } = await context.client
    .from("provider_activities")
    .select(
      "id, provider, activity_type, started_at, local_started_at, duration_seconds, distance_meters, elevation_gain_meters",
    )
    .eq("user_id", context.userId)
    .in("id", ids);
  if (error) throw new Error("Unable to read the matched activities");
  return new Map(
    z
      .array(activityRowSchema)
      .parse(data ?? [])
      .filter((entry) => entry !== null),
  );
}

export const readPlanProgressTool = defineTool({
  name: "read_plan_progress",
  description:
    "Read planned-versus-completed progress of the active plan for a date range: each session's key, date, title, kind, sport family, planned targets and status (completed, partial, substituted, missed, dismissed, checked_in, upcoming or rest; checked_in means the athlete marked an untracked mobility session as done without an activity), with the matched activities' duration, distance and elevation. Matches come from Stride's automatic matching and the athlete's own choices. Returns JSON.",
  class: "read",
  dataClasses: ["plan", "training"],
  input: dateRangeInput,
  output: z.strictObject({
    today: z.iso.date(),
    plan: planHeaderSchema,
    sessions: z.array(progressSessionSchema),
  }),
  run: async (context, { from, to }) => {
    const stored = await requireActivePlan(context);
    const { plan } = stored.state;
    const today = localToday(plan.timeZone);
    const sessions = stored.state.sessions
      .filter(
        (session) => session.scheduledOn >= from && session.scheduledOn <= to,
      )
      .sort((first, second) =>
        first.scheduledOn.localeCompare(second.scheduledOn),
      );
    const keys = new Set(sessions.map((session) => session.sessionKey));
    const matches = (await readSessionMatches(context, stored.planId)).filter(
      (match) => keys.has(match.sessionKey),
    );
    const activities = await readActivities(context, [
      ...new Set(
        matches.flatMap((match) =>
          match.status !== "dismissed" && match.activityId
            ? [match.activityId]
            : [],
        ),
      ),
    ]);
    return {
      today,
      plan: {
        title: plan.title,
        startsOn: plan.startsOn,
        endsOn: plan.endsOn,
        timeZone: plan.timeZone,
        version: stored.activeVersion,
      },
      sessions: buildProgress({ sessions, matches, activities, today }),
    };
  },
});
