import { createServer } from "node:http";
import { createHmac, createHash, randomUUID } from "node:crypto";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "athlete@example.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Jules Thibault" },
};
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
function accessToken(expires) {
  const payload = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: user.aud, role: user.role, email: user.email, exp: expires })}`;
  return `${payload}.${createHmac("sha256", "isolated-test-secret").update(payload).digest("base64url")}`;
}
const token = accessToken(Math.floor(Date.now() / 1000) + 3600);
const session = {
  access_token: token,
  refresh_token: "isolated-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const day = 86_400_000;
const daysAgo = (days, time = "07:12:00") => {
  const date = new Date(Date.now() - days * day).toISOString().slice(0, 10);
  return {
    started_at: `${date}T${time}Z`,
    local_started_at: `${date} ${time}`,
  };
};
const activity = (id, days, values) => ({
  id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(id).padStart(12, "0")}`,
  activity_type: "running",
  activity_name: null,
  route_name: null,
  distance_meters: null,
  duration_seconds: null,
  elevation_gain_meters: null,
  elevation_loss_meters: null,
  average_heart_rate: null,
  max_heart_rate: null,
  average_cadence: null,
  average_power_watts: null,
  max_power_watts: null,
  aerobic_training_effect: null,
  anaerobic_training_effect: null,
  detail_imported_at: null,
  calories: null,
  workout_rpe: null,
  workout_feel: null,
  ...daysAgo(days),
  ...values,
});
const tables = {
  provider_activities: [
    activity(1, 1, {
      distance_meters: 8320,
      duration_seconds: 3014,
      average_heart_rate: 138,
    }),
    activity(2, 3, {
      activity_type: "trail_running",
      route_name: "Fontainebleau",
      distance_meters: 21400,
      duration_seconds: 7500,
      elevation_gain_meters: 540,
      average_heart_rate: 146,
    }),
    activity(3, 4, {
      activity_type: "strength_training",
      duration_seconds: 3300,
    }),
    activity(4, 6, {
      activity_name: "Threshold 3 × 10 min",
      calories: 720,
      workout_rpe: 8,
      workout_feel: 75,
      distance_meters: 11300,
      duration_seconds: 3520,
      elevation_gain_meters: 64,
      elevation_loss_meters: 58,
      average_heart_rate: 152,
      max_heart_rate: 176,
      average_cadence: 168,
      aerobic_training_effect: 3.4,
      anaerobic_training_effect: 1.8,
      detail_imported_at: "2026-10-07T04:12:00Z",
    }),
    activity(5, 38, {
      activity_type: "trail_running",
      route_name: "Trail 80K",
      distance_meters: 80200,
      duration_seconds: 40500,
      elevation_gain_meters: 1620,
    }),
    ...Array.from({ length: 70 }, (_, index) =>
      activity(100 + index, 40 + index, {
        distance_meters: 8000 + index * 10,
        duration_seconds: 3000 + index,
      }),
    ),
  ],
  provider_activity_segments: [
    [900, 2570, 5.5, 134, 168, 6],
    [600, 2270, 4.4, 161, 182, 4],
    [120, 320, 6.2, 141, 164, 0],
    [600, 2230, 4.49, 167, 181, 3],
    [120, 320, 6.18, 146, 163, 0],
    [440, 1600, 4.36, 171, 180, 2],
    [740, 1990, 6.12, 136, 158, 1],
  ].map(([duration, distance, , heartRate, cadence, gain], index) => ({
    activity_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000004",
    user_id: user.id,
    segment_type: "lap",
    segment_index: index,
    started_at: null,
    distance_meters: distance,
    duration_seconds: duration,
    average_heart_rate: heartRate,
    average_cadence: cadence,
    average_power_watts: null,
    elevation_gain_meters: gain,
    elevation_loss_meters: null,
  })),
  provider_activity_tracks: [
    {
      activity_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000004",
      user_id: user.id,
      status: "available",
      route: Array.from({ length: 100 }, (_, index) => {
        const angle = (index / 99) * Math.PI * 2;
        return [
          48.827 + Math.sin(angle) * 0.008,
          2.418 + Math.cos(angle) * 0.014,
        ];
      }),
      bounds: {
        min_lat: 48.819,
        max_lat: 48.835,
        min_lon: 2.404,
        max_lon: 2.432,
      },
      series: {
        elapsed_s: Array.from(
          { length: 100 },
          (_, index) => (index * 3520) / 99,
        ),
        distance_m: Array.from(
          { length: 100 },
          (_, index) => (index * 11300) / 99,
        ),
        heart_rate: Array.from(
          { length: 100 },
          (_, index) => 125 + Math.round(51 * Math.abs(Math.sin(index / 11))),
        ),
        speed_mps: Array.from(
          { length: 100 },
          (_, index) => 3 + Math.sin(index / 8) * 0.7,
        ),
        elevation_m: Array.from(
          { length: 100 },
          (_, index) => 42 + Math.sin(index / 12) * 12,
        ),
        cadence: Array.from(
          { length: 100 },
          (_, index) => 168 + Math.round(Math.sin(index / 8) * 12),
        ),
      },
      heart_rate_histogram: {
        110: 180,
        130: 700,
        145: 1000,
        160: 1180,
        176: 460,
      },
      source_point_count: 3520,
    },
    {
      activity_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003",
      user_id: user.id,
      status: "available",
      route: null,
      bounds: null,
      series: {
        elapsed_s: [0, 600, 1200, 1800, 2400, 3300],
        heart_rate: [100, 120, 140, 130, 125, 105],
        speed_mps: [1, 2, 3, 2, 1, 1],
      },
      heart_rate_histogram: { 100: 600, 120: 900, 140: 1800 },
      source_point_count: 3300,
    },
  ],
  provider_observations: Array.from({ length: 10 }, (_, index) => ({
    user_id: user.id,
    metric: "resting_heart_rate_bpm",
    observed_on: new Date(Date.now() - index * day).toISOString().slice(0, 10),
    value_numeric: 50,
    availability: "available",
  })),
  athlete_profiles: [{ first_name: "Jules" }],
  athlete_goals: [
    {
      user_id: user.id,
      focus: "ultra_trail",
      revision: 1,
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  athlete_races: [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      user_id: user.id,
      name: "EcoTrail Paris 120K",
      race_date: new Date(Date.now() + 164 * day).toISOString().slice(0, 10),
      distance_km: 120,
      elevation_gain_m: 1800,
      priority: "A",
      target_duration_seconds: null,
      revision: 1,
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
};
function selectRows(table, params) {
  let rows = tables[table] ?? [];
  const ownerId = params.get("user_id");
  if (ownerId)
    rows = rows.filter(
      (row) => !row.user_id || `eq.${row.user_id}` === ownerId,
    );
  for (const [key, filter] of params) {
    if (filter.startsWith("gte."))
      rows = rows.filter((row) => row[key] >= filter.slice(4));
    if (filter === "not.is.null")
      rows = rows.filter((row) => row[key] !== null && row[key] !== undefined);
    if (["metric", "availability"].includes(key) && filter.startsWith("eq."))
      rows = rows.filter((row) => row[key] === filter.slice(3));
  }
  const id = params.get("id");
  if (id) rows = rows.filter((row) => `eq.${row.id}` === id);
  const owner = params.get("activity_id");
  if (owner) rows = rows.filter((row) => `eq.${row.activity_id}` === owner);
  const types = params.get("activity_type")?.match(/^in\.\((.*)\)$/);
  if (types) {
    const allowed = types[1].split(",").map((type) => type.replace(/"/g, ""));
    rows = rows.filter((row) => allowed.includes(row.activity_type));
  }
  if (table === "provider_activities")
    rows = [...rows].sort((a, b) =>
      params.get("order")?.startsWith("max_heart_rate")
        ? (b.max_heart_rate ?? 0) - (a.max_heart_rate ?? 0)
        : b.started_at.localeCompare(a.started_at),
    );
  if (table === "provider_activity_segments")
    rows = [...rows].sort((a, b) => a.segment_index - b.segment_index);
  const total = rows.length;
  const limit = Number(params.get("limit"));
  if (limit > 0) rows = rows.slice(0, limit);
  return { rows, total };
}
const events = [];
const links = new Map();
const challenges = new Map();
const requests = new Map();
createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:3200");
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  response.setHeader("Content-Type", "application/json");
  const send = (status, value, headers = {}) => {
    response.writeHead(status, headers);
    response.end(JSON.stringify(value));
  };
  if (url.pathname === "/__test__/events") return send(200, events);
  if (url.pathname === "/__test__/link")
    return send(200, { url: links.get(url.searchParams.get("email")) });
  if (url.pathname === "/__test__/expired-session")
    return send(200, {
      ...session,
      access_token: accessToken(Math.floor(Date.now() / 1000) - 60),
      expires_at: Math.floor(Date.now() / 1000) - 60,
    });
  if (url.pathname === "/") return send(200, { ready: true });
  events.push({
    method: request.method,
    path: url.pathname,
    scope: url.searchParams.get("scope"),
    email: body.email,
    grant: url.searchParams.get("grant_type"),
  });
  if (url.pathname === "/auth/v1/token") {
    const grant = url.searchParams.get("grant_type");
    if (
      grant === "password" &&
      body.email === "confirmation@example.com" &&
      body.password === "TrailMiles2026!"
    )
      return send(400, {
        error_code: "email_not_confirmed",
        msg: "Email not confirmed",
      });
    const challenge = challenges.get(body.auth_code);
    const valid =
      grant === "password"
        ? body.email === user.email && body.password === "TrailMiles2026!"
        : grant === "refresh_token"
          ? body.refresh_token === session.refresh_token
          : challenge &&
            typeof body.code_verifier === "string" &&
            createHash("sha256")
              .update(body.code_verifier)
              .digest("base64url") === challenge;
    if (valid && grant === "pkce") challenges.delete(body.auth_code);
    return valid
      ? send(200, session)
      : send(400, { code: "invalid_credentials", msg: "Invalid credentials" });
  }
  if (url.pathname === "/auth/v1/signup")
    return send(
      200,
      body.email === "confirmation@example.com"
        ? { user: { ...user, email: body.email }, session: null }
        : session,
    );
  if (url.pathname === "/auth/v1/resend") return send(200, {});
  if (["/auth/v1/otp", "/auth/v1/recover"].includes(url.pathname)) {
    if (body.email === "unavailable@example.com")
      return send(503, { code: "unexpected_failure", msg: "Unavailable" });
    const count = (requests.get(body.email) ?? 0) + 1;
    requests.set(body.email, count);
    if (body.email === "resend-failure@example.com" && count > 1)
      return send(429, {
        code: "over_email_send_rate_limit",
        msg: "Rate limited",
      });
    const code = randomUUID();
    challenges.set(code, body.code_challenge);
    const link = new URL(
      url.searchParams.get("redirect_to") ?? body.redirect_to,
    );
    link.searchParams.set("code", code);
    links.set(body.email, link.toString());
    return send(200, {});
  }
  if (url.pathname === "/auth/v1/verify")
    return body.token_hash === "valid-token"
      ? send(200, session)
      : send(403, { code: "otp_expired", msg: "Expired" });
  if (url.pathname === "/auth/v1/user")
    return request.headers.authorization === `Bearer ${token}`
      ? send(200, user)
      : send(401, { msg: "Unauthorized" });
  if (url.pathname === "/auth/v1/logout") return send(204, undefined);
  if (url.pathname.startsWith("/rest/v1/")) {
    if (request.headers.authorization !== `Bearer ${token}`)
      return send(401, { message: "JWT required" });
    const { rows, total } = selectRows(url.pathname.slice(9), url.searchParams);
    return send(200, rows, {
      "Content-Range": rows.length
        ? `0-${rows.length - 1}/${total}`
        : `*/${total}`,
    });
  }
  return send(404, { msg: "Unknown fixture endpoint" });
}).listen(3200, "127.0.0.1");
