import { createClient } from "@supabase/supabase-js";

export function onboardingTestClients() {
  if (process.env.CI !== "true")
    throw new Error("Onboarding persistence tests run only in isolated CI.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (
    !url ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
  )
    throw new Error("Onboarding tests require a local Supabase URL.");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serverKey = process.env.SUPABASE_ONBOARDING_COMPLETION_KEY;
  if (!key || !serverKey) throw new Error("Missing isolated test credentials.");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    admin: createClient(url, serverKey, options),
    athlete: () => createClient(url, key, options),
  };
}
