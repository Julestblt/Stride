import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const json = (response, status, value, headers = {}) => {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(value));
};
const failure = (response, status, code, headers) =>
  json(response, status, { error: { code } }, headers);

function subject(header) {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token === "invalid") return null;
  const [, payload] = token.split(".");
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).sub;
  } catch {
    return token;
  }
}

function category(state, extra = {}) {
  return {
    state,
    oldest_synchronized_date: null,
    last_success_at: null,
    last_error_code: null,
    ...extra,
  };
}

const minute = 60_000;

function parisMidnight(day) {
  const naive = Date.parse(`${day}T00:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(naive))
    .find((part) => part.type === "timeZoneName")
    .value.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = offset
    ? (offset[1] === "-" ? -1 : 1) *
      (Number(offset[2]) * 60 + Number(offset[3]))
    : 0;
  return naive - minutes * minute;
}

export function wellnessDay(day) {
  const midnight = parisMidnight(day);
  const at = (hours) => midnight + hours * 60 * minute;
  const sleepStart = at(-0.33);
  const sleepEnd = at(5.77);
  const stages = [];
  const pattern = [
    "light",
    "deep",
    "light",
    "rem",
    "light",
    "deep",
    "rem",
    "awake",
    "light",
    "rem",
  ];
  const step = (sleepEnd - sleepStart) / pattern.length;
  pattern.forEach((stage, index) =>
    stages.push({
      start: Math.round(sleepStart + index * step),
      end: Math.round(sleepStart + (index + 1) * step),
      stage,
    }),
  );
  const heart = [];
  const stress = [];
  const battery = [];
  const steps = [];
  for (let time = at(-2); time < at(24); time += 2 * minute) {
    const hours = (time - midnight) / (60 * minute);
    const sleeping = time >= sleepStart && time < sleepEnd;
    const meeting = hours >= 10.5 && hours < 11.75;
    heart.push([
      time,
      Math.round(
        sleeping
          ? 48 + Math.sin(hours) * 3
          : meeting
            ? 76
            : 62 + Math.sin(hours * 2) * 6,
      ),
    ]);
  }
  for (let time = at(-2); time < at(24); time += 3 * minute) {
    const hours = (time - midnight) / (60 * minute);
    const sleeping = time >= sleepStart && time < sleepEnd;
    const meeting = hours >= 10.5 && hours < 11.75;
    const pause = hours >= 12.67 && hours < 13.1;
    stress.push([
      time,
      sleeping
        ? 12
        : meeting
          ? 66
          : pause
            ? 12
            : 32 + Math.round(Math.sin(hours) * 8),
    ]);
  }
  for (let time = at(-2); time < at(24); time += 15 * minute) {
    const hours = (time - midnight) / (60 * minute);
    const level =
      hours < 0
        ? 26 - hours * 2
        : hours < 5.77
          ? 23 + hours * 6.6
          : 61 - (hours - 5.77) * 1.7;
    battery.push([time, Math.max(5, Math.round(level))]);
  }
  for (let hour = 0; hour < 24; hour++)
    steps.push([
      at(hour),
      hour < 6 ? 0 : hour === 8 ? 2120 : hour === 12 ? 900 : 260,
    ]);
  return {
    date: day,
    sleep: {
      start: sleepStart,
      end: sleepEnd,
      stages,
      deep_seconds: 3480,
      light_seconds: 12360,
      rem_seconds: 5280,
      awake_seconds: 840,
      awake_count: 1,
      score: 61,
      respiration_average: 14.2,
      spo2_average: 95,
      spo2_lowest: 89,
      hrv_average: 46,
    },
    heart_rate: heart,
    stress,
    body_battery: battery,
    steps,
    summary: {
      resting_heart_rate: 47,
      steps_total: 6050,
      steps_goal: 8000,
      stress_average: 34,
      stress_max: 88,
      body_battery_wake: 61,
      body_battery_charged: 38,
      body_battery_drained: 17,
      body_battery_highest: 61,
      body_battery_lowest: 23,
      body_battery_latest: 44,
    },
  };
}

const manualSyncIntervalMs = 5 * 60_000;

function job(state, updatedAt) {
  return { state, updated_at: updatedAt, last_error_code: null };
}

function manualPhases(connection, advance) {
  const manual = connection.manual;
  if (!manual) return {};
  if (advance) manual.reads += 1;
  const { reads, requestedAt } = manual;
  const now = new Date().toISOString();
  const activities =
    reads >= 2 ? "succeeded" : reads >= 1 ? "running" : "queued";
  const recovery = reads >= 3 ? "succeeded" : reads >= 2 ? "running" : "queued";
  if (recovery === "succeeded" && !manual.finished) {
    manual.finished = true;
    connection.lastSyncAt = now;
  }
  return {
    activities: {
      ...job(activities, reads ? now : requestedAt),
      phase: "activities",
    },
    recovery: {
      ...job(recovery, reads ? now : requestedAt),
      phase: "recovery",
    },
    tracks: { ...job("queued", requestedAt), phase: "tracks" },
  };
}

function syncFor(connection, advance = true) {
  const reads = advance ? ++connection.syncReads : connection.syncReads;
  const limit = connection.syncLimit ?? 4;
  const done = reads >= limit;
  const oldest = `${2026 - reads}-01-01`;
  return {
    connection_id: connection.id,
    categories: {
      activities: category(done ? "complete" : "running", {
        oldest_synchronized_date: oldest,
        activity_count: Math.min(reads, limit) * 25,
      }),
      recovery: category(reads >= 2 ? "complete" : "running", {
        oldest_synchronized_date: "2026-07-01",
      }),
      fitness: category(reads >= 3 ? "complete" : "partial", {
        oldest_synchronized_date: "2025-10-01",
      }),
      patterns: { state: done ? "complete" : "partial" },
    },
    last_sync_at: connection.lastSyncAt ?? connection.connectedAt,
    incremental: null,
    incremental_phases: manualPhases(connection, advance),
    manual_sync_available_at: connection.manualAvailableAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

const authUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_AUTH_PORT ?? 3200}`;

function usesRpe(steps) {
  return steps.some((step) =>
    step.type === "repeat" ? usesRpe(step.steps) : step.target?.kind === "rpe",
  );
}

async function storeWorkouts(user, connection) {
  await fetch(`${authUrl}/__test__/provider-workouts`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: user,
      rows: [...connection.workouts.values()].map((row) => ({
        external_key: row.key,
        scheduled_on: row.date,
        status: row.status,
        error_code: row.errorCode,
        simplifications: row.simplifications,
        sent_at: row.sentAt,
      })),
    }),
  }).catch(() => undefined);
}

