import { defineConfig, devices } from "@playwright/test";

const port =
  process.env.PLAYWRIGHT_PORT &&
  Number.isFinite(Number(process.env.PLAYWRIGHT_PORT))
    ? Number(process.env.PLAYWRIGHT_PORT)
    : 4173;
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `node scripts/e2e-dev.mjs --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
