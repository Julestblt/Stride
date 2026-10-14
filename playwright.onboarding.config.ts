import { defineConfig, devices } from "@playwright/test";
if (process.env.CI !== "true")
  throw new Error("Onboarding persistence tests are CI-only.");
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "onboarding.spec.ts",
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3110", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "GARMIN_FIXTURE_PORT=3310 node tests/fixtures/garmin-service.mjs",
      url: "http://127.0.0.1:3310/healthz",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 3110",
      url: "http://127.0.0.1:3110",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PLAYWRIGHT_TEST: "1",
        ONBOARDING_ENABLED: "true",
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        SUPABASE_ONBOARDING_COMPLETION_KEY:
          process.env.SUPABASE_ONBOARDING_COMPLETION_KEY!,
        GARMIN_API_URL: "http://127.0.0.1:3310",
        SITE_URL: "http://127.0.0.1:3110",
      },
    },
  ],
});
