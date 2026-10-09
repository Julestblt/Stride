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

function syncFor(connection) {
  const reads = ++connection.syncReads;
  const done = reads >= 4;
  const oldest = `${2026 - reads}-01-01`;
  return {
    connection_id: connection.id,
    categories: {
      activities: category(done ? "complete" : "running", {
        oldest_synchronized_date: oldest,
        activity_count: Math.min(reads, 4) * 25,
      }),
      recovery: category(reads >= 2 ? "complete" : "running", {
        oldest_synchronized_date: "2026-07-01",
      }),
      fitness: category(reads >= 3 ? "complete" : "partial", {
        oldest_synchronized_date: "2025-10-01",
      }),
      patterns: { state: done ? "complete" : "partial" },
    },
    last_sync_at: connection.connectedAt,
    incremental: null,
    updated_at: new Date().toISOString(),
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
              last_sync_at: null,
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

    return failure(response, 404, "invalid_request");
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  createGarminService().listen(
    Number(process.env.GARMIN_FIXTURE_PORT ?? 3300),
    "127.0.0.1",
  );
