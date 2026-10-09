import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  testIgnore: "onboarding.spec.ts",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--host-resolver-rules=MAP stride.test 127.0.0.1"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node tests/fixtures/auth-provider.mjs",
      url: "http://127.0.0.1:3200",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PLAYWRIGHT_TEST: "1",
        ONBOARDING_ENABLED: "false",
        ALLOWED_DEV_ORIGINS: "stride.test",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3200",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "isolated-test-publishable-key",
        SITE_URL: "http://127.0.0.1:3100",
      },
    },
  ],
});
