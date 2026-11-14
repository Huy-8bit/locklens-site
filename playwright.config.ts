import { defineConfig, devices } from '@playwright/test';

// Runs against the production build: `npm run build` first.
export default defineConfig({
  testDir: 'tests',
  timeout: 45_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4329', trace: 'retain-on-failure' },
  webServer: { command: 'npx astro preview --port 4329 --host 127.0.0.1 --ignore-lock', url: 'http://127.0.0.1:4329/', reuseExistingServer: false, timeout: 60_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /responsive\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } }, testMatch: /responsive\.spec\.ts/ },
  ],
});
