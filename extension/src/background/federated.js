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
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });

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

/**
 * Start periodic federated sync.
 *
 * @param {() => Promise<object>} getSession
 * @param {{ endpoint?: string, intervalMs?: number }} options
 * @returns {NodeJS.Timeout | number}
 */
export function startFederatedSyncLoop(getSession, options = {}) {
  const endpoint = options.endpoint || DEFAULT_SYNC_ENDPOINT;
  const intervalMs = options.intervalMs || SYNC_INTERVAL_MS;

  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }

  const tick = async () => {
    try {
      const session = await getSession();
      const localWeights = buildLocalWeights(session);
      const update = generateWeightUpdate(localWeights);
      await syncWeights(update, endpoint, { checkIdle: true });
    } catch (err) {
      console.warn('[Lumina SW] Federated sync tick failed:', err?.message || err);
    }
  };

  // Prime once on startup.
  tick();
  syncTimer = setInterval(tick, intervalMs);
  if (syncTimer && typeof syncTimer.unref === 'function') {
    syncTimer.unref();
  }
  return syncTimer;
}

export function stopFederatedSyncLoop() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
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
