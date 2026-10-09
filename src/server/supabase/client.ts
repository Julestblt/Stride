import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { cookies } from "next/headers";
import { getPublicEnvironment } from "@/lib/env";
import {
  authCookieOptions,
  cookieIsSecure,
  persistenceCookie,
} from "./cookie-policy";

export async function createSupabaseServerClient({
  writable = false,
  persistent,
}: { writable?: boolean; persistent?: boolean } = {}) {
  const environment = getPublicEnvironment();
  const url = environment.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set the public Supabase environment variables.",
    );
  }

  const cookieStore = await cookies();
  const keep =
    persistent ?? cookieStore.get(persistenceCookie)?.value === "persistent";

  return createServerClient<Database>(url, publishableKey, {
    auth: { experimental: { appendPkceFlowIdToRedirects: true } },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (!writable) return;
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(
            name,
            value,
            authCookieOptions(options, keep, cookieIsSecure()),
          );
        });
      },
    },
  });
}
