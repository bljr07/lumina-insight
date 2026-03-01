/**
 * Playwright E2E Tests — Extension Popup
 *
 * Tests the popup UI loads correctly and displays the current learning state.
 * Requires loading the extension as an unpacked Chrome extension.
 */
import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '..', '..', '..');

let browser;
let extensionId;

test.beforeAll(async () => {
  browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
  });

  // Wait for extension to load and get its ID
  let bgPages = browser.serviceWorkers();
  if (bgPages.length === 0) {
    bgPages = [await browser.waitForEvent('serviceworker')];
  }

  const swUrl = bgPages[0].url();
  extensionId = swUrl.split('/')[2];
});

test.afterAll(async () => {
  if (browser) await browser.close();
});

test.describe('Popup', () => {
  test('should load and display the brand name', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    // Brand name should be visible
    const brand = page.locator('.brand-name');
    await expect(brand).toBeVisible();
    await expect(brand).toHaveText('Lumina');

    await page.close();
  });

  test('should display a learning state pill', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    // State pill element should exist
    const statePill = page.locator('.state-pill');
    await expect(statePill).toBeVisible();

    await page.close();
  });

  test('should display the privacy footer', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    const footer = page.locator('.privacy-footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('on-device');

    await page.close();
  });
});

test.describe('Service Worker', () => {
  test('should respond to HEARTBEAT messages', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'HEARTBEAT' }, (response) => {
          resolve(response);
        });
      });
    });

    expect(result).toBeDefined();
    expect(result.alive).toBe(true);

    await page.close();
  });

  test('should respond to GET_STATE messages', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
          resolve(response);
        });
      });
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty('lastState');
    // GET_STATE should NOT leak raw page content (B4 fix)
    expect(result).not.toHaveProperty('lastPromptedContent');

    await page.close();
  });
});
