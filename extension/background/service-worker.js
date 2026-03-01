var LuminaBackground = (function (exports) {
  'use strict';

  /**
   * Shared constants for Lumina Insight
   *
   * Learning states, platform types, and message types used across all layers.
   */

  /** Possible inferred learning states */
  const LearningState = Object.freeze({
    PENDING_LOCAL_AI: 'PENDING_LOCAL_AI',
    FOCUSED: 'FOCUSED',
    STALLED: 'STALLED',
    STRUGGLING: 'STRUGGLING',
    DEEP_READING: 'DEEP_READING',
    RE_READING: 'RE_READING',
  });

  /** Message types for chrome.runtime.sendMessage routing */
  const MessageType = Object.freeze({
    BEHAVIORAL_PACKET: 'BEHAVIORAL_PACKET',
    INFERENCE_REQUEST: 'INFERENCE_REQUEST',
    INFERENCE_RESULT: 'INFERENCE_RESULT',
    GET_STATE: 'GET_STATE',
    STATE_UPDATED: 'STATE_UPDATED',
    HEARTBEAT: 'HEARTBEAT',
  });

  /** Sensor configuration defaults */
  const SensorConfig = Object.freeze({
    THROTTLE_INTERVAL_MS: 100,
    DWELL_STALL_THRESHOLD_MS: 15000,
    RE_READ_CYCLE_THRESHOLD: 3,
    MOUSE_JITTER_NORMALIZATION_MAX: 500, // pixels
  });

  /**
   * Storage Manager — Session Persistence via chrome.storage.local
   *
   * Handles saving and loading the learning session state so the
   * Service Worker can restore state after being spun down.
   */

  /** Default session shape when nothing has been stored */
  const DEFAULT_SESSION = Object.freeze({
    lastState: null,
    packetCount: 0,
  });

  const STORAGE_KEY = 'session';

  /**
   * Save session data to chrome.storage.local.
   *
   * @param {object} data - Session data to persist
   * @returns {Promise<void>}
   */
  async function saveSession(data) {
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
  async function loadSession() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || { ...DEFAULT_SESSION };
    } catch (err) {
      console.error('[Lumina SW] Failed to load session:', err);
      return { ...DEFAULT_SESSION };
    }
  }

  /**
   * State Classifier — Rule-based learning state classification
   *
   * Maps behavioral metrics to learning state enums. This serves as both
   * a standalone classifier and a complement to the ONNX model.
   * The ONNX model can override these classifications when available.
   */

  // ─── Thresholds ────────────────────────────────────────────────────────────────

  const THRESHOLDS = {
    DWELL_HIGH: SensorConfig.DWELL_STALL_THRESHOLD_MS,       // 15000ms
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
  function classifyState(metrics) {
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

  /**
   * Message Router — Central message hub for the Service Worker
   *
   * Routes messages from Content Scripts, Popup, and Offscreen Document
   * to the appropriate handlers.
   */

  /**
   * Handle an incoming runtime message.
   *
   * @param {object} message - The message object with { type, payload }
   * @param {object} sender - chrome.runtime.MessageSender
   * @param {Function} sendResponse - callback to send a response
   */
  async function handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case MessageType.BEHAVIORAL_PACKET: {
          // Store the latest packet, classify state, and increment count
          const session = await loadSession();
          session.packetCount = (session.packetCount || 0) + 1;
          session.latestPacket = message.payload;

          // Run rule-based classification on the metrics
          if (message.payload && message.payload.metrics) {
            try {
              session.lastState = classifyState(message.payload.metrics);
              console.debug('[Lumina SW] Classified state:', session.lastState);
              
              // Broadcast the new state to any open side panels or popups
              chrome.runtime.sendMessage({
                type: MessageType.STATE_UPDATED,
                payload: session.lastState
              }).catch(() => {
                // Ignore errors (happens if no popup/panel is open to receive it)
              });
              
            } catch (err) {
              console.error('[Lumina SW] Classification failed:', err);
            }
          }

          await saveSession(session);

          sendResponse({ received: true });
          break;
        }

        case MessageType.GET_STATE: {
          const session = await loadSession();
          sendResponse(session);
          break;
        }

        case MessageType.HEARTBEAT: {
          // Re-hydrate state from storage (Service Worker may have been idle)
          const session = await loadSession();
          sendResponse({ alive: true, session });
          break;
        }

        default: {
          console.error('[Lumina SW] Unknown message type:', message.type);
          sendResponse({ error: `Unknown message type: ${message.type}` });
          break;
        }
      }
    } catch (err) {
      console.error('[Lumina SW] Error handling message:', message.type, err);
      sendResponse({ error: err.message });
    }
  }

  /**
   * Initialize the message router by registering the onMessage listener.
   */
  function initRouter() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // handleMessage is async, so we need to return true to keep the
      // sendResponse channel open
      handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  /**
   * Service Worker Main — Wires routing, storage, and offscreen management
   *
   * This is the main entry point for the MV3 Service Worker. It:
   * 1. Registers the message router
   * 2. Sets up onInstalled handler for fresh-install initialization
   * 3. Manages the offscreen document lifecycle for AI inference
   */

  // ─── Initialization ────────────────────────────────────────────────────────────

  /**
   * Initialize the Service Worker: register listeners and restore state.
   */
  function initServiceWorker() {
    // Register the message router
    initRouter();

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
  const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
  if (!isTestEnv && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
    initServiceWorker();
  }

  exports.initServiceWorker = initServiceWorker;

  return exports;

})({});
