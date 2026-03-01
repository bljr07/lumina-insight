/**
 * Service Worker Main — Wires routing, storage, and offscreen management
 *
 * This is the main entry point for the MV3 Service Worker. It:
 * 1. Registers the message router
 * 2. Sets up onInstalled handler for fresh-install initialization
 * 3. Manages the offscreen document lifecycle for AI inference
 */
import { initRouter } from './router.js';
import { saveSession, loadSession, DEFAULT_SESSION } from './storage.js';
import { startFederatedSyncLoop } from './federated.js';
const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';

// ---- Inject Node.js require polyfill for onnxruntime-web fallback ----
if (typeof globalThis.require === 'undefined') {
  globalThis.require = function() { return {}; };
}

// ─── Initialization ────────────────────────────────────────────────────────────

/**
 * Initialize the Service Worker: register listeners and restore state.
 */
export function initServiceWorker() {
  // Register the message router
  initRouter();
  if (!isTestEnv) {
    startFederatedSyncLoop(loadSession);
  }

  // Handle extension lifecycle events
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      // First install — initialize default session
      await saveSession({ ...DEFAULT_SESSION });
      console.debug('[Lumina SW] Extension installed — session initialized');
    } else if (details.reason === 'update') {
      console.debug('[Lumina SW] Extension updated');
    }
  });

  console.debug('[Lumina SW] Service Worker initialized');
}

// ─── Auto-initialize (only in real Chrome, not during tests) ───────────────────
if (!isTestEnv && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  initServiceWorker();
}
