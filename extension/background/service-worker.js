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
    GENERATE_NUDGE: 'GENERATE_NUDGE',
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
    RE_READ_CYCLES_HIGH: SensorConfig.RE_READ_CYCLE_THRESHOLD,
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
    const { dwell_time_ms, mouse_jitter, tab_switches, re_read_cycles } = metrics;

    // High tab switches → distracted / stalled
    if (tab_switches >= THRESHOLDS.TAB_SWITCH_HIGH) {
      return LearningState.STALLED;
    }

    // High re-read cycles → re-reading
    if (re_read_cycles && re_read_cycles >= THRESHOLDS.RE_READ_CYCLES_HIGH) {
      return LearningState.RE_READING;
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
   * Packet — Behavioral Data Schema & Validation
   *
   * Defines the structured JSON "packet" that Content Scripts emit to the
   * Service Worker. Includes factory, validation, and sanitization functions.
   *
   * Privacy-first: sanitizePacket() strips any fields that could contain PII.
   */

  // ─── Allowed Fields (Allowlist for PII protection) ─────────────────────────────

  const ALLOWED_PACKET_FIELDS = ['context', 'metrics', 'inferred_state', 'timestamp'];
  const ALLOWED_CONTEXT_FIELDS = ['domain', 'type'];
  const ALLOWED_METRICS_FIELDS = ['dwell_time_ms', 'scroll_velocity', 'mouse_jitter', 'tab_switches', 're_read_cycles'];

  // ─── Sanitization (Privacy) ────────────────────────────────────────────────────

  /**
   * Strips any fields not in the allowlist from a packet.
   * Returns a NEW object — does not mutate the input.
   *
   * @param {object} packet - Raw packet that may contain extra fields
   * @returns {object} A sanitized packet containing only allowed fields
   */
  function sanitizePacket(packet) {
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
  async function ensureOffscreen() {
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
   * Check if an offscreen document currently exists.
   *
   * @returns {Promise<boolean>}
   */
  async function hasOffscreen() {
    try {
      return chrome.offscreen.hasDocument();
    } catch (err) {
      console.error('[Lumina SW] Failed to check offscreen document:', err);
      return false;
    }
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
          // Strip transient_content and PII before hitting storage constraints (UAC 1)
          session.latestPacket = sanitizePacket(message.payload);

          // Run rule-based classification on the metrics
          if (message.payload && message.payload.metrics) {
            try {
              let nextState = classifyState(message.payload.metrics);

              // Phase 2: Attempt to utilize the Offscreen ONNX AI Engine
              try {
                const aiResult = await chrome.runtime.sendMessage({
                  type: MessageType.INFERENCE_REQUEST,
                  payload: message.payload
                });

                if (aiResult && aiResult.state && aiResult.state !== 'UNKNOWN') {
                  nextState = aiResult.state;
                  console.debug('[Lumina SW] State classified via ONNX Engine:', nextState);
                } else {
                  console.debug('[Lumina SW] State classified via Rule Fallback:', nextState);
                }
              } catch (onnxErr) {
                // If offscreen doesn't respond, we fall back to the rule-based engine silently
                console.debug('[Lumina SW] State classified via Rule Fallback (ONNX failed or loading):', nextState);
              }

              session.lastState = nextState;
              const currentContent = message.payload.transient_content || null;
              
              const stateChanged = session.lastState !== session.lastPromptedState;
              const contentChanged = currentContent !== session.lastPromptedContent;

              if (stateChanged || contentChanged) {
                // Ask Offscreen Document to run LLM logic
                console.log(`[Lumina SW] 📤 Requesting Generative Nudge for state: ${session.lastState}`);
                console.log(`[Lumina SW] 📎 Transient content extracted: "${currentContent || 'None'}"`);
                await ensureOffscreen();
                const generateResponse = await chrome.runtime.sendMessage({
                  type: MessageType.GENERATE_NUDGE,
                  payload: {
                    state: session.lastState,
                    platform: message.payload.context.type,
                    transient_content: currentContent
                  }
                }).catch(() => null);

                if (generateResponse && generateResponse.nudge) {
                  session.lastNudge = generateResponse.nudge;
                } else {
                  session.lastNudge = null;
                }

                // Update cache to prevent redundant LLM calls
                session.lastPromptedState = session.lastState;
                session.lastPromptedContent = currentContent;
              } else {
                console.debug(`[Lumina SW] ♻️ Reusing cached nudge for state: ${session.lastState} (No change in state or content)`);
              }
              
              // Broadcast the new state to any open side panels or popups
              chrome.runtime.sendMessage({
                type: MessageType.STATE_UPDATED,
                payload: { state: session.lastState, nudge: session.lastNudge }
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
