/**
 * Shared constants for Lumina Insight
 *
 * Learning states, platform types, and message types used across all layers.
 */

/** Possible inferred learning states */
export const LearningState = Object.freeze({
  PENDING_LOCAL_AI: 'PENDING_LOCAL_AI',
  FOCUSED: 'FOCUSED',
  STALLED: 'STALLED',
  STRUGGLING: 'STRUGGLING',
  DEEP_READING: 'DEEP_READING',
  RE_READING: 'RE_READING',
});

/** Platform context types */
export const PlatformType = Object.freeze({
  QUIZ: 'QUIZ',
  POLL: 'POLL',
  LMS_READING: 'LMS_READING',
  UNKNOWN: 'UNKNOWN',
});

/** Message types for chrome.runtime.sendMessage routing */
export const MessageType = Object.freeze({
  BEHAVIORAL_PACKET: 'BEHAVIORAL_PACKET',
  INFERENCE_REQUEST: 'INFERENCE_REQUEST',
  INFERENCE_RESULT: 'INFERENCE_RESULT',
  GET_STATE: 'GET_STATE',
  STATE_UPDATED: 'STATE_UPDATED',
  HEARTBEAT: 'HEARTBEAT',
});

/** Sensor configuration defaults */
export const SensorConfig = Object.freeze({
  THROTTLE_INTERVAL_MS: 100,
  DWELL_STALL_THRESHOLD_MS: 15000,
  RE_READ_CYCLE_THRESHOLD: 3,
  MOUSE_JITTER_NORMALIZATION_MAX: 500, // pixels
});
