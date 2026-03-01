/**
 * State Classifier — Rule-based learning state classification
 *
 * Maps behavioral metrics to learning state enums. This serves as both
 * a standalone classifier and a complement to the ONNX model.
 * The ONNX model can override these classifications when available.
 */
import { LearningState, PlatformType, SensorConfig } from '@shared/constants.js';

// ─── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  DWELL_HIGH: SensorConfig.DWELL_STALL_THRESHOLD_MS,       // 15000ms
  DWELL_DEEP_READ: 20000,
  JITTER_HIGH: 0.5,
  JITTER_LOW: 0.1,
  TAB_SWITCH_HIGH: 3,
};

// ─── Classification ────────────────────────────────────────────────────────────

/**
 * Classify the learning state from behavioral metrics using rule-based logic.
 *
 * Priority order:
 * 1. STRUGGLING — high dwell + high jitter (frustration signal)
 * 2. STALLED — high tab switches OR (high dwell + moderate jitter)
 * 3. DEEP_READING — high dwell + low jitter + no tab switches
 * 4. FOCUSED — default (student is engaged normally)
 *
 * @param {{ dwell_time_ms: number, scroll_velocity: number, mouse_jitter: number, tab_switches: number }} metrics
 * @returns {string} One of LearningState values
 */
export function classifyState(metrics) {
  const { dwell_time_ms, mouse_jitter, tab_switches } = metrics;

  // High tab switches → distracted / stalled
  if (tab_switches >= THRESHOLDS.TAB_SWITCH_HIGH) {
    return LearningState.STALLED;
  }

  // High dwell + high jitter → struggling (frustration)
  if (dwell_time_ms >= THRESHOLDS.DWELL_HIGH && mouse_jitter >= THRESHOLDS.JITTER_HIGH) {
    return LearningState.STRUGGLING;
  }

  // High dwell + moderate jitter → stalled
  if (dwell_time_ms >= THRESHOLDS.DWELL_HIGH && mouse_jitter >= THRESHOLDS.JITTER_LOW) {
    return LearningState.STALLED;
  }

  // High dwell + low jitter + 0 tab switches → deep reading
  if (dwell_time_ms >= THRESHOLDS.DWELL_HIGH && mouse_jitter < THRESHOLDS.JITTER_LOW && tab_switches === 0) {
    return LearningState.DEEP_READING;
  }

  // Default → focused
  return LearningState.FOCUSED;
}

// ─── Nudge Mapping ─────────────────────────────────────────────────────────────

/**
 * Map a learning state + platform context to an actionable nudge.
 *
 * @param {string} state - LearningState value
 * @param {string} platformType - PlatformType value
 * @returns {{ type: string, priority: string, message: string } | null} Nudge or null
 */
export function mapStateToNudge(state, platformType) {
  // No nudge for positive/neutral states
  if (state === LearningState.FOCUSED || state === LearningState.DEEP_READING) {
    return null;
  }

  // STRUGGLING nudges depend on platform
  if (state === LearningState.STRUGGLING) {
    if (platformType === PlatformType.QUIZ) {
      return {
        type: 'HINT',
        priority: 'HIGH',
        message: 'It looks like you might be stuck. Would you like a hint?',
      };
    }
    if (platformType === PlatformType.POLL) {
      return {
        type: 'LOGIC_BRIDGE',
        priority: 'HIGH',
        message: 'Try breaking this down step by step.',
      };
    }
    if (platformType === PlatformType.LMS_READING) {
      return {
        type: 'HINT',
        priority: 'HIGH',
        message: 'This section seems challenging. Would you like a simplified explanation?',
      };
    }
    // Default for STRUGGLING on unknown platform
    return {
      type: 'HINT',
      priority: 'HIGH',
      message: 'Need some help?',
    };
  }

  // RE_READING nudge
  if (state === LearningState.RE_READING) {
    return {
      type: 'SUMMARY',
      priority: 'MEDIUM',
      message: 'You seem to be re-reading this section. Here\'s a quick summary.',
    };
  }

  // STALLED nudge
  if (state === LearningState.STALLED) {
    return {
      type: 'BREAK',
      priority: 'LOW',
      message: 'You\'ve been on this for a while. Consider taking a short break.',
    };
  }

  return null;
}
