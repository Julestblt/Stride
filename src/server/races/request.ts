import "server-only";

export const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}
