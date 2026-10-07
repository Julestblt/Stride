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
  user_metadata: {},
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
  const send = (status, value) => {
    response.writeHead(status);
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
  return send(404, { msg: "Unknown fixture endpoint" });
}).listen(3200, "127.0.0.1");