function reconcile(connection, body) {
  const wanted = new Set(body.workouts.map((workout) => workout.key));
  const removed = [];
  for (const [key, row] of connection.workouts)
    if (!wanted.has(key) && row.date >= body.from && row.date <= body.to) {
      connection.workouts.delete(key);
      removed.push(key);
    }
  const workouts = body.workouts.map((workout) => {
    const hash = JSON.stringify([
      workout.date,
      workout.name,
      workout.description,
      workout.steps,
    ]);
    const simplifications = usesRpe(workout.steps) ? ["rpe_target"] : [];
    const previous = connection.workouts.get(workout.key);
    const held = simplifications.length > 0 && !workout.allow_simplified;
    if (
      previous?.hash === hash &&
      !workout.force &&
      (previous.status === "sent" ||
        (held && previous.status === "needs_confirmation"))
    )
      return { ...previous, changed: false };
    const row = {
      key: workout.key,
      date: workout.date,
      hash,
      simplifications,
      errorCode: null,
      sentAt: null,
      status: held ? "needs_confirmation" : "sent",
    };
    if (!held && connection.failWorkouts) {
      row.status = "failed";
      row.errorCode = "provider_unavailable";
    } else if (!held) row.sentAt = new Date().toISOString();
    connection.workouts.set(workout.key, row);
    return { ...row, changed: true };
  });
  return {
    workouts: workouts.map((row) => ({
      key: row.key,
      date: row.date,
      status: row.status,
      changed: row.changed,
      simplifications: row.simplifications,
      ...(row.errorCode && { error_code: row.errorCode }),
    })),
    removed,
  };
}

