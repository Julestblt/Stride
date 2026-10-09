import { createClient } from "@supabase/supabase-js";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.CI !== "true")
    throw new Error(
      "This suite is CI-only; do not start local Supabase on the homelab.",
    );
  const status = JSON.parse(
    execFileSync("npx", ["supabase", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }),
  );
  process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = status.ANON_KEY;
  process.env.SUPABASE_ONBOARDING_COMPLETION_KEY = status.SERVICE_ROLE_KEY;
  onboardingTestClients();
  const result = spawnSync(
    "npx",
    ["playwright", "test", "--config", "playwright.onboarding.config.ts"],
    { stdio: "inherit", env: process.env },
  );
  process.exitCode = result.status ?? 1;
}
