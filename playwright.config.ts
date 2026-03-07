import { defineConfig, devices } from '@playwright/test';

const useArchitectReviewMode =
  process.env.PLAYWRIGHT_ARCHITECT_REVIEW_MODE === 'true';
const playwrightBaseUrl = 'http://127.0.0.1:5173';

/**
 * Playwright E2E Test Configuration for ScoutZero
 *
 * Run with: npx playwright test
 * Run specific file: npx playwright test e2e/architect-qa.spec.ts
 * Run with UI: npx playwright test --ui
 * Debug mode: npx playwright test --debug
 */
export default defineConfig({
  testDir: './e2e',
  /* Test timeout - architect workflows can be slow */
  timeout: 60_000,
  /* Expect timeout for assertions */
  expect: {
    timeout: 10_000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Single worker for sequential tests (Firestore state) */
  workers: 1,
  /* Reporter - HTML for detailed results, line for CI */
  reporter: process.env.CI ? 'line' : [['html', { open: 'never' }]],
  /* Output directory for screenshots and traces */
  outputDir: 'e2e/test-results',

  /* Shared settings for all the projects below. */
  use: {
    /* Base URL - Vite dev server */
    baseURL: playwrightBaseUrl,
    /* Collect trace on failure */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Video on failure (useful for debugging) */
    video: 'on-first-retry',
  },

  /* Only test on Chromium for speed; add others if needed */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Auto-start dev server before tests */
  webServer: {
    command: useArchitectReviewMode
      ? 'npm run architect:review:up'
      : 'npm run dev',
    url: playwrightBaseUrl,
    reuseExistingServer: useArchitectReviewMode ? false : !process.env.CI,
    gracefulShutdown: useArchitectReviewMode
      ? {
          signal: 'SIGTERM',
          timeout: 10_000,
        }
      : undefined,
    timeout: useArchitectReviewMode ? 240_000 : 120_000,
  },
});
