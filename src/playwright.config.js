// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const API_URL = process.env.E2E_API_URL;
if (!API_URL) {
  throw new Error(
    'E2E_API_URL is required, for example: http://192.168.1.50:5000/api'
  );
}

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_DASHBOARD_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_DASHBOARD_URL
    ? undefined
    : {
        command: 'npm start',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          BROWSER: 'none',
          REACT_APP_EDGE_SERVER_ENDPOINT: API_URL,
        },
      },
});
