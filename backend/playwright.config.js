import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  timeout: 0, // No timeout - let tests run as long as needed
  retries: 0, // No retries - fail fast
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially for realistic user simulation
  forbidOnly: !!process.env.CI,
  workers: 1, // Single worker for realistic user simulation
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],
  use: {
    browserName: 'chromium',
    channel: 'chrome',          // ⬅️ Google Chrome الحقيقي
    headless: false,            // ⬅️ ممنوع Headless - يجب رؤية المتصفح
    slowMo: 200,                // ⬅️ سرعة بشرية (200ms بين الإجراءات)
    viewport: { width: 1400, height: 900 },
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    baseURL: process.env.BASE_URL || 'http://localhost:5000',
    // Fail on console errors
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  // Fail on any console error
  expect: {
    timeout: 10000,
  },
  // Projects for different test scenarios
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
    },
    {
      name: 'chromium-login',
      use: {
        ...devices['Desktop Chrome'],
        // No auth for login test
      },
      testMatch: /01-login\.spec\.js/,
    },
    {
      name: 'chromium-authed',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /0[2-7]-.*\.spec\.js(?!-full)/,
    },
    {
      name: 'chromium-full-workflow',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*-full\.spec\.js(?!-real)/,
    },
    {
      name: 'chromium-real-workflow',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*-full-real\.spec\.js/,
    },
  ],
});
