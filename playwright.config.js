import { defineConfig, devices } from '@playwright/test'

const PORT = 5199
// PAGES_URL points the `pages` project at a deployed (or emulated) GitHub Pages site,
// e.g. https://youssefelkondakly.github.io/lecture-studio/ — no local dev server is started then.
const PAGES_URL = process.env.PAGES_URL

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /(screenshots|pages)\.spec/ },
    { name: 'screenshots', use: { ...devices['Desktop Chrome'] }, testMatch: /screenshots\.spec/ },
    { name: 'pages', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: PAGES_URL }, testMatch: /pages\.spec/ },
  ],
  webServer: PAGES_URL ? undefined : {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
