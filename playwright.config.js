import { defineConfig, devices } from '@playwright/test'

const PORT = 5199

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /screenshots\.spec/ },
    { name: 'screenshots', use: { ...devices['Desktop Chrome'] }, testMatch: /screenshots\.spec/ },
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
