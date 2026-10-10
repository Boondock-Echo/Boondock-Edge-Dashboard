// @ts-check

const { defineConfig, devices } = require('@playwright/test');
const dotenv = require('dotenv');

dotenv.config();

process.env.E2E_API_URL ??= process.env.REACT_APP_EDGE_SERVER_ENDPOINT;

module.exports = defineConfig({
  testDir: './e2e',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3000',

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',

    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
  ],

  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});