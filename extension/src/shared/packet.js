/**
 * Packet — Behavioral Data Schema & Validation
 *
 * Defines the structured JSON "packet" that Content Scripts emit to the
 * Service Worker. Includes factory, validation, and sanitization functions.
 *
 * Privacy-first: sanitizePacket() strips any fields that could contain PII.
 */
import { LearningState } from './constants.js';

// ─── Allowed Fields (Allowlist for PII protection) ─────────────────────────────

const ALLOWED_PACKET_FIELDS = ['context', 'metrics', 'inferred_state', 'timestamp'];
const ALLOWED_CONTEXT_FIELDS = ['domain', 'type'];
const ALLOWED_METRICS_FIELDS = ['dwell_time_ms', 'scroll_velocity', 'mouse_jitter', 'tab_switches', 're_read_cycles'];

// ─── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates a validated behavioral packet.
 *
 * @param {{ domain: string, type: string }} context - Platform context
 * @param {{ dwell_time_ms: number, scroll_velocity: number, mouse_jitter: number, tab_switches: number, re_read_cycles: number }} metrics
 * @param {string} [transient_content] - Ephemeral context extracted from DOM
 * @returns {object} A well-formed behavioral packet
 * @throws {Error} If context or metrics are invalid
 */
export function createPacket(context, metrics, transient_content = null) {
  if (!context || typeof context !== 'object') {
    console.error('[Lumina] createPacket failed: context is required and must be an object', context);
    throw new Error('context is required and must be an object');
  }
  if (!context.domain) {
    console.error('[Lumina] createPacket failed: context.domain is required', context);
    throw new Error('context.domain is required');
  }
  if (!context.type) {
    console.error('[Lumina] createPacket failed: context.type is required', context);
    throw new Error('context.type is required');
  }
  if (!metrics || typeof metrics !== 'object') {
    console.error('[Lumina] createPacket failed: metrics is required and must be an object', metrics);
    throw new Error('metrics is required and must be an object');
  }

  if (!validateMetrics(metrics)) {
    console.error('[Lumina] createPacket failed: metrics validation failed', metrics);
    throw new Error('metrics failed validation');
  }

  const packet = {
    context: {
      domain: context.domain,
      type: context.type,
    },
    metrics: {
      dwell_time_ms: metrics.dwell_time_ms,
      scroll_velocity: metrics.scroll_velocity,
      mouse_jitter: metrics.mouse_jitter,
      tab_switches: metrics.tab_switches,
      re_read_cycles: metrics.re_read_cycles,
    },
    inferred_state: LearningState.PENDING_LOCAL_AI,
    timestamp: Date.now(),
  };

  if (transient_content) {
    packet.transient_content = transient_content;
  }

  return packet;
}

// ─── Validation ────────────────────────────────────────────────────────────────

/**
 * Validates a metrics object against the behavioral schema constraints.
 *
 * @param {object} metrics
 * @returns {boolean} true if all metric values are within valid ranges
 */
export function validateMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return false;
  }

  // All required fields must be present
  for (const field of ALLOWED_METRICS_FIELDS) {
    if (typeof metrics[field] !== 'number') {
      return false;
    }
  }

  // dwell_time_ms: non-negative
  if (metrics.dwell_time_ms < 0) {
    return false;
  }

  // mouse_jitter: normalized 0–1
  if (metrics.mouse_jitter < 0 || metrics.mouse_jitter > 1.0) {
    return false;
  }

  // tab_switches: non-negative integer
  if (metrics.tab_switches < 0 || !Number.isInteger(metrics.tab_switches)) {
    return false;
  }

  // re_read_cycles: non-negative integer
  if (metrics.re_read_cycles < 0 || !Number.isInteger(metrics.re_read_cycles)) {
    return false;
  }

  return true;
}

// ─── Sanitization (Privacy) ────────────────────────────────────────────────────

/**
 * Strips any fields not in the allowlist from a packet.
 * Returns a NEW object — does not mutate the input.
 *
 * @param {object} packet - Raw packet that may contain extra fields
 * @returns {object} A sanitized packet containing only allowed fields
 */
export function sanitizePacket(packet) {
  const sanitized = {};

  // Only copy allowed top-level fields
  for (const field of ALLOWED_PACKET_FIELDS) {
    if (field in packet) {
      sanitized[field] = packet[field];
    }
  }

  // Deep-sanitize context
  if (sanitized.context && typeof sanitized.context === 'object') {
    const cleanContext = {};
    for (const field of ALLOWED_CONTEXT_FIELDS) {
      if (field in sanitized.context) {
        cleanContext[field] = sanitized.context[field];
      }
    }
    sanitized.context = cleanContext;
  }

  // Deep-sanitize metrics
  if (sanitized.metrics && typeof sanitized.metrics === 'object') {
    const cleanMetrics = {};
    for (const field of ALLOWED_METRICS_FIELDS) {
      if (field in sanitized.metrics) {
        cleanMetrics[field] = sanitized.metrics[field];
      }
    }
    sanitized.metrics = cleanMetrics;
  }

  return sanitized;
}
