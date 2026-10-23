import { defineConfig, devices } from "@playwright/test";
import lanes from "./tests/e2e/lanes.json";

const appPort = Number(process.env.PLAYWRIGHT_APP_PORT ?? 3100);
const authPort = Number(process.env.PLAYWRIGHT_AUTH_PORT ?? 3200);
const garminPort = Number(process.env.PLAYWRIGHT_GARMIN_PORT ?? 3300);
const production = process.env.PLAYWRIGHT_PRODUCTION === "true";
const specFiles = (names: string[]) => names.map((name) => `${name}.spec.ts`);
const developmentSpecs = specFiles(lanes.development);
const courseSpecs = specFiles(lanes.course);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  retries: process.env.CI ? 1 : 0,
  testIgnore: "onboarding.spec.ts",
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--host-resolver-rules=MAP stride.test 127.0.0.1"],
    },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: ["onboarding.spec.ts", ...courseSpecs, ...developmentSpecs],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-development",
      testMatch: developmentSpecs,
      workers: 2,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-race-course",
      testMatch: courseSpecs,
      dependencies: ["chromium"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `PLAYWRIGHT_AUTH_PORT=${authPort} node tests/fixtures/auth-provider.mjs`,
      url: `http://127.0.0.1:${authPort}`,
      reuseExistingServer: false,
    },
    {
      command: `GARMIN_FIXTURE_PORT=${garminPort} PLAYWRIGHT_AUTH_PORT=${authPort} node tests/fixtures/garmin-service.mjs`,
      url: `http://127.0.0.1:${garminPort}/healthz`,
      reuseExistingServer: false,
    },
    {
      command: production
        ? `npm run build && npm run start -- --port ${appPort}`
        : `npm run dev -- --port ${appPort}`,
      url: `http://127.0.0.1:${appPort}`,
      reuseExistingServer: process.env.PLAYWRIGHT_REUSE_APP === "true",
      timeout: production ? 300_000 : 120_000,
      env: {
        PLAYWRIGHT_TEST: "1",
        ONBOARDING_ENABLED: "false",
        ALLOWED_DEV_ORIGINS: "stride.test",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${authPort}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "isolated-test-publishable-key",
        SITE_URL: `http://127.0.0.1:${appPort}`,
        GARMIN_API_URL: `http://127.0.0.1:${garminPort}`,
      },
    },
  ],
});
