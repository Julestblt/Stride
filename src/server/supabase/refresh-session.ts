import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnvironment } from "@/lib/env";
import {
  authCookieOptions,
  cookieIsSecure,
  persistenceCookie,
} from "./cookie-policy";

export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  try {
    const environment = getPublicEnvironment();
    if (
      !environment.NEXT_PUBLIC_SUPABASE_URL ||
      !environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
      return response;
    const persistent =
      request.cookies.get(persistenceCookie)?.value === "persistent";
    const client = createServerClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(
                name,
                value,
                authCookieOptions(options, persistent, cookieIsSecure()),
              ),
            );
            response.headers.set("Cache-Control", "private, no-store");
            Object.entries(headers).forEach(([key, value]) =>
              response.headers.set(key, value),
            );
          },
        },
      },
    );
    await client.auth.getClaims();
  } catch {
    return response;
  }
  return response;
}
