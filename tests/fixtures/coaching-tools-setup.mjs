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
const local = (value) =>
  Boolean(value) &&
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname);
if (!local(status.API_URL) || !local(status.DB_URL))
  throw new Error("Coaching tool tests require a local Supabase.");
if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY)
  throw new Error("Missing isolated test credentials.");
const result = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "--config",
    "vitest.integration.config.ts",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
      SUPABASE_ONBOARDING_COMPLETION_KEY: status.SERVICE_ROLE_KEY,
      COACHING_TEST_DATABASE_URL: status.DB_URL,
    },
  },
);
process.exitCode = result.status ?? 1;
