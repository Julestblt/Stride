import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { onboardingTestClients } from "../fixtures/onboarding-clients";
import { addDays, mondayOf } from "../../src/features/plans/model/dates";
import type { OnboardingContext } from "../../src/server/onboarding/context";

vi.mock("server-only", () => ({}));

import {
  coachingTools,
  runCustomTool,
} from "../../src/server/coaching/tools/registry";

const databaseUrl = process.env.COACHING_TEST_DATABASE_URL;
if (
  !databaseUrl ||
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)
)
  throw new Error("Coaching tool tests require a local Supabase database.");

const password = "Str1de-!coaching-tools-passphrase";
const { admin, athlete } = onboardingTestClients();
const sql = postgres(databaseUrl, { max: 1 });

type Seeded = {
  context: OnboardingContext;
  planTitle: string;
  planId: string;
  sessionKey: string;
  proposalId: string;
  activityId: string;
  raceId: string;
};

const createdUsers: string[] = [];

function isoDay(offset: number) {
  return new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
}

async function makeAthlete(): Promise<OnboardingContext> {
  const email = `coaching-tools-${crypto.randomUUID()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user)
    throw error ?? new Error("Unable to create an isolated athlete");
  createdUsers.push(data.user.id);
  const client = athlete();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session)
    throw signedIn.error ?? new Error("Unable to sign the athlete in");
  return {
    client,
    userId: data.user.id,
    email,
    accessToken: signedIn.data.session.access_token,
  } as OnboardingContext;
}

async function seed(label: "a" | "b"): Promise<Seeded> {
  const context = await makeAthlete();
  const userId = context.userId;
  const planTitle = `Plan isolé ${label} ${crypto.randomUUID()}`;
  const sessionKey = `s-${label}-done`;
  const [plan] = await sql<{ id: string }[]>`
    insert into public.training_plans (user_id, title, starts_on, ends_on, active_version, time_zone)
    values (${userId}, ${planTitle}, ${isoDay(-7)}, ${planEnd}, 1, 'Europe/Paris')
    returning id`;
  await sql`
    insert into public.plan_versions (plan_id, version, user_id, created_by, effective_from, confidence, content_hash)
    values (${plan.id}, 1, ${userId}, 'system', ${isoDay(-7)},
      ${sql.json({ level: "normal", reasons: [] })}, ${`hash-${label}`})`;
  const sessions = [
    { key: sessionKey, day: isoDay(-2), minutes: 40 },
    { key: `s-${label}-next`, day: isoDay(2), minutes: 50 },
  ];
  const revisions: Record<string, string> = {};
  for (const session of sessions) {
    const [row] = await sql<{ id: string }[]>`
      insert into public.plan_sessions (plan_id, user_id, session_key, valid_from_version, scheduled_on,
        sport, kind, title, purpose, is_key, priority, targets, structure, terrain, origin)
      values (${plan.id}, ${userId}, ${session.key}, 1, ${session.day}, 'run', 'easy',
        ${`Footing ${label}`}, 'Endurance fondamentale', false, 'normal',
        ${sql.json({ durationSeconds: session.minutes * 60, distanceMeters: null, elevationGainMeters: null })},
        ${sql.json([
          {
            type: "work",
            end: { kind: "time", seconds: session.minutes * 60 },
            target: { kind: "rpe", min: 3, max: 4 },
            intensity: "easy",
          },
        ])},
        'road', 'template')
      returning id`;
    revisions[session.key] = row.id;
  }
  const [proposal] = await sql<{ id: string }[]>`
    insert into public.plan_proposals (user_id, plan_id, base_version, scope, origin, requested_by,
      status, title, summary, rationale, operations, specialist_opinions, target_keys)
    values (${userId}, ${plan.id}, 1, 'session', 'recovery', 'athlete', 'rejected',
      ${`Proposition ${label}`}, ${`Résumé ${label}`}, ${`Raison ${label}`},
      ${sql.json([{ op: "skip_session", sessionKey: `s-${label}-next` }])},
      ${sql.json([{ specialist: "medical", verdict: "compatible", summary: label }])},
      ${[`s-${label}-next`]})
    returning id`;
  const [race] = await sql<{ id: string }[]>`
    insert into public.athlete_races (user_id, name, race_date, distance_km, race_kind, priority)
    values (${userId}, ${`Course ajoutée ${label}`}, ${raceDay}, 10, 'road', 'B')
    returning id`;
  await sql`
    insert into public.plan_decisions (user_id, proposal_id, decision, actor, note)
    values (${userId}, ${proposal.id}, 'rejected', 'athlete', ${`Note ${label}`})`;
  await sql`
    insert into public.athlete_wellness_checkins (user_id, checkin_date, legs, soreness, stress)
    values (${userId}, ${isoDay(-1)}, ${label === "a" ? "fresh" : "heavy"}, 'none', 'low')`;
  const connection = await admin
    .from("provider_connections")
    .insert({ user_id: userId, provider: "garmin", status: "connected" })
    .select("id")
    .single();
  if (connection.error) throw connection.error;
  const activity = await admin
    .from("provider_activities")
    .insert({
      user_id: userId,
      connection_id: connection.data.id,
      provider: "garmin",
      provider_activity_id: `coaching-tools-${label}-${crypto.randomUUID()}`,
      activity_type: "running",
      started_at: `${isoDay(-2)}T07:00:00Z`,
      duration_seconds: label === "a" ? 2_400 : 3_333,
      distance_meters: label === "a" ? 8_000 : 11_111,
    })
    .select("id")
    .single();
  if (activity.error) throw activity.error;
  const observation = await admin.from("provider_observations").insert({
    user_id: userId,
    connection_id: connection.data.id,
    provider: "garmin",
    domain: "fitness",
    availability: "available",
    metric: "race_prediction_10k_seconds",
    observed_on: isoDay(-1),
    value_numeric: label === "a" ? 2_700 : 3_011,
    unit: "s",
  });
  if (observation.error) throw observation.error;
  await sql`
    insert into public.session_activity_matches (user_id, plan_id, session_key, session_revision_id,
      activity_id, method, confidence, status)
    values (${userId}, ${plan.id}, ${sessionKey}, ${revisions[sessionKey]},
      ${activity.data.id}, 'athlete', 1, 'completed')`;
  return {
    context,
    planTitle,
    planId: plan.id,
    sessionKey,
    proposalId: proposal.id,
    activityId: activity.data.id,
    raceId: race.id,
  };
}

const planEnd = isoDay(21);
const raceDay = isoDay(35);

let a: Seeded;
let b: Seeded;

beforeAll(async () => {
  a = await seed("a");
  b = await seed("b");
});

afterAll(async () => {
  for (const userId of createdUsers) await admin.auth.admin.deleteUser(userId);
  await sql.end();
});

function easyWeek(monday: string) {
  return {
    weekStart: monday,
    phase: "base",
    notes: null,
    sessions: [1, 3]
      .map((offset) => addDays(monday, offset))
      .filter((date) => date <= raceDay)
      .map((date) => ({
        date,
        sport: "run",
        kind: "easy",
        title: "Footing",
        purpose: "Endurance fondamentale",
        key: false,
        km: null,
        elevationGainMeters: null,
        terrain: "road",
        steps: [
          { type: "work", minutes: 30, intensity: "easy", target: "rpe 3-4" },
        ],
      })),
  };
}

function extensionWeeks() {
  const weeks = [];
  for (
    let monday = addDays(mondayOf(planEnd), 7);
    monday <= mondayOf(raceDay);
    monday = addDays(monday, 7)
  )
    weeks.push(easyWeek(monday));
  return weeks;
}

function compactPlan() {
  const monday = addDays(mondayOf(isoDay(0)), 7);
  return {
    title: "Reprise isolée",
    summary: "Une semaine de reprise en endurance fondamentale.",
    startsOn: monday,
    endsOn: addDays(monday, 6),
    primaryRaceId: null,
    raceRoles: [],
    lowConfidenceReasons: [],
    weeks: [
      {
        weekStart: monday,
        phase: "base",
        notes: null,
        sessions: [1, 3].map((offset) => ({
          date: addDays(monday, offset),
          sport: "run",
          kind: "easy",
          title: "Footing",
          purpose: "Endurance fondamentale",
          key: false,
          km: null,
          elevationGainMeters: null,
          terrain: "road",
          steps: [
            { type: "work", minutes: 30, intensity: "easy", target: "rpe 3-4" },
          ],
        })),
      },
    ],
  };
}

function inputFor(name: string) {
  const range = { from: isoDay(-7), to: isoDay(14) };
  const inputs: Record<string, unknown> = {
    read_athlete_context: {},
    read_active_plan: range,
    read_plan_progress: range,
    read_plan_history: { limit: 20 },
    read_health_reports: { days: 14 },
    submit_plan: { plan: compactPlan() },
    create_plan_proposal: {
      title: "Footing décalé",
      summary: "Le footing passe au lendemain.",
      rationale: "Test d’isolation.",
      origin: "schedule",
      operations: [
        { op: "move_session", sessionKey: `s-a-next`, toDate: isoDay(3) },
      ],
      specialist_opinions: [],
    },
    extend_plan: {
      title: "Course ajoutée",
      summary: "Le plan continue jusqu’à la course ajoutée.",
      rationale: "Test d’isolation.",
      raceId: a.raceId,
      role: "secondary",
      endsOn: raceDay,
      weeks: extensionWeeks(),
      specialist_opinions: [],
    },
    ask_athlete: { question: "Comment te sens-tu ?" },
    message_athlete: { text: "Tu peux courir à plat." },
  };
  return inputs[name];
}

function foreignMarkers() {
  return [
    b.context.userId,
    b.planId,
    b.planTitle,
    b.proposalId,
    b.activityId,
    b.sessionKey,
    "s-b-next",
    "Proposition b",
    "Note b",
    "heavy",
  ];
}

const foreignNumbers = [3_333, 11_111, 3_011];

function numbersIn(value: unknown): number[] {
  if (typeof value === "number") return [value];
  if (Array.isArray(value)) return value.flatMap(numbersIn);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(numbersIn);
  return [];
}

describe("coaching tools run as athlete A", () => {
  it.each(coachingTools.map((tool) => tool.name))(
    "%s never returns athlete B's rows",
    async (name) => {
      const outcome = await runCustomTool(a.context, name, inputFor(name));
      const text = JSON.stringify(outcome.content);
      for (const marker of foreignMarkers()) expect(text).not.toContain(marker);
      for (const number of foreignNumbers)
        expect(numbersIn(outcome.content)).not.toContain(number);
      const handledBySession = !coachingTools.find((tool) => tool.name === name)
        ?.run;
      expect(outcome.ok, text).toBe(!handledBySession);
    },
  );

  it("reads A's own plan, progress, history and check-ins", async () => {
    const progress = await runCustomTool(
      a.context,
      "read_plan_progress",
      inputFor("read_plan_progress"),
    );
    expect(JSON.stringify(progress.content)).toContain(a.planTitle);
    expect(progress.content).toMatchObject({
      sessions: expect.arrayContaining([
        expect.objectContaining({
          key: a.sessionKey,
          status: "completed",
          activities: [
            expect.objectContaining({
              durationSeconds: 2_400,
              distanceMeters: 8_000,
              source: "garmin",
            }),
          ],
        }),
      ]),
    });
    const history = await runCustomTool(a.context, "read_plan_history", {});
    expect(history.content).toMatchObject({
      proposals: expect.arrayContaining([
        expect.objectContaining({
          id: a.proposalId,
          decisions: [expect.objectContaining({ decision: "rejected" })],
        }),
      ]),
    });
    const health = await runCustomTool(a.context, "read_health_reports", {
      days: 7,
    });
    expect(health.content).toMatchObject({
      checkins: [expect.objectContaining({ legs: "fresh" })],
    });
  });

  it("answers not_found for B's proposal id and B's session key", async () => {
    const history = await runCustomTool(a.context, "read_plan_history", {
      proposalId: b.proposalId,
    });
    expect(history.content).toMatchObject({ code: "not_found" });
    const proposal = await runCustomTool(a.context, "create_plan_proposal", {
      ...(inputFor("create_plan_proposal") as object),
      operations: [{ op: "skip_session", sessionKey: "s-b-next" }],
    });
    expect(proposal.content).toMatchObject({ code: "not_found" });
  });

  it("stores A's proposals for A only", async () => {
    const counts = async (userId: string) =>
      sql<{ scope: string; count: number }[]>`
        select scope, count(*)::integer as count from public.plan_proposals
        where user_id = ${userId} and status = 'ready'
        group by scope order by scope`;
    expect([...(await counts(a.context.userId))]).toEqual([
      { scope: "new_plan", count: 1 },
      { scope: "session", count: 1 },
    ]);
    expect([...(await counts(b.context.userId))]).toEqual([]);
    const [foreign] = await sql<{ count: number }[]>`
      select count(*)::integer as count from public.plan_proposals
      where user_id = ${b.context.userId}`;
    expect(foreign.count).toBe(1);
  });
});
