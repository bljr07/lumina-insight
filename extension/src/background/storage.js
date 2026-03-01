/**
 * Storage Manager — Session Persistence via chrome.storage.local
 *
 * Handles saving and loading the learning session state so the
 * Service Worker can restore state after being spun down.
 */

/** Default session shape when nothing has been stored */
export const DEFAULT_SESSION = Object.freeze({
  lastState: null,
  lastNudge: null,
  lastPromptedState: null,
  lastPromptedContent: null,
  packetCount: 0,
});

const STORAGE_KEY = 'session';

/**
 * Save session data to chrome.storage.local.
 *
 * @param {object} data - Session data to persist
 * @returns {Promise<void>}
 */
export async function saveSession(data) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  } catch (err) {
    console.error('[Lumina SW] Failed to save session:', err);
  }
}

/**
 * Load session data from chrome.storage.local.
 * Returns DEFAULT_SESSION if nothing is stored.
 *
 * @returns {Promise<object>} Session data
 */
export async function loadSession() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || { ...DEFAULT_SESSION };
  } catch (err) {
    console.error('[Lumina SW] Failed to load session:', err);
    return { ...DEFAULT_SESSION };
  }
}
