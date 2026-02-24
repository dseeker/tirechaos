import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

function findHeadlessShell(): string | undefined {
  const cacheDir = path.join(process.env.HOME ?? '/root', '.cache/ms-playwright');
  if (!fs.existsSync(cacheDir)) return undefined;
  for (const dir of fs.readdirSync(cacheDir)) {
    if (!dir.startsWith('chromium_headless_shell')) continue;
    const bin = path.join(cacheDir, dir, 'chrome-linux/headless_shell');
    if (fs.existsSync(bin)) return bin;
  }
  return undefined;
}

export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'tests/e2e/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Babylon.js needs WebGL — enable it in headless Chromium.
        launchOptions: {
          // Use the locally cached headless shell when available (CI environments
          // may have a different revision than the package-declared one).
          executablePath: process.env.CHROMIUM_PATH ?? findHeadlessShell(),
          args: [
            '--enable-webgl',
            '--ignore-gpu-blocklist',
            '--disable-gpu-sandbox',
            '--no-sandbox',
          ],
        },
      },
    },
  ],

  webServer: {
    // In CI the project is pre-built; serve the dist/ folder with vite preview.
    // Locally, use the dev server for fast feedback.
    command: process.env.CI ? 'npx vite preview --port 3000' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
