import "server-only";
import { z } from "zod";
import { activityTitle } from "@/features/activities/activities";
import {
  attachmentRefs,
  coachAttachmentSchema,
  maxAttachments,
  type AttachmentOption,
  type AttachmentOptions,
  type AttachmentRef,
  type SentAttachment,
} from "@/features/coach/attachments";
import { addDays } from "@/features/plans/model/dates";
import { listActivities, readActivity } from "@/server/activities/activities";
import type { OnboardingContext } from "@/server/onboarding/context";
import { loadSessionDebrief } from "@/server/plans/debrief";
import { readActivePlan } from "@/server/plans/stored";
import type { DebriefView } from "@/features/plans/debrief/view";
import { listRaces } from "@/server/races/races";

export const sessionWindowDays = { past: 14, ahead: 28 } as const;
export const activityOptionCount = 20;

export class AttachmentAccessError extends Error {
  constructor() {
    super("attachment_not_found");
  }
}

const isoDate = z.iso.date();
const amount = z.number().nonnegative().optional();

const sessionContextSchema = z.strictObject({
  kind: z.literal("session"),
  id: z.string(),
  title: z.string(),
  date: isoDate,
  sport: z.string(),
  sessionKind: z.string(),
  purpose: z.string(),
  isKey: z.boolean(),
  durationMinutes: z.int().nonnegative(),
  distanceKm: amount,
  elevationGainM: amount,
  debrief: z
    .strictObject({
      activityId: z.string(),
      verdict: z.strictObject({ title: z.string(), body: z.string() }),
      stepsAligned: z.boolean(),
      note: z.string().optional(),
      steps: z
        .array(
          z.strictObject({
            name: z.string(),
            target: z.string(),
            actual: z.string(),
            detail: z.string().optional(),
            status: z.string().optional(),
          }),
        )
        .max(100),
      feeling: z
        .strictObject({
          source: z.enum(["garmin", "athlete"]),
          effort: z.int().min(1).max(10).optional(),
          feel: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const activityContextSchema = z.strictObject({
  kind: z.literal("activity"),
  id: z.string(),
  title: z.string(),
  date: isoDate,
  activityType: z.string().optional(),
  distanceKm: amount,
  durationMinutes: z.int().nonnegative().optional(),
  elevationGainM: amount,
  averageHeartRateBpm: z.int().positive().optional(),
});

const raceContextSchema = z.strictObject({
  kind: z.literal("race"),
  id: z.string(),
  title: z.string(),
  date: isoDate.nullable(),
  raceKind: z.string(),
  priority: z.string(),
  distanceKm: amount,
  elevationGainM: amount,
  targetSeconds: z.int().positive().optional(),
});

export const attachmentContextSchema = z.strictObject({
  type: z.literal("athlete_attachments"),
  note: z.string(),
  attachments: z
    .array(
      z.discriminatedUnion("kind", [
        sessionContextSchema,
        activityContextSchema,
        raceContextSchema,
      ]),
    )
    .min(1)
    .max(maxAttachments),
});

export type AttachmentContext = z.output<typeof attachmentContextSchema>;
export type ResolvedAttachment = AttachmentContext["attachments"][number];

const contextNote =
  "Éléments que l’athlète a joints à ce message. Fiches lues dans Stride pour son compte, en lecture seule.";

const rounded = (value: number | null, digits = 1) =>
  value === null || value < 0
    ? undefined
    : Math.round(value * 10 ** digits) / 10 ** digits;

function positiveInt(value: number | null) {
  const whole = value === null ? 0 : Math.round(value);
  return whole > 0 ? whole : undefined;
}

function debriefContext(debrief: DebriefView) {
  const { feeling } = debrief;
  return {
    activityId: debrief.activityId,
    verdict: { title: debrief.verdict.title, body: debrief.verdict.body },
    stepsAligned: debrief.aligned,
    ...(debrief.note && { note: debrief.note }),
    steps: debrief.steps.map((step) => ({
      name: step.name,
      target: step.target,
      actual: step.actual,
      ...(step.detail && { detail: step.detail }),
      ...(step.status && { status: step.status.label }),
    })),
    ...(feeling && {
      feeling: {
        source: feeling.source,
        ...(feeling.value.effort !== null && { effort: feeling.value.effort }),
        ...(feeling.feel && { feel: feeling.feel }),
      },
    }),
  };
}

async function resolveSessions(
  context: OnboardingContext,
  ids: string[],
): Promise<ResolvedAttachment[]> {
  if (ids.length === 0) return [];
  const [plan, debriefs] = await Promise.all([
    readActivePlan(context),
    Promise.all(
      ids.map((id) =>
        loadSessionDebrief(context, { sessionKey: id }).catch(() => null),
      ),
    ),
  ]);
  return ids.map((id, index) => {
    const session = plan?.state.sessions.find((item) => item.sessionKey === id);
    if (!session) throw new AttachmentAccessError();
    const debrief = debriefs[index];
    return {
      kind: "session",
      id,
      title: session.title,
      date: session.scheduledOn,
      sport: session.sport,
      sessionKind: session.kind,
      purpose: session.purpose,
      isKey: session.isKey,
      durationMinutes: Math.round(session.targets.durationSeconds / 60),
      distanceKm: rounded(
        session.targets.distanceMeters === null ||
          session.targets.distanceMeters === undefined
          ? null
          : session.targets.distanceMeters / 1000,
      ),
      elevationGainM: rounded(session.targets.elevationGainMeters ?? null, 0),
      ...(debrief && { debrief: debriefContext(debrief) }),
    };
  });
}

async function resolveActivities(
  context: OnboardingContext,
  ids: string[],
): Promise<ResolvedAttachment[]> {
  return Promise.all(
    ids.map(async (id) => {
      const activity = await readActivity(context, id);
      if (!activity) throw new AttachmentAccessError();
      return {
        kind: "activity" as const,
        id,
        title: activityTitle(activity),
        date: activity.date,
        activityType: activity.type ?? undefined,
        distanceKm: rounded(
          activity.distanceMeters === null
            ? null
            : activity.distanceMeters / 1000,
          2,
        ),
        durationMinutes:
          activity.durationSeconds === null
            ? undefined
            : Math.round(activity.durationSeconds / 60),
        elevationGainM: rounded(activity.elevationGainMeters, 0),
        averageHeartRateBpm: positiveInt(activity.averageHeartRate),
      };
    }),
  );
}

async function resolveRaces(
  context: OnboardingContext,
  ids: string[],
): Promise<ResolvedAttachment[]> {
  if (ids.length === 0) return [];
  const races = await listRaces(context);
  return ids.map((id) => {
    const race = races.find((item) => item.id === id);
    if (!race) throw new AttachmentAccessError();
    return {
      kind: "race",
      id,
      title: race.name,
      date: race.date,
      raceKind: race.kind,
      priority: race.priority,
      distanceKm: rounded(race.distanceKm),
      elevationGainM: rounded(race.elevationGainM, 0),
      targetSeconds: positiveInt(race.targetSeconds),
    };
  });
}

export async function resolveAttachments(
  context: OnboardingContext,
  refs: readonly AttachmentRef[],
): Promise<ResolvedAttachment[]> {
  const unique = attachmentRefs(refs);
  if (unique.length > maxAttachments) throw new AttachmentAccessError();
  const idsOf = (kind: AttachmentRef["kind"]) =>
    unique.flatMap((ref) => (ref.kind === kind ? [ref.id] : []));
  const [sessions, activities, races] = await Promise.all([
    resolveSessions(context, idsOf("session")),
    resolveActivities(context, idsOf("activity")),
    resolveRaces(context, idsOf("race")),
  ]);
  const resolved = [...sessions, ...activities, ...races];
  return unique.map((ref) =>
    resolved.find((item) => item.kind === ref.kind && item.id === ref.id)!,
  );
}

export function attachmentContextText(attachments: ResolvedAttachment[]) {
  return JSON.stringify(
    attachmentContextSchema.parse({
      type: "athlete_attachments",
      note: contextNote,
      attachments,
    }),
  );
}

export function sentAttachments(
  attachments: ResolvedAttachment[],
): SentAttachment[] {
  return attachments.map(({ kind, id, title, date }) => ({
    kind,
    id,
    title: title.slice(0, 120),
    date,
  }));
}

async function sessionOptions(
  context: OnboardingContext,
  today: string,
): Promise<AttachmentOption[]> {
  const plan = await readActivePlan(context);
  const from = addDays(today, -sessionWindowDays.past);
  const to = addDays(today, sessionWindowDays.ahead);
  return (plan?.state.sessions ?? [])
    .filter(
      (session) =>
        session.sport !== "rest" &&
        session.kind !== "rest" &&
        session.scheduledOn >= from &&
        session.scheduledOn <= to,
    )
    .map((session) => ({
      kind: "session",
      id: session.sessionKey,
      title: session.title,
      date: session.scheduledOn,
      distanceKm: null,
      elevationGainM: null,
    }));
}

export async function loadSessionOption(
  context: OnboardingContext,
  options: AttachmentOptions,
  sessionKey: string | null,
): Promise<AttachmentOption[]> {
  const ref = coachAttachmentSchema.safeParse({
    kind: "session",
    id: sessionKey,
  });
  if (!ref.success) return [];
  const listed = options.session.find((option) => option.id === ref.data.id);
  if (listed) return [listed];
  const plan = await readActivePlan(context).catch(() => null);
  const session = plan?.state.sessions.find(
    (item) => item.sessionKey === ref.data.id,
  );
  return session
    ? [
        {
          kind: "session",
          id: session.sessionKey,
          title: session.title,
          date: session.scheduledOn,
          distanceKm: null,
          elevationGainM: null,
        },
      ]
    : [];
}

async function activityOptions(
  context: OnboardingContext,
): Promise<AttachmentOption[]> {
  const { activities } = await listActivities(
    context,
    "all",
    activityOptionCount,
  );
  return activities.map((activity) => ({
    kind: "activity",
    id: activity.id,
    title: activityTitle(activity),
    date: activity.date,
    distanceKm:
      activity.distanceMeters === null ? null : activity.distanceMeters / 1000,
    elevationGainM: activity.elevationGainMeters,
  }));
}

async function raceOptions(
  context: OnboardingContext,
): Promise<AttachmentOption[]> {
  const races = await listRaces(context);
  return races.map((race) => ({
    kind: "race",
    id: race.id,
    title: race.name,
    date: race.date,
    distanceKm: race.distanceKm,
    elevationGainM: race.elevationGainM,
  }));
}

function orEmpty(options: Promise<AttachmentOption[]>, kind: string) {
  return options.catch((error: unknown) => {
    console.error("Coach attachment options were not read", {
      kind,
      error: error instanceof Error ? error.message : "unknown",
    });
    return [];
  });
}

export async function loadAttachmentOptions(
  context: OnboardingContext,
  today: string,
): Promise<AttachmentOptions> {
  const [session, activity, race] = await Promise.all([
    orEmpty(sessionOptions(context, today), "session"),
    orEmpty(activityOptions(context), "activity"),
    orEmpty(raceOptions(context), "race"),
  ]);
  return { session, activity, race };
}
