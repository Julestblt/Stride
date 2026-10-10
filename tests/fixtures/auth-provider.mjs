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
  route_name: null,
  distance_meters: null,
  duration_seconds: null,
  elevation_gain_meters: null,
  average_heart_rate: null,
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
      distance_meters: 11300,
      duration_seconds: 3520,
      elevation_gain_meters: 64,
      average_heart_rate: 152,
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
  const id = params.get("id");
  if (id) rows = rows.filter((row) => `eq.${row.id}` === id);
  const types = params.get("activity_type")?.match(/^in\.\((.*)\)$/);
  if (types) {
    const allowed = types[1].split(",").map((type) => type.replace(/"/g, ""));
    rows = rows.filter((row) => allowed.includes(row.activity_type));
  }
  if (table === "provider_activities")
    rows = [...rows].sort((a, b) => b.started_at.localeCompare(a.started_at));
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
