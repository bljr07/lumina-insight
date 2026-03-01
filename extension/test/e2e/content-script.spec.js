/**
 * Playwright E2E Tests — Content Script Injection
 *
 * Tests that the content script injects correctly on known learning platforms
 * and sends behavioral packets to the service worker.
 */
import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '..', '..', '..');

let browser;

test.beforeAll(async () => {
  browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
  });

  // Wait for service worker to register
  let bgPages = browser.serviceWorkers();
  if (bgPages.length === 0) {
    await browser.waitForEvent('serviceworker');
  }
});

test.afterAll(async () => {
  if (browser) await browser.close();
});

test.describe('Content Script', () => {
  test('should inject on a generic page without crashing', async () => {
    const page = await browser.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

    // The content script should have added lumina-node-* data attributes to <p> elements
    const taggedElements = await page.locator('[data-lumina-id]').count();

    // example.com has at least 1 paragraph
    expect(taggedElements).toBeGreaterThan(0);

    await page.close();
  });

  test('should emit a behavioral packet after mouse movement', async () => {
    const page = await browser.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

    // Simulate mouse movement to trigger the content script's sensors
    await page.mouse.move(100, 100);
    await page.mouse.move(200, 200);
    await page.mouse.move(300, 100);

    // Wait for the throttle interval (2000ms) + buffer
    await page.waitForTimeout(3000);

    // Verify the service worker received the packet by checking state
    const popupPage = await browser.newPage();
    await popupPage.goto(
      `chrome-extension://${browser.serviceWorkers()[0].url().split('/')[2]}/popup/popup.html`
    );

    const result = await popupPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
          resolve(response);
        });
      });
    });

    expect(result).toBeDefined();
    expect(result.lastState).toBeDefined();

    await popupPage.close();
    await page.close();
  });
});
