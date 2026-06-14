import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config para EvoSync Web (FASE 6 do ADR-001).
 *
 * Setup:
 *   1. `npm run db:migrate` — migrations aplicadas
 *   2. `npx tsx scripts/seed-e2e.ts` — popula 2 tenants com operator + license
 *   3. `npm run dev` — servidor em :3000
 *   4. `npm run test:e2e` — roda Playwright
 *
 * Credenciais de teste:
 *   - Tenant 1: operator@e2e.test / e2e1234
 *   - Tenant 2: operator2@e2e.test / e2e1234
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // serial — shared SQLite DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "list" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
