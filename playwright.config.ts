import { defineConfig, devices } from "@playwright/test";
import { loadTestEnvFile } from "./test/support/e2e-env";
import { assertSafeTestSupabaseEnv } from "./test/support/test-env-guard";

const testEnv = loadTestEnvFile();
// Fail fast, before spawning the dev server, if .env.test.local ever pointed
// anywhere but the isolated test project.
assertSafeTestSupabaseEnv(testEnv.NEXT_PUBLIC_SUPABASE_URL);
const PORT = 3177; // deliberately not 3000, so this never collides with a real dev server
// "localhost", not "127.0.0.1": Next's route handlers normalize redirect
// origins to "localhost" in dev, and a cookie set for one host is not sent
// to the other — a mismatch here silently drops the auth session mid-flow.
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 30_000,
  fullyParallel: false, // bounded PR smoke tier — determinism over speed
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx next dev -p " + PORT,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...testEnv,
      // Only enables /api/dev/session; gated separately by NODE_ENV=development
      // (which `next dev` sets itself) and by loopback host.
      // The seeded owner fixture (test/support/seed-fixtures.mjs): already
      // has an artist, space, track, and legal acceptance recorded, so
      // signing in lands straight on Today rather than the Origin gate.
      DEV_TEST_EMAIL: "owner.fixture@tempo.test",
    },
  },
});
