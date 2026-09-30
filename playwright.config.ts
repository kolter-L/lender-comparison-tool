import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end acceptance tests — see TEST_PLAN.md (E1–E17).
 *
 * The app is served by Vite's preview server over http://localhost, which satisfies N4:
 * `fetch` needs a server, and the clipboard needs a secure context (localhost counts).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : [['list']],

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // F21/N4: the clipboard test reads back what it wrote, which needs both permissions.
    permissions: ['clipboard-read', 'clipboard-write'],
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // `preview` serves the production build, so these tests exercise the same static
  // file serving ops deploys to — not a dev-only middleware path.
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
