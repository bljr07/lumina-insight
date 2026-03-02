/**
 * Federated Learning — Anonymous Weight Update & Idle Sync
 *
 * Generates anonymous weight updates and syncs them to a remote
 * endpoint only when the system is idle (UAC 3).
 * Zero PII: no domains, timestamps, or user identifiers.
 */

const MODEL_VERSION = '0.1.0';
const DEFAULT_SYNC_ENDPOINT = 'http://localhost:5000/api/federated/push';
const SYNC_INTERVAL_MS = 60_000;
const WEIGHT_VECTOR_LENGTH = 10;
let syncTimer = null;

// ─── Weight Update Generation ──────────────────────────────────────────────────

/**
 * Generate an anonymous weight update payload.
 * Contains ONLY model weights and a hashed session ID — no PII.
 *
 * @param {number[]} localWeights - Model weight deltas from local training
 * @returns {object} Anonymous weight update JSON
 */
export function generateWeightUpdate(localWeights) {
  return {
    model_version: MODEL_VERSION,
    weights: localWeights,
    session_hash: generateSessionHash(),
    sample_count: localWeights.length,
  };
}

// ─── Idle Detection ────────────────────────────────────────────────────────────

/**
 * Check if the system is idle (safe to sync weights).
 *
 * @param {number} detectionInterval - Seconds of inactivity to consider idle (default: 60)
 * @returns {Promise<boolean>}
 */
export async function shouldSync(detectionInterval = 60) {
  try {
    const state = await chrome.idle.queryState(detectionInterval);
    return state === 'idle';
  } catch (err) {
    console.error('[Lumina SW] Failed to query idle state:', err);
    return false;
  }
}

// ─── Weight Sync ───────────────────────────────────────────────────────────────

/**
 * Sync weight updates to the federated endpoint.
 *
 * @param {object} update - Weight update from generateWeightUpdate()
 * @param {string} endpoint - Remote API URL
 * @param {{ checkIdle?: boolean }} options - Options
 * @returns {Promise<{ synced: boolean, reason?: string, error?: string }>}
 */
export async function syncWeights(update, endpoint, options = {}) {
  // Guard: don't sync during active study sessions
  if (options.checkIdle) {
    const idle = await shouldSync();
    if (!idle) {
      return { synced: false, reason: 'not_idle' };
    }
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

    if (!response.ok) {
      return { synced: false, error: `HTTP error ${response.status}` };
    }

    return { synced: true };
  } catch (err) {
    console.error('[Lumina SW] Failed to sync weights:', err);
    return { synced: false, error: err.message };
  }
}

/**
 * Build a simple local update vector from current session state.
 *
 * @param {object} session
 * @returns {number[]}
 */
function buildLocalWeights(session = {}) {
  const base = new Array(WEIGHT_VECTOR_LENGTH).fill(0);
  const packetCount = Number(session.packetCount || 0);
  const packetSignal = Math.min(packetCount / 100, 1);

  // Deterministic weak signal based on local session only (no PII).
  return base.map((_, idx) => Number((packetSignal * (idx + 1) * 0.01).toFixed(4)));
}

export async function performFederatedSync(getSession, options = {}) {
  const endpoint = options.endpoint || DEFAULT_SYNC_ENDPOINT;

  try {
    const session = await getSession();
    const localWeights = buildLocalWeights(session);
    const update = generateWeightUpdate(localWeights);
    const result = await syncWeights(update, endpoint, { checkIdle: true });
    if (result.synced) {
      console.debug('[Lumina SW] Federated sync successful');
    } else {
      console.debug('[Lumina SW] Federated sync skipped/failed:', result.reason || result.error);
    }
  } catch (err) {
    console.warn('[Lumina SW] Federated sync failed:', err?.message || err);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a pseudorandom session hash for anonymization.
 * Not cryptographically secure — just a unique-enough identifier
 * to group weight updates from the same learning session.
 */
function generateSessionHash() {
  const array = new Uint8Array(16);
  // Use crypto.getRandomValues if available, else fallback
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}
