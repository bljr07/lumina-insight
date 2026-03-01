import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    // Chrome extensions only work in Chromium
    browserName: 'chromium',
  },
  // E2E tests run separately from unit tests
  projects: [
    {
      name: 'chromium-extension',
      use: {
        channel: 'chromium',
      },
    },
  ],
});