export function createGarminService() {
  const connections = new Map();
  const challenges = new Map();

  function connect(user) {
    const connection = {
      id: randomUUID(),
      connectedAt: new Date().toISOString(),
      syncReads: 0,
      workouts: new Map(),
      workoutRequests: [],
    };
    connections.set(user, connection);
    return { status: "connected" };
  }

  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    let raw = "";
    for await (const chunk of request) raw += chunk;
    if (url.pathname === "/healthz") return json(response, 200, "ok");
    if (url.pathname === "/readyz")
      return json(response, 200, { status: "ready" });
    if (url.pathname === "/__test__/reset" && request.method === "POST") {
      connections.clear();
      challenges.clear();
      return json(response, 200, { reset: true });
    }
    const user = subject(request.headers.authorization);
    if (!user) return failure(response, 401, "unauthorized");
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return failure(response, 400, "invalid_request");
    }
    const connection = connections.get(user);

    if (url.pathname === "/__test__/sync" && request.method === "POST") {
      if (
        !connection ||
        !Number.isInteger(body.readsUntilComplete) ||
        body.readsUntilComplete < 4 ||
        body.readsUntilComplete > 1000
      )
        return failure(response, 400, "invalid_request");
      connection.syncLimit = body.readsUntilComplete;
      return json(response, 200, { configured: true });
    }

    if (url.pathname === "/__test__/watch" && request.method === "POST") {
      if (!connection) return failure(response, 409, "disconnected");
      connection.failWorkouts = body.fail === true;
      return json(response, 200, { configured: true });
    }

    if (url.pathname === "/__test__/watch" && request.method === "GET")
      return json(response, 200, connection?.workoutRequests ?? []);

    if (url.pathname === "/v1/connections/garmin/workouts") {
      if (!connection) return failure(response, 409, "disconnected");
      connection.workoutRequests.push({ method: request.method, body });
      if (request.method === "PUT") {
        const result = reconcile(connection, body);
        await storeWorkouts(user, connection);
        return json(response, 200, result);
      }
      if (request.method === "DELETE") {
        const today = new Date().toISOString().slice(0, 10);
        let removed = 0;
        for (const [key, row] of connection.workouts)
          if (row.date >= today) {
            connection.workouts.delete(key);
            removed += 1;
          }
        await storeWorkouts(user, connection);
        return json(response, 200, { removed });
      }
    }

    if (url.pathname === "/__test__/connected" && request.method === "POST") {
      connect(user);
      connections.get(user).syncReads = 1000;
      connections.get(user).lastSyncAt = "2026-10-13T06:12:00Z";
      return json(response, 200, { connected: true });
    }

    if (
      url.pathname === "/v1/connections/garmin/sync" &&
      request.method === "POST"
    ) {
      if (!connection) return failure(response, 409, "disconnected");
      const now = Date.now();
      if (
        connection.manualAvailableAt &&
        Date.parse(connection.manualAvailableAt) > now
      )
        return failure(response, 429, "sync_throttled", {
          "Retry-After": String(
            Math.ceil((Date.parse(connection.manualAvailableAt) - now) / 1000),
          ),
        });
      connection.manual = {
        reads: 0,
        requestedAt: new Date(now).toISOString(),
      };
      connection.manualAvailableAt = new Date(
        now + manualSyncIntervalMs,
      ).toISOString();
      return json(response, 200, {
        ...syncFor(connection, false),
        request: "queued",
      });
    }

    if (url.pathname === "/v1/connections/garmin" && request.method === "GET")
      return json(
        response,
        200,
        connection
          ? {
              id: connection.id,
              status: "connected",
              connected_at: connection.connectedAt,
              last_authenticated_at: connection.connectedAt,
              last_sync_at: connection.lastSyncAt ?? null,
              last_error_code: null,
            }
          : { status: "disconnected" },
      );

    if (url.pathname === "/v1/connections/garmin/start") {
      const { email, password } = body;
      if (typeof email !== "string" || typeof password !== "string")
        return failure(response, 400, "invalid_request");
      if (email.startsWith("paused"))
        return failure(response, 429, "rate_limited", { "Retry-After": "120" });
      if (email.startsWith("limited"))
        return failure(response, 429, "rate_limited");
      if (email.startsWith("failed"))
        return failure(response, 409, "connection_changed");
      if (email.startsWith("slow"))
        await new Promise((resolve) => setTimeout(resolve, 3000));
      if (email.startsWith("unavailable"))
        return failure(response, 503, "provider_unavailable");
      if (password === "wrong-password")
        return failure(response, 401, "invalid_credentials");
      if (email.startsWith("mfa")) {
        const challengeId = randomUUID();
        challenges.set(challengeId, user);
        return json(response, 200, {
          status: "mfa_required",
          challenge_id: challengeId,
        });
      }
      return json(response, 200, connect(user));
    }

    if (url.pathname === "/v1/connections/garmin/mfa") {
      const { challenge_id: challengeId, otp } = body;
      if (challenges.get(challengeId) !== user)
        return failure(response, 410, "challenge_expired");
      challenges.delete(challengeId);
      if (otp === "000000") return failure(response, 401, "invalid_mfa");
      if (otp === "111111") return failure(response, 410, "challenge_expired");
      return json(response, 200, connect(user));
    }

    if (url.pathname === "/v1/connections/garmin/sync")
      return json(
        response,
        200,
        connection
          ? syncFor(connection)
          : {
              state: "not_started",
              categories: {
                activities: { state: "pending" },
                recovery: { state: "pending" },
                fitness: { state: "pending" },
                patterns: { state: "pending" },
              },
            },
      );

    const wellness = /^\/v1\/wellness\/days\/(\d{4}-\d{2}-\d{2})$/.exec(
      url.pathname,
    );
    if (wellness && request.method === "GET")
      return json(response, 200, wellnessDay(wellness[1]));

    return failure(response, 404, "invalid_request");
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  createGarminService().listen(
    Number(process.env.GARMIN_FIXTURE_PORT ?? 3300),
    "127.0.0.1",
  );
