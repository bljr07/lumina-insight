/**
 * Playwright Fixtures for Chrome Extension E2E Testing
 *
 * Launches Chromium with the extension loaded via --load-extension.
 * Extracts the extensionId from the MV3 Service Worker URL.
 */
import { test as base, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend({
  // Override context to launch with the extension pre-loaded
  context: async ({}, use) => {
    const pathToExtension = path.resolve(__dirname, '..', '..');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    await use(context);
    await context.close();
  },

  // Extract the extension ID from the MV3 Service Worker
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
