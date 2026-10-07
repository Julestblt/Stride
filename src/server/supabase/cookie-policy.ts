import "server-only";
import type { CookieOptions } from "@supabase/ssr";

export const persistenceCookie = "stride-auth-persistence";

export function authCookieOptions(
  options: CookieOptions,
  persistent: boolean,
  secure: boolean,
): CookieOptions {
  const result = {
    ...options,
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
  if (!persistent && options.maxAge !== 0) {
    delete result.maxAge;
    delete result.expires;
  }
  return result;
}

export function cookieIsSecure() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.SITE_URL?.startsWith("https:") === true
  );
}
