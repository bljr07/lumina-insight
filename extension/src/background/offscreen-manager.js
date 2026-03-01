/**
 * Offscreen Manager — Lifecycle management for the Offscreen Document
 *
 * The Offscreen Document hosts ONNX Runtime Web for on-device AI inference.
 * MV3 allows only one offscreen document at a time, so this manager
 * prevents duplicate creation and handles cleanup.
 */

const OFFSCREEN_URL = 'src/offscreen/offscreen.html';
const OFFSCREEN_REASONS = ['WORKERS'];
const OFFSCREEN_JUSTIFICATION = 'Run ONNX Runtime Web inference for learning state detection';

/**
 * Ensure the offscreen document exists. If it already exists, this is a no-op.
 *
 * @returns {Promise<void>}
 */
export async function ensureOffscreen() {
  try {
    const exists = await hasOffscreen();
    if (exists) return;

    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: OFFSCREEN_REASONS,
      justification: OFFSCREEN_JUSTIFICATION,
    });
  } catch (err) {
    console.error('[Lumina SW] Failed to create offscreen document:', err);
  }
}

/**
 * Close the offscreen document if it exists.
 *
 * @returns {Promise<void>}
 */
export async function closeOffscreen() {
  try {
    await chrome.offscreen.closeDocument();
  } catch (err) {
    console.error('[Lumina SW] Failed to close offscreen document:', err);
  }
}

/**
 * Check if an offscreen document currently exists.
 *
 * @returns {Promise<boolean>}
 */
export async function hasOffscreen() {
  try {
    return chrome.offscreen.hasDocument();
  } catch (err) {
    console.error('[Lumina SW] Failed to check offscreen document:', err);
    return false;
  }
}
