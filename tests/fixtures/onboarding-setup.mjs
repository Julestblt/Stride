import { execFileSync, spawnSync } from "node:child_process";

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
if (
  !status.API_URL ||
  !["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(status.API_URL).hostname,
  )
)
  throw new Error("Onboarding tests require a local Supabase URL.");
if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY)
  throw new Error("Missing isolated test credentials.");
const result = spawnSync(
  "npx",
  ["playwright", "test", "--config", "playwright.onboarding.config.ts"],
  { stdio: "inherit", env: process.env },
);
process.exitCode = result.status ?? 1;
